"use client";
import {ExpensesExperience,AiExperience} from "./other-experiences";
import {CallsExperience} from "./calls-experience";
import type {Dictionary} from "@/i18n/dictionaries";
import {PlacesExperience} from "./places-experience";
export type ModuleName="places"|"expenses"|"calls"|"ai";
export function ModuleExperience({module,t}:{module:ModuleName;t:Dictionary}){if(module==="places")return <PlacesExperience t={t}/>;if(module==="expenses")return <ExpensesExperience t={t}/>;if(module==="calls")return <CallsExperience t={t}/>;return <AiExperience t={t}/>}
