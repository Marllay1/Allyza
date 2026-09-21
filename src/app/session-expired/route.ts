import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * A session can be revoked server-side (password changed, signed out elsewhere) while its short-lived
 * token still looks valid to the proxy. Landing here clears the stale cookies for good, then shows the login.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const res = NextResponse.redirect(new URL("/login", request.url));
  // Belt and braces: expire any Supabase auth cookie that is still around.
  for (const c of request.cookies.getAll()) if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
