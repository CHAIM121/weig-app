'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, CreditCard, Delete, Globe2, Hash, Phone, Plus, Search, ShieldCheck, Star, Trash2, UserRound, UsersRound, Wallet, X } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { cleanDialNumber, CONTACTS_KEY, countries, internationalNumber, readContacts, type PhoneContact } from '@/modules/calls/phone';
import s from './calls-experience.module.css';

type Tab = 'dialer' | 'recent' | 'contacts' | 'wallet';
type Sheet = 'contact' | 'service' | 'topup' | 'number' | null;
const keys = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];

export function CallsExperience({ t }: { t: Dictionary }) {
  const he = t.places.title === 'לאן תרצו להגיע?';
  const l = (a: string, b: string) => he ? a : b;
  const [tab, setTab] = useState<Tab>('dialer');
  const [number, setNumber] = useState('');
  const [country, setCountry] = useState('972');
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [topup, setTopup] = useState(50);
  const zeroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldZero = useRef(false);
  const firstField = useRef<HTMLInputElement>(null);
  const sheetBox = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const dialNumber = internationalNumber(number, country);
  const match = contacts.find(c => c.number === dialNumber);
  const selectedCountry = countries.find(c => c.code === country)!;
  const titles: Record<Tab, string> = { dialer: l('חייגן', 'Keypad'), recent: l('אחרונות', 'Recents'), contacts: l('אנשי קשר', 'Contacts'), wallet: l('ארנק', 'Wallet') };
  const icons = { dialer: Hash, recent: Clock3, contacts: UsersRound, wallet: Wallet };

  useEffect(() => { setContacts(readContacts()); }, []);
  useEffect(() => () => { if (zeroTimer.current) clearTimeout(zeroTimer.current); }, []);
  useEffect(() => {
    if (!sheet) return;
    trigger.current = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => (firstField.current ?? sheetBox.current)?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheet(null);
      if (e.key !== 'Tab') return;
      const nodes = sheetBox.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href],[tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetBox.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === sheetBox.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(focusTimer); document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); trigger.current?.focus(); };
  }, [sheet]);

  function saveContacts(next: PhoneContact[]) {
    try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(next)); setContacts(next); return true; }
    catch { setError(l('לא ניתן לשמור במכשיר כרגע. נסו שוב.', 'Unable to save on this device. Please try again.')); return false; }
  }
  function openContact(contact?: PhoneContact) {
    setError(''); setName(contact?.name ?? ''); setContactNumber(contact?.number ?? dialNumber ?? number); setEditId(contact?.id ?? null); setSheet('contact');
  }
  function chooseContact(contact: PhoneContact) { setNumber(contact.number); setTab('dialer'); setNotice(''); }
  function call() {
    if (!dialNumber) { setNotice(l('הזינו מספר טלפון תקין כולל קידומת מדינה, או בחרו מדינה למספר מקומי.', 'Enter a valid phone number with a country code, or select a country for a local number.')); return; }
    setNotice(''); setSheet('service');
  }
  const filtered = contacts.filter(c => (!favorites || c.favorite) && (c.name.toLowerCase().includes(search.toLowerCase()) || c.number.includes(search.replace(/[\s()-]/g, '')))).sort((a, b) => a.name.localeCompare(b.name, he ? 'he' : 'en'));
  const sheetTitle = sheet === 'contact' ? (editId ? l('עריכת איש קשר', 'Edit contact') : l('איש קשר חדש', 'New contact')) : sheet === 'topup' ? l('טעינת הארנק', 'Top up wallet') : sheet === 'number' ? l('המספר שלי', 'My number') : l('שיחות דרך WEIG', 'Calls through WEIG');

  return <div className={s.phone} dir={he ? 'rtl' : 'ltr'}>
    <header className={s.header}><div><span className={s.eyebrow}>WEIG PHONE</span><h1>{l('שיחות', 'Calls')}</h1></div><button className={s.balanceShortcut} onClick={() => setTab('wallet')}><Wallet size={17}/><span>{l('הארנק שלי', 'My wallet')}</span></button></header>
    <div className={s.lineCard}><span className={s.lineIcon}><Globe2 size={19}/></span><button onClick={() => setSheet('number')}><strong>{l('המספר שלי', 'My number')}</strong><small>{l('טרם הוקצה מספר', 'No number assigned yet')}</small></button><span className={s.pending}><i/>{l('טרם הופעל', 'Not activated')}</span></div>
    <nav className={s.tabs} role="tablist" aria-label={l('אזור הטלפון', 'Phone sections')}>{(Object.keys(titles) as Tab[]).map(key => { const Icon = icons[key]; return <button key={key} role="tab" id={`phone-tab-${key}`} aria-controls="phone-panel" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => { setTab(key); setNotice(''); }} onKeyDown={e => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); const tabs = Object.keys(titles) as Tab[]; const step = (e.key === 'ArrowRight' ? 1 : -1) * (he ? -1 : 1); const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[3] : tabs[(tabs.indexOf(tab) + step + 4) % 4]; setTab(next); document.getElementById(`phone-tab-${next}`)?.focus(); }}><Icon size={20}/><span>{titles[key]}</span></button>; })}</nav>
    <section className={s.panel} id="phone-panel" role="tabpanel" aria-labelledby={`phone-tab-${tab}`}>
      {tab === 'dialer' && <div className={s.dialer}>
        <label className={s.country}><span>{selectedCountry.flag}</span><select aria-label={l('מדינת היעד', 'Destination country')} value={country} onChange={e => setCountry(e.target.value)}>{countries.map(c => <option key={c.code} value={c.code}>{he ? c.he : c.en} (+{c.code})</option>)}</select></label>
        <div className={s.numberArea}><input aria-label={t.calls.number} type="tel" dir="ltr" autoComplete="off" placeholder={l('מספר טלפון', 'Phone number')} value={number} onChange={e => { setNumber(cleanDialNumber(e.target.value)); setNotice(''); }} onKeyDown={e => { if (e.key === 'Enter') call(); }}/><div className={s.numberHint}>{match ? <span>{match.name}</span> : dialNumber ? <span dir="ltr">{dialNumber}</span> : <span>{l('בחרו איש קשר או הקלידו מספר', 'Choose a contact or enter a number')}</span>}</div></div>
        <div className={s.keypad} dir="ltr" aria-label={t.calls.keypad}>{keys.map(([key, letters]) => <button key={key} type="button" aria-label={key === '0' ? l('0, לחיצה ארוכה לפלוס', '0, hold for plus') : key} onPointerDown={key === '0' ? e => { e.currentTarget.setPointerCapture?.(e.pointerId); heldZero.current = false; zeroTimer.current = setTimeout(() => { heldZero.current = true; setNumber(n => n ? n : '+'); }, 500); } : undefined} onPointerUp={() => { if (zeroTimer.current) clearTimeout(zeroTimer.current); }} onPointerCancel={() => { if (zeroTimer.current) clearTimeout(zeroTimer.current); heldZero.current = true; }} onClick={() => { if (key === '0' && heldZero.current) { heldZero.current = false; return; } setNumber(n => cleanDialNumber(n + key)); setNotice(''); }}><strong>{key}</strong><small>{letters || '\u00a0'}</small></button>)}</div>
        <div className={s.callActions}><button className={s.sideAction} aria-label={l('שמירת המספר כאיש קשר', 'Save number as contact')} disabled={!dialNumber} onClick={() => openContact()}><UserRound size={21}/><Plus size={12}/></button><button className={s.callButton} aria-label={t.calls.call} disabled={!number} onClick={call}><Phone size={25} fill="currentColor"/><span>{l('חיוג', 'Call')}</span></button><button className={s.sideAction} aria-label={l('מחיקת ספרה', 'Delete digit')} disabled={!number} onClick={() => setNumber(n => n.slice(0, -1))} onDoubleClick={() => setNumber('')}><Delete size={23}/></button></div>
        {notice && <p role="status" className={s.error}>{notice}</p>}
        <p className={s.caption}><ShieldCheck size={14}/>{l('חיוג דרך האינטרנט · השירות טרם הופעל', 'Internet calling · Service not activated yet')}</p>
      </div>}
      {tab === 'recent' && <div className={s.listPanel}><div className={s.sectionHeading}><h2>{l('שיחות אחרונות', 'Recent calls')}</h2></div><div className={s.empty}><span><Clock3 size={32}/></span><h3>{l('כל השיחות, במקום אחד', 'Every call, in one place')}</h3><p>{l('השיחות שבוצעו דרך WEIG יופיעו כאן, עם משך השיחה והעלות שלה.', 'Calls made through WEIG will appear here with their duration and cost.')}</p><button className={s.secondary} onClick={() => setTab('dialer')}>{l('פתיחת החייגן', 'Open keypad')}</button></div></div>}
      {tab === 'contacts' && <div className={s.listPanel}><div className={s.sectionHeading}><h2>{titles.contacts}<small>{contacts.length}</small></h2><button className={s.addContact} onClick={() => openContact()} aria-label={l('הוספת איש קשר', 'Add contact')}><Plus size={21}/></button></div><label className={s.search}><Search size={18}/><input aria-label={l('חיפוש אנשי קשר', 'Search contacts')} placeholder={l('שם או מספר טלפון', 'Name or phone number')} value={search} onChange={e => setSearch(e.target.value)}/></label><div className={s.filters}><button aria-pressed={!favorites} onClick={() => setFavorites(false)}>{l('הכול', 'All')}</button><button aria-pressed={favorites} onClick={() => setFavorites(true)}><Star size={14}/>{l('מועדפים', 'Favorites')}</button></div>
        {filtered.length ? <div className={s.contacts}>{filtered.map(c => <article key={c.id}><button className={s.contactMain} onClick={() => openContact(c)}><span className={s.avatar}>{c.name.charAt(0)}</span><span><strong>{c.name}</strong><small dir="ltr">{c.number}</small></span></button><button className={s.favorite} aria-label={`${l('מועדף', 'Favorite')} ${c.name}`} aria-pressed={c.favorite} onClick={() => saveContacts(contacts.map(x => x.id === c.id ? { ...x, favorite: !x.favorite } : x))}><Star size={18} fill={c.favorite ? 'currentColor' : 'none'}/></button><button className={s.contactCall} aria-label={`${l('חיוג אל', 'Dial')} ${c.name}`} onClick={() => chooseContact(c)}><Phone size={20}/></button></article>)}</div> : <div className={s.empty}><span><UsersRound size={32}/></span><h3>{search || favorites ? l('לא נמצאו אנשי קשר', 'No contacts found') : l('האנשים שלכם, במרחק נגיעה', 'Your people, a tap away')}</h3><p>{l('הוסיפו אנשי קשר לחיוג מהיר ונוח.', 'Add contacts for quick, easy dialing.')}</p>{!search && !favorites && <button className={s.secondary} onClick={() => openContact()}><Plus size={17}/>{l('איש קשר חדש', 'New contact')}</button>}</div>}
        <p className={s.caption}>{l('אנשי הקשר נשמרים בדפדפן במכשיר הזה בלבד.', 'Contacts are saved in this browser on this device only.')}</p>{error && <p className={s.error} role="alert">{error}</p>}
      </div>}
      {tab === 'wallet' && <div className={s.walletPanel}><div className={s.walletCard}><div><span>{l('הארנק של השיחות', 'Your calling wallet')}</span><Wallet size={24}/></div><strong>{l('טרם הופעל', 'Not activated')}</strong><p>{l('היתרה תופיע אחרי הפעלת השירות', 'Your balance will appear once the service is activated')}</p><button onClick={() => { setError(''); setSheet('topup'); }}><Plus size={18}/>{l('טעינת הארנק', 'Top up wallet')}</button></div><div className={s.walletInfo}><ShieldCheck size={22}/><div><strong>{l('העלות ברורה לפני שמחייגים', 'Know the rate before you call')}</strong><p>{l('לאחר הפעלת השירות יוצג מחיר לדקה לפי יעד השיחה.', 'Once activated, the per-minute rate will appear for your destination.')}</p></div></div><div className={s.sectionHeading}><h2>{l('תנועות בארנק', 'Wallet activity')}</h2></div><div className={s.activityEmpty}><CreditCard size={25}/><p>{l('אין עדיין טעינות או חיובים', 'No top-ups or charges yet')}</p></div></div>}
    </section>
    {sheet && <div className={s.overlay}><button className={s.scrim} aria-label={t.common.close} onClick={() => setSheet(null)}/><div ref={sheetBox} className={s.sheet} role="dialog" aria-modal="true" aria-labelledby="phone-sheet-title" tabIndex={-1}><div className={s.sheetHandle}/><header><h2 id="phone-sheet-title">{sheetTitle}</h2><button aria-label={t.common.close} onClick={() => setSheet(null)}><X size={21}/></button></header>
      {sheet === 'contact' ? <form className={s.form} onSubmit={e => { e.preventDefault(); const normalized = internationalNumber(contactNumber, country); if (!normalized || !name.trim()) { setError(l('הזינו שם ומספר טלפון תקין.', 'Enter a name and a valid phone number.')); return; } if (contacts.some(c => c.number === normalized && c.id !== editId)) { setError(l('המספר הזה כבר שמור באנשי הקשר.', 'This number is already in your contacts.')); return; } const contact = { id: editId ?? crypto.randomUUID(), name: name.trim(), number: normalized, favorite: contacts.find(c => c.id === editId)?.favorite ?? false }; if (saveContacts(editId ? contacts.map(c => c.id === editId ? contact : c) : [...contacts, contact])) { setSheet(null); setTab('contacts'); } }}><label>{l('שם', 'Name')}<input ref={firstField} required maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label><label>{t.calls.number}<input required type="tel" dir="ltr" value={contactNumber} onChange={e => setContactNumber(cleanDialNumber(e.target.value))} placeholder="+972…"/></label><small>{l('מספר מקומי יישמר עם קידומת המדינה שנבחרה בחייגן.', 'Local numbers use the country selected in the keypad.')}</small>{error && <p className={s.error} role="alert">{error}</p>}<button type="submit" className={s.primary}>{l('שמירת איש קשר', 'Save contact')}</button>{editId && <button type="button" className={s.remove} onClick={() => { if (saveContacts(contacts.filter(c => c.id !== editId))) setSheet(null); }}><Trash2 size={16}/>{l('מחיקת איש קשר', 'Delete contact')}</button>}</form> : <div className={s.serviceBody}>
        <span className={s.serviceIcon}>{sheet === 'topup' ? <Wallet size={28}/> : sheet === 'number' ? <Globe2 size={28}/> : <Phone size={28}/>}</span>
        {sheet === 'service' && <strong className={s.serviceNumber} dir="ltr">{dialNumber}</strong>}
        <h3>{sheet === 'topup' ? l('הארנק יהיה זמין עם הפעלת השיחות', 'Your wallet will open when calling is activated') : sheet === 'number' ? l('הקו שלכם, בכל מקום בעולם', 'Your line, wherever you go') : l('השירות עדיין לא פעיל', 'Calling is not active yet')}</h3>
        <p>{sheet === 'topup' ? l('טעינה ותשלום ייפתחו לאחר הפעלת השירות. כרגע לא ניתן לשלם ולא יתבצע חיוב.', 'Top-ups and payments will open after activation. No payment or charge is possible right now.') : sheet === 'number' ? l('מספר לשיחות נכנסות יופיע כאן לאחר הפעלת השירות והקצאת מספר לחשבון.', 'Your incoming-call number will appear here after the service is activated and a number is assigned.') : l('לאחר הפעלת השירות תוכלו לחייג מכאן דרך האינטרנט. כרגע לא יוצאת שיחה ולא מתבצע חיוב.', 'Once activated, you can call from here over the internet. No call is placed and no charge is made right now.')}</p>
        {sheet === 'topup' && <><div className={s.amounts} role="group" aria-label={l('סכום טעינה מתוכנן', 'Planned top-up amount')}>{[25,50,100,200].map(amount => <button key={amount} aria-pressed={topup === amount} onClick={() => setTopup(amount)}>₪{amount}</button>)}</div><button className={s.primary} disabled>{l('תשלום — בקרוב', 'Payment — coming soon')}</button></>}
        <button className={s.secondary} onClick={() => setSheet(null)}>{l('הבנתי', 'Got it')}</button>
      </div>}
    </div></div>}
  </div>;
}
