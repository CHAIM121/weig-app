import { NextResponse } from "next/server";
export async function GET(request:Request){const url=new URL(request.url);return NextResponse.redirect(new URL(`/${url.pathname.split("/")[1]}/auth`,url.origin))}
