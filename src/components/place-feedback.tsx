"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Heart, MessageCircle, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createAuthBrowserClient } from "@/lib/supabase/auth-client";

export type FeedbackPlaceSnapshot = {
  id: string;
  name: string;
  area: string;
  mapsUrl: string;
};

type PendingVisit = FeedbackPlaceSnapshot & { promptAfter: number };
type PublicFeedback = {
  feedback_id: string;
  score: number;
  review: string | null;
  display_name: string;
};

const VISITS_KEY = "weig-pending-visits-v1";
const AFTER_AUTH_KEY = "weig-feedback-after-auth-v1";
const TWO_HOURS = 2 * 60 * 60 * 1000;

function readPendingVisits(): PendingVisit[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingVisit =>
      typeof item?.id === "string" &&
      typeof item?.name === "string" &&
      typeof item?.area === "string" &&
      typeof item?.mapsUrl === "string" &&
      typeof item?.promptAfter === "number",
    );
  } catch {
    return [];
  }
}

function writePendingVisits(visits: PendingVisit[]) {
  try {
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits.slice(-12)));
  } catch {}
}

function rememberPendingVisit(place: FeedbackPlaceSnapshot) {
  const visits = readPendingVisits().filter((item) => item.id !== place.id);
  visits.push({ ...place, promptAfter: Date.now() + TWO_HOURS });
  writePendingVisits(visits);
}

function forgetPendingVisit(placeId: string) {
  writePendingVisits(readPendingVisits().filter((item) => item.id !== placeId));
}

function saveAfterAuth(place: FeedbackPlaceSnapshot) {
  try {
    localStorage.setItem(AFTER_AUTH_KEY, JSON.stringify(place));
  } catch {}
}

function readAfterAuth(): FeedbackPlaceSnapshot | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(AFTER_AUTH_KEY) || "null");
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    return { id: parsed.id, name: parsed.name, area: parsed.area || "", mapsUrl: parsed.mapsUrl || "" };
  } catch {
    return null;
  }
}

function clearAfterAuth() {
  try {
    localStorage.removeItem(AFTER_AUTH_KEY);
  } catch {}
}

export function usePlaceFeedback(he: boolean) {
  const client = useMemo(createAuthBrowserClient, []);
  const [user, setUser] = useState<User | null>(null);
  const [dueVisit, setDueVisit] = useState<FeedbackPlaceSnapshot | null>(null);
  const [ratingPlace, setRatingPlace] = useState<FeedbackPlaceSnapshot | null>(null);

  const loadDueVisit = useCallback(async (currentUser: User | null) => {
    const localDue = readPendingVisits().find((item) => item.promptAfter <= Date.now());
    if (localDue) {
      setDueVisit(localDue);
      return;
    }
    if (!client || !currentUser) return;
    const { data } = await client
      .from("place_visit_prompts")
      .select("place_id,place_name,place_area,maps_url")
      .eq("user_id", currentUser.id)
      .eq("status", "pending")
      .lte("prompt_after", new Date().toISOString())
      .order("navigated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setDueVisit({ id: data.place_id, name: data.place_name, area: data.place_area || "", mapsUrl: data.maps_url || "" });
  }, [client]);

  useEffect(() => {
    if (!client) {
      void loadDueVisit(null);
      return;
    }
    let active = true;
    client.auth.getUser().then(({ data }) => {
      if (!active) return;
      const nextUser = data.user;
      setUser(nextUser);
      const afterAuth = nextUser ? readAfterAuth() : null;
      if (afterAuth) {
        clearAfterAuth();
        setRatingPlace(afterAuth);
      }
      void loadDueVisit(nextUser);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, loadDueVisit]);

  const recordNavigation = useCallback((place: FeedbackPlaceSnapshot) => {
    rememberPendingVisit(place);
    if (!client || !user) return;
    void client.from("place_visit_prompts").upsert({
      user_id: user.id,
      place_id: place.id,
      place_name: place.name,
      place_area: place.area || null,
      maps_url: place.mapsUrl || null,
      status: "pending",
      navigated_at: new Date().toISOString(),
      prompt_after: new Date(Date.now() + TWO_HOURS).toISOString(),
      responded_at: null,
    }, { onConflict: "user_id,place_id" });
  }, [client, user]);

  const updateVisit = useCallback(async (place: FeedbackPlaceSnapshot, status: "visited" | "not_visited" | "dismissed" | "rated") => {
    forgetPendingVisit(place.id);
    setDueVisit(null);
    if (client && user) {
      await client.from("place_visit_prompts").update({ status, responded_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("place_id", place.id);
    }
  }, [client, user]);

  const askForRating = useCallback((place: FeedbackPlaceSnapshot) => {
    if (!user) {
      saveAfterAuth(place);
      window.location.assign(`/${he ? "he" : "en"}/auth`);
      return;
    }
    setRatingPlace(place);
  }, [he, user]);

  const confirmVisited = useCallback(async () => {
    if (!dueVisit) return;
    const place = dueVisit;
    await updateVisit(place, "visited");
    askForRating(place);
  }, [askForRating, dueVisit, updateVisit]);

  return {
    user,
    dueVisit,
    ratingPlace,
    setRatingPlace,
    recordNavigation,
    askForRating,
    confirmVisited,
    declineVisit: () => dueVisit ? updateVisit(dueVisit, "not_visited") : Promise.resolve(),
    dismissVisit: () => dueVisit ? updateVisit(dueVisit, "dismissed") : Promise.resolve(),
    markRated: (place: FeedbackPlaceSnapshot) => updateVisit(place, "rated"),
  };
}

export function VisitPrompt({
  place,
  he,
  onVisited,
  onDeclined,
  onDismiss,
}: {
  place: FeedbackPlaceSnapshot;
  he: boolean;
  onVisited: () => void;
  onDeclined: () => void;
  onDismiss: () => void;
}) {
  return <aside className="visit-prompt" aria-label={he ? "אישור ביקור" : "Visit confirmation"}>
    <button type="button" className="visit-prompt-close" onClick={onDismiss} aria-label={he ? "סגירה" : "Close"}><X size={18}/></button>
    <div>
      <span>{he ? "רק שאלה קטנה" : "One quick question"}</span>
      <strong>{he ? `הגעת בסוף ל${place.name}?` : `Did you make it to ${place.name}?`}</strong>
    </div>
    <div className="visit-prompt-actions">
      <button type="button" className="visit-prompt-yes" onClick={onVisited}>{he ? "כן, הייתי שם" : "Yes, I went"}</button>
      <button type="button" onClick={onDeclined}>{he ? "לא הגעתי" : "I didn't go"}</button>
    </div>
  </aside>;
}

const choices = [
  { score: 1, emoji: "😕", he: "לא אהבתי", en: "Not for me" },
  { score: 2, emoji: "😐", he: "סביר", en: "Okay" },
  { score: 3, emoji: "🙂", he: "טוב", en: "Good" },
  { score: 4, emoji: "😍", he: "מעולה", en: "Great" },
] as const;

export function RatingSheet({
  place,
  he,
  user,
  onClose,
  onRated,
}: {
  place: FeedbackPlaceSnapshot;
  he: boolean;
  user: User | null;
  onClose: () => void;
  onRated: () => void;
}) {
  const client = useMemo(createAuthBrowserClient, []);
  const [score, setScore] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function save(nextScore: number, nextReview: string | null) {
    if (!client || !user) return;
    setBusy(true);
    setError(false);
    const { error: saveError } = await client.from("place_feedback").upsert({
      user_id: user.id,
      place_id: place.id,
      place_name: place.name,
      score: nextScore,
      review: nextReview,
    }, { onConflict: "user_id,place_id" });
    setBusy(false);
    if (saveError) {
      setError(true);
      return;
    }
    setSaved(true);
    onRated();
  }

  async function choose(nextScore: number) {
    setScore(nextScore);
    await save(nextScore, null);
  }

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!score || !review.trim()) return;
    await save(score, review.trim().slice(0, 280));
  }

  return <div className="rating-sheet-wrap">
    <button type="button" className="rating-sheet-backdrop" onClick={onClose} aria-label={he ? "סגירה" : "Close"}/>
    <section className="rating-sheet" role="dialog" aria-modal="true" aria-labelledby="rating-title">
      <button type="button" className="rating-sheet-close" onClick={onClose} aria-label={he ? "סגירה" : "Close"}><X size={20}/></button>
      <span className="rating-sheet-kicker">{he ? "החוויה שלך" : "Your experience"}</span>
      <h2 id="rating-title">{he ? `איך היה ב${place.name}?` : `How was ${place.name}?`}</h2>
      {!user ? <div className="rating-sign-in"><p>{he ? "כדי שהדירוג יהיה אמין, צריך להתחבר קודם." : "Please sign in so ratings stay trustworthy."}</p><Link href={`/${he ? "he" : "en"}/auth`}>{he ? "כניסה ל־WEIG" : "Sign in to WEIG"}</Link></div> : <>
        <div className="rating-choices" role="group" aria-label={he ? "בחירת דירוג" : "Choose a rating"}>
          {choices.map((choice) => <button key={choice.score} type="button" aria-pressed={score === choice.score} disabled={busy} onClick={() => void choose(choice.score)}><span>{choice.emoji}</span><small>{he ? choice.he : choice.en}</small></button>)}
        </div>
        {saved && <div className="rating-saved" role="status"><Check size={17}/>{he ? "הדירוג נשמר" : "Rating saved"}</div>}
        {score && <form className="rating-review" onSubmit={submitReview}>
          <label htmlFor="place-review">{he ? "רוצה להוסיף כמה מילים?" : "Want to add a few words?"}<small>{he ? "לא חובה" : "Optional"}</small></label>
          <textarea id="place-review" maxLength={280} rows={3} value={review} onChange={(event) => setReview(event.target.value)} placeholder={he ? "מה כדאי לדעת על המקום?" : "What should others know?"}/>
          <div><span>{review.length}/280</span><button type="submit" disabled={busy || !review.trim()}>{busy ? (he ? "שומרים…" : "Saving…") : (he ? "הוספת תגובה" : "Add note")}</button></div>
        </form>}
        {error && <p className="rating-error" role="alert">{he ? "לא הצלחנו לשמור כרגע. נסו שוב." : "We couldn't save that. Please try again."}</p>}
      </>}
    </section>
  </div>;
}

export function PlaceFeedbackSummary({ place, he, onVisited }: { place: FeedbackPlaceSnapshot; he: boolean; onVisited: () => void }) {
  const client = useMemo(createAuthBrowserClient, []);
  const [feedback, setFeedback] = useState<PublicFeedback[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.from("place_feedback_public")
      .select("feedback_id,score,review,display_name")
      .eq("place_id", place.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (active && data) setFeedback(data); });
    return () => { active = false; };
  }, [client, place.id]);

  const liked = feedback.filter((item) => item.score >= 3).length;
  const percent = feedback.length ? Math.round((liked / feedback.length) * 100) : 0;
  const reviews = feedback.filter((item) => item.review).slice(0, 3);

  return <section className={`weig-feedback-summary ${feedback.length ? "has-feedback" : "is-empty"}`} aria-label={he ? "דירוג משתמשי WEIG" : "WEIG community rating"}>
    <div>
      {feedback.length ? <button type="button" className="weig-feedback-score" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Heart size={17} fill="currentColor"/><strong>{percent}% {he ? "אהבו" : "liked it"}</strong><span>· {feedback.length} {he ? "דירוגים" : "ratings"}</span></button> : null}
      <button type="button" className="weig-feedback-visited" onClick={onVisited}>{he ? "כבר הייתי כאן" : "I've been here"}</button>
    </div>
    {open && <div className="weig-feedback-reviews">{reviews.length ? reviews.map((item) => <article key={item.feedback_id}><strong>{item.display_name} · {choices.find((choice) => choice.score === item.score)?.emoji}</strong><p>{item.review}</p></article>) : <p><MessageCircle size={17}/>{he ? "עוד לא נכתבו תגובות למקום הזה." : "No notes have been added yet."}</p>}</div>}
  </section>;
}
