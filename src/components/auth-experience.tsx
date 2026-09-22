"use client";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
import type {Dictionary,Locale} from "@/i18n/dictionaries";
import {Logo} from "./layout/logo";

export function AuthExperience({t,locale}:{t:Dictionary;locale:Locale}){
  const [step,setStep]=useState<"email"|"code">("email");
  const [email,setEmail]=useState("");
  const router=useRouter();
  function next(e:FormEvent){e.preventDefault();setStep("code")}
  function enterDemo(){router.push(`/${locale}/places`)}
  return <main className="auth-page"><section className="auth-art"><Logo/><div className="travel-lines"><span>✦</span><span>⌖</span><span>◎</span></div><div><span className="eyebrow">{t.auth.eyebrow}</span><h1>{t.auth.artLine}</h1></div></section><section className="auth-panel"><div className="auth-card"><Logo/><span className="eyebrow">{t.common.demo}</span><h1>{step==="email"?t.auth.title:t.auth.codeTitle}</h1><p>{step==="email"?t.auth.subtitle:`${t.auth.codeBody} ${email}`}</p>{step==="email"?<><button className="google-button" onClick={()=>alert(t.auth.missing)}><b>G</b>{t.auth.google}</button><div className="or"><span/>{t.auth.or}<span/></div><form onSubmit={next}><label>{t.auth.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder}/></label><button className="primary" type="submit">{t.auth.send}</button></form><div className="or"><span/>{t.auth.or}<span/></div><button className="google-button" type="button" onClick={enterDemo}>{t.auth.demoEnter}</button></>:<form onSubmit={e=>{e.preventDefault();alert(t.auth.missing)}}><label>{t.auth.code}<input className="code-input" required inputMode="numeric" maxLength={6} placeholder="••••••"/></label><button className="primary">{t.auth.verify}</button><button type="button" className="text-button" onClick={()=>setStep("email")}>{t.auth.change}</button></form>}<p className="auth-note">ⓘ {t.auth.missing}</p><small>{t.auth.terms}</small></div></section></main>}
