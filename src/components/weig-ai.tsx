"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X, Plus, MapPin } from "lucide-react";
export type AiPlace = { id: string; name: string; address: string; description: string };
type Message = { role: "user" | "assistant"; content: string };
export function WeigAiChat({ he, place: initialPlace, onClose }: { he: boolean; place?: AiPlace; onClose?: () => void }) {
 const label = (h: string, e: string) => he ? h : e;
 const [place, setPlace] = useState(initialPlace);
 const [messages, setMessages] = useState<Message[]>([]), [value, setValue] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
 const controller = useRef<AbortController | null>(null), lock = useRef(false), end = useRef<HTMLDivElement>(null);
 useEffect(() => () => controller.current?.abort(), []);
 useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [messages, busy, error]);
 const send = async (text = value) => {
  if (!text.trim() || lock.current) return;
  const next: Message[] = [...messages, { role: "user", content: text.trim().slice(0, 2000) }];
  lock.current = true; setBusy(true); setError(""); setValue(""); setMessages(next);
  const active = new AbortController(); controller.current = active;
  try {
   const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-19), locale: he ? "he" : "en", place }), signal: active.signal });
   const result = await response.json();
   if (!response.ok || typeof result.answer !== "string") { setError(result.error || "AI_UNAVAILABLE"); setMessages(next.slice(0, -1)); setValue(text); return; }
   setMessages([...next, { role: "assistant", content: result.answer }]);
  } catch (failure) { if ((failure as Error).name !== "AbortError") { setError("AI_UNAVAILABLE"); setMessages(next.slice(0, -1)); setValue(text); } }
  finally { lock.current = false; setBusy(false); }
 };
 const suggestions = place ? [label("מה כדאי לדעת על המקום?", "What should I know about this place?"), label("האם המקום מתאים לביקור עם ילדים?", "Is it suitable for a visit with children?"), label("עזור לי לתכנן ביקור כאן", "Help me plan a visit here")] : [label("עזור לי לתכנן את היום", "Help me plan my day"), label("אני רוצה להתייעץ איתך", "I'd like your advice"), label("איך לתכנן תקציב לטיול?", "How do I plan a travel budget?")];
 return <section className="weig-ai-chat" dir={he ? "rtl" : "ltr"}>
  <header className="weig-ai-header"><span className="weig-ai-mark"><Sparkles size={22}/></span><div><h1>WEIG AI</h1><p>{label("שואלים, מתייעצים ומתכננים", "Ask, consult and plan")}</p></div><button type="button" disabled={busy} onClick={() => { setMessages([]); setPlace(undefined); setError(""); setValue(""); }} aria-label={label("שיחה חדשה", "New conversation")}><Plus size={20}/></button>{onClose && <button type="button" onClick={onClose} aria-label={label("סגירה", "Close")}><X size={21}/></button>}</header>
  {place && <div className="weig-ai-place"><MapPin size={17}/><div><strong>{place.name}</strong><small>{place.address}</small></div><button type="button" disabled={busy} onClick={() => { setPlace(undefined); setMessages([]); setError(""); }} aria-label={label("הסרת המקום מהשיחה", "Remove place context")}><X size={16}/></button></div>}
  <div className="weig-ai-body">{!messages.length && <div className="weig-ai-welcome"><span className="weig-ai-orb"><Sparkles size={32}/></span><h2>{place ? label("מה תרצו לדעת על המקום?", "What would you like to know?") : label("במה אפשר לעזור?", "How can I help?")}</h2><p>{label("אפשר לשאול, להתייעץ ולחשוב יחד על הצעד הבא.", "Ask a question, get advice and think through your next step.")}</p><div className="weig-ai-suggestions">{suggestions.map(text => <button type="button" key={text} disabled={busy} onClick={() => void send(text)}>{text}<Sparkles size={15}/></button>)}</div></div>}
   <div className="weig-ai-messages" role="log" aria-label={label("השיחה עם AI", "AI conversation")} aria-live="polite">{messages.map((message, i) => <div key={i} className={`weig-ai-message ${message.role}`}>{message.role === "assistant" && <Sparkles size={17}/>}<p>{message.content}</p></div>)}{busy && <div className="weig-ai-thinking" role="status"><Sparkles size={16}/>{label("חושב על זה…", "Thinking…")}<span>•••</span></div>}</div>
   {error && <div className="weig-ai-error" role="alert">{error === "LOGIN_REQUIRED" ? <>{label("כדי לשוחח עם העוזר, התחברו לחשבון WEIG.", "Sign in to WEIG to chat with the assistant.")} <a href={`/${he ? "he" : "en"}/auth`}>{label("כניסה לחשבון", "Sign in")}</a></> : error === "AI_QUOTA_EXCEEDED" ? label("שירות ה־AI אינו זמין כרגע בגלל מגבלת השימוש בחשבון. נסו שוב מאוחר יותר.", "AI is unavailable because the account's usage allowance was reached. Try again later.") : error === "RATE_LIMITED" ? label("רגע קטן, נסו שוב בעוד דקה.", "Please try again in a minute.") : label("לא הצלחנו לקבל תשובה כרגע. השאלה נשמרה בשדה ואפשר לנסות שוב.", "We couldn't get an answer. Your question is kept below so you can try again.")}</div>}<div ref={end}/>
  </div>
  <form className="weig-ai-composer" onSubmit={event => { event.preventDefault(); void send(); }}><textarea autoFocus={!!onClose} maxLength={2000} rows={2} aria-label={label("השאלה שלך", "Your question")} placeholder={label("מה תרצו לשאול?", "What would you like to ask?")} value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/><button type="submit" disabled={busy || !value.trim()} aria-label={label("שליחה", "Send")}><Send size={20}/></button></form>
  <small className="weig-ai-footnote">{label("כדאי לאמת פרטים חשובים לפני שיוצאים לדרך.", "Verify important details before heading out.")}</small>
 </section>;
}
export function PlaceAiDialog({ he, place, close }: { he: boolean; place: AiPlace; close: () => void }) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => { const element = dialog.current; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; element?.showModal(); return () => { element?.close(); document.body.style.overflow = previous; }; }, []);
 return <dialog ref={dialog} className="weig-ai-dialog" aria-label={he ? `שיחה על ${place.name}` : `Chat about ${place.name}`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><WeigAiChat he={he} place={place} onClose={close}/></dialog>;
}
