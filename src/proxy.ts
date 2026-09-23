import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/offline", "/session-expired"];

const isPublic = (path: string) =>
  PUBLIC.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));

/** Refreshes the Supabase session cookie and gates every private route. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let cookiesToSet: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet = list;
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const signedIn = !!data?.user;

  if (!signedIn && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // A device that already has a valid session never sees the welcome/login again (until an explicit logout).
  if (signedIn && (path === "/" || path === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  // Forward the already-verified user id to the app via a request header (deleting any
  // client-supplied value first so it can't be spoofed) so pages never re-verify the same
  // session a second time — that redundant round-trip used to run on every single navigation.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-verified-user-id");
  if (signedIn) requestHeaders.set("x-verified-user-id", data.user.id);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  // Private pages must never be stored by shared caches or the service worker.
  if (!isPublic(path)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|brand/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|ogg)$).*)",
  ],
};
