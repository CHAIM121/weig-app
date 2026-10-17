"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X, Plus, MapPin, ArrowUpRight } from "lucide-react";
export type AiPlace = { id: string; name: string; address: string; description: string };
type Citation = { start: number; end: number; url: string; title: string };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[] };
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
   setMessages([...next, { role: "assistant", content: result.answer, citations: Array.isArray(result.citations) ? result.citations : [] }]);
  } catch (failure) { if ((failure as Error).name !== "AbortError") { setError("AI_UNAVAILABLE"); setMessages(next.slice(0, -1)); setValue(text); } }
  finally { lock.current = false; setBusy(false); }
 };
 const suggestions = place ? [label("מה כדאי לדעת על המקום?", "What should I know about this place?"), label("האם המקום מתאים לביקור עם ילדים?", "Is it suitable for a visit with children?"), label("עזור לי לתכנן ביקור כאן", "Help me plan a visit here")] : [label("עזור לי לתכנן את היום", "Help me plan my day"), label("אני רוצה להתייעץ איתך", "I'd like your advice"), label("איך לתכנן תקציב לטיול?", "How do I plan a travel budget?")];
 return <section className="weig-ai-chat" dir={he ? "rtl" : "ltr"}>
  <header className="weig-ai-header"><span className="weig-ai-mark"><WeigAiSymbol size={26}/></span><div><h1>WEIG AI</h1><p>{label("שואלים, מתייעצים ומתכננים · מחובר לרשת", "Ask, consult and plan · Web connected")}</p></div><button type="button" disabled={busy} onClick={() => { setMessages([]); setPlace(initialPlace); setError(""); setValue(""); }} aria-label={label("שיחה חדשה", "New conversation")}><Plus size={20}/></button>{onClose && <button type="button" onClick={onClose} aria-label={label("סגירה", "Close")}><X size={21}/></button>}</header>
  {place && <div className="weig-ai-place"><MapPin size={17}/><div><strong>{place.name}</strong><small>{place.address}</small></div><button type="button" disabled={busy} onClick={() => { setPlace(undefined); setMessages([]); setError(""); }} aria-label={label("הסרת המקום מהשיחה", "Remove place context")}><X size={16}/></button></div>}
  <div className="weig-ai-body">{!messages.length && <div className="weig-ai-welcome"><span className="weig-ai-orb"><WeigAiSymbol size={38}/></span><h2>{place ? label("מה תרצו לדעת על המקום?", "What would you like to know?") : label("במה אפשר לעזור?", "How can I help?")}</h2><p>{label("אפשר לשאול, להתייעץ ולחשוב יחד על הצעד הבא.", "Ask a question, get advice and think through your next step.")}</p><div className="weig-ai-suggestions">{suggestions.map(text => <button type="button" key={text} disabled={busy} onClick={() => void send(text)}>{text}<Sparkles size={15}/></button>)}</div></div>}
   <div className="weig-ai-messages" role="log" aria-label={label("השיחה עם AI", "AI conversation")} aria-live="polite">{messages.map((message, i) => <div key={i} className={`weig-ai-message ${message.role}`}>{message.role === "assistant" && <Sparkles size={17}/>}<p><CitedAnswer content={message.content} citations={message.citations}/></p></div>)}{busy && <div className="weig-ai-thinking" role="status"><Sparkles size={16}/>{label("בודק ומכין תשובה…", "Checking and preparing an answer…")}<span>•••</span></div>}</div>
   {error && <div className="weig-ai-error" role="alert">{error === "LOGIN_REQUIRED" ? <>{label("כדי לשוחח עם העוזר, התחברו לחשבון WEIG.", "Sign in to WEIG to chat with the assistant.")} <a href={`/${he ? "he" : "en"}/auth`}>{label("כניסה לחשבון", "Sign in")}</a></> : error === "AI_QUOTA_EXCEEDED" ? label("שירות ה־AI אינו זמין כרגע בגלל מגבלת השימוש בחשבון. נסו שוב מאוחר יותר.", "AI is unavailable because the account's usage allowance was reached. Try again later.") : error === "RATE_LIMITED" ? label("רגע קטן, נסו שוב בעוד דקה.", "Please try again in a minute.") : label("לא הצלחנו לקבל תשובה כרגע. השאלה נשמרה בשדה ואפשר לנסות שוב.", "We couldn't get an answer. Your question is kept below so you can try again.")}</div>}<div ref={end}/>
  </div>
  <form className="weig-ai-composer" onSubmit={event => { event.preventDefault(); void send(); }}><textarea autoFocus={!!onClose} maxLength={2000} rows={2} aria-label={label("השאלה שלך", "Your question")} placeholder={label("מה תרצו לשאול?", "What would you like to ask?")} value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/><button type="submit" disabled={busy || !value.trim()} aria-label={label("שליחה", "Send")}><Send size={20}/></button></form>
  <small className="weig-ai-footnote">{label("כדאי לאמת פרטים חשובים לפני שיוצאים לדרך.", "Verify important details before heading out.")}</small>
 </section>;
}
function LinkedText({ text }: { text: string }) {
 const clean = text.replace(/&#(?:x20|32);/gi, " ");
 const parts: React.ReactNode[] = []; let cursor = 0;
 const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+/g;
 for (const match of clean.matchAll(pattern)) {
  const start = match.index!;
  parts.push(clean.slice(cursor, start));
  const raw = match[2] || match[0]; const url = raw.replace(/[.,;!?،。]+$/, "");
  parts.push(<a key={`${start}-${url}`} href={url} target="_blank" rel="noopener noreferrer">{match[1] || url}</a>);
  if (!match[2]) parts.push(raw.slice(url.length));
  cursor = start + match[0].length;
 }
 parts.push(clean.slice(cursor)); return <>{parts}</>;
}
function CitedAnswer({ content, citations = [] }: { content: string; citations?: Citation[] }) {
 let cursor = 0; const parts: React.ReactNode[] = [];
 for (const ref of [...citations].sort((a, b) => a.start - b.start)) {
  if (!/^https?:\/\//i.test(ref.url) || !Number.isInteger(ref.start) || !Number.isInteger(ref.end) || ref.start < cursor || ref.end <= ref.start || ref.end > content.length) continue;
  parts.push(<LinkedText key={`text-${cursor}`} text={content.slice(cursor, ref.start)}/>);
  parts.push(<a key={`${ref.start}-${ref.url}`} href={ref.url} target="_blank" rel="noopener noreferrer" title={ref.title}>{content.slice(ref.start, ref.end)}</a>);
  cursor = ref.end;
 }
 parts.push(<LinkedText key={`text-${cursor}`} text={content.slice(cursor)}/>); return <>{parts}</>;
}
function WeigAiSymbol({ size = 22 }: { size?: number }) {
 return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
  <path d="M16 3.5 20 12l8.5 4-8.5 4-4 8.5-4-8.5L3.5 16l8.5-4L16 3.5Z" fill="currentColor"/>
  <path d="m16 10 2 6-2 6-2-6 2-6Z" fill="white" fillOpacity=".85"/>
  <circle cx="26.5" cy="5.5" r="2.5" fill="var(--brand-turquoise)"/>
 </svg>;
}
export function PlaceAiButton({ he, name, onClick }: { he: boolean; name: string; onClick: (trigger: HTMLButtonElement) => void }) {
 return <button type="button" className="discover-ai-button" aria-label={he ? `שאלו AI על ${name}` : `Ask AI about ${name}`} aria-haspopup="dialog" onClick={event=>onClick(event.currentTarget)}><span className="discover-ai-glyph"><WeigAiSymbol/></span><span className="discover-ai-label">{he ? "שאלו על המקום" : "Ask about this place"}</span><ArrowUpRight className="discover-ai-arrow" size={16} aria-hidden="true"/></button>;
}
export function PlaceAiDialog({ he, place, close, anchor }: { he: boolean; place: AiPlace; close: () => void; anchor?: HTMLElement | null }) {
 const panel=useRef<HTMLElement>(null);
 const closeRef=useRef(close);closeRef.current=close;
 const [mobile,setMobile]=useState(false);
 const [position,setPosition]=useState({left:16,top:90});
 useEffect(()=>{
  const previousFocus=document.activeElement as HTMLElement|null;
  const media=window.matchMedia("(max-width: 1349px)");
  const update=()=>{
   setMobile(media.matches);
   const current=anchor?.isConnected?anchor:document.querySelector<HTMLElement>(`[data-place-id="${CSS.escape(place.id)}"]`);
   const rect=current?.getBoundingClientRect();
   const width=380,gap=20;
   const app=document.querySelector<HTMLElement>(".has-place-ai")?.getBoundingClientRect();
   let left=app ? app.left-width-gap : rect ? rect.left-width-gap : 20;
   if(left<16&&rect&&rect.right+gap+width<=window.innerWidth-16)left=rect.right+gap;
   setPosition({left:Math.max(16,Math.min(left,window.innerWidth-width-16)),top:Math.max(84,Math.min(rect?.top??90,window.innerHeight-740))});
  };
  update();media.addEventListener("change",update);window.addEventListener("resize",update);window.addEventListener("scroll",update,true);
  panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus({preventScroll:true});
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();closeRef.current()}
   if(event.key==="Tab"&&media.matches){
    const items=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href]');
    if(!items?.length)return;
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   }
  };
  document.addEventListener("keydown",keydown);
  return()=>{media.removeEventListener("change",update);window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true);document.removeEventListener("keydown",keydown);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})};
 },[anchor]);
 useEffect(()=>{if(!mobile)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[mobile]);
 return <div className="weig-ai-panel-wrap" dir={he?"rtl":"ltr"}>{mobile&&<button type="button" className="weig-ai-panel-backdrop" tabIndex={-1} aria-label={he?"סגירה":"Close"} onClick={close}/>}<section ref={panel} className="weig-ai-panel" style={mobile?undefined:position} role="dialog" aria-modal={mobile||undefined} aria-label={he?`שיחה על ${place.name}`:`Chat about ${place.name}`}><WeigAiChat he={he} place={place} onClose={close}/></section></div>;
}
