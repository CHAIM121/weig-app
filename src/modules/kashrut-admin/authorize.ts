import {NextResponse} from "next/server";
import {createAuthServerClient} from "@/lib/supabase/auth-server";
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function authorize(){
 const client=await createAuthServerClient();if(!client)return {error:fail("השירות אינו זמין כרגע",503)};
 const {data,error}=await client.auth.getUser();if(error||!data.user||data.user.is_anonymous)return {error:fail("LOGIN_REQUIRED",401)};
 const membership=await client.from("weig_kashrut_managers").select("user_id").eq("user_id",data.user.id).maybeSingle();
 if(membership.error)return {error:fail("השירות אינו זמין כרגע",503)};
 if(!membership.data)return {error:fail("MANAGER_REQUIRED",403)};
 return {client,user:data.user};
}
