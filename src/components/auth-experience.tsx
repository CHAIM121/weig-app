"use client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { createAuthBrowserClient } from "@/lib/supabase/auth-client";
import { Logo, LogoMark } from "./layout/logo";

export function AuthExperience({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const client = useMemo(createAuthBrowserClient, []);
  const he = locale === "he";
  const arrow = he ? <ArrowLeft size={19} /> : <ArrowRight size={19} />;
  const unavailable = he ? "הכניסה אינה זמינה כרגע. נסו שוב מאוחר יותר." : "Sign-in is temporarily unavailable. Please try later.";

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    if (!client) return setError(unavailable);
    setBusy(true);
    try {
      const { error: authError } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/${locale}/auth/callback` } });
      if (authError) throw authError;
      setStep("sent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : unavailable);
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    setError("");
    if (!client) return setError(unavailable);
    setBusy(true);
    const { error: authError } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/${locale}/auth/callback` } });
    if (authError) { setError(authError.message); setBusy(false); }
  }

  return <main className="auth-experience"><section className="auth-visual"><img src="/images/budapest-city.jpg" alt={he ? "מבט על בודפשט והדנובה" : "Budapest and the Danube"}/><span className="auth-visual-shade"/><div className="auth-visual-brand"><Logo/></div><div className="auth-visual-copy"><span>{he ? "הדרך שלך מתחילה כאן" : "YOUR WAY STARTS HERE"}</span><h1>{he ? "לגלות עולם.\nלהרגיש בבית." : "Discover more.\nFeel at home."}</h1><p>{he ? "מקומות, הוצאות, שיחה ועזרה בדרך — במקום אחד." : "Places, expenses, calls and help along the way — together."}</p></div><small>Photo: Krisztian Tabori / Unsplash</small></section><section className="auth-entry"><div className="auth-entry-inner"><div className="auth-entry-top"><LogoMark className="auth-entry-mark"/><span>{he ? "ברוכים הבאים ל־WEIG" : "Welcome to WEIG"}</span></div><h2>{step === "email" ? t.auth.title : t.auth.codeTitle}</h2><p className="auth-entry-subtitle">{step === "email" ? he ? "בחרו איך להתחיל את הדרך שלכם." : "Choose how to start your journey." : `${t.auth.codeBody} ${email}. ${he ? "פתחו את ההודעה ולחצו על הקישור כדי להיכנס." : "Open the message and tap the link to sign in."}`}</p>{params.get("error") === "callback" && <p className="auth-error" role="alert">{he ? "הכניסה לא הושלמה. נסו שוב." : "Sign-in could not be completed. Please try again."}</p>}{step === "email" ? <><button className="auth-google" type="button" disabled={busy} onClick={googleSignIn}><span className="auth-google-g">G</span>{t.auth.google}</button><div className="auth-divider"><span/>{t.auth.or}<span/></div><form onSubmit={sendCode} className="auth-email-form"><label htmlFor="auth-email">{t.auth.email}</label><div className="auth-email-field"><Mail size={19}/><input id="auth-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder}/></div><button className="auth-submit" type="submit" disabled={busy}>{busy ? he ? "שולחים..." : "Sending..." : t.auth.send}{arrow}</button></form><button className="auth-demo" type="button" onClick={() => router.push(`/${locale}/places`)}>{t.auth.demoEnter}{arrow}</button></> : <div className="auth-email-form"><button type="button" className="auth-submit" disabled={busy} onClick={() => sendCode()}>{busy ? he ? "שולחים..." : "Sending..." : he ? "שלחו קישור חדש" : "Resend link"}</button><button type="button" className="auth-change" onClick={() => { setStep("email"); setError(""); }}>{t.auth.change}</button></div>}{error && <p className="auth-error" role="alert">{error}</p>}<div className="auth-trust"><ShieldCheck size={16}/>{he ? "הפרטים שלך שייכים לך." : "Your details stay yours."}</div></div></section></main>;
}
