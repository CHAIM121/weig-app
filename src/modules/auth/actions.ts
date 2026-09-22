"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export type AuthResult={ok:false;code:"CONFIGURATION_MISSING"}|{ok:true};
export async function requestEmailOtp(_formData:FormData):Promise<AuthResult>{const client=await createSupabaseServerClient();if(!client)return {ok:false,code:"CONFIGURATION_MISSING"};return {ok:true}}
export async function startGoogleAuth():Promise<AuthResult>{const client=await createSupabaseServerClient();if(!client)return {ok:false,code:"CONFIGURATION_MISSING"};return {ok:true}}
