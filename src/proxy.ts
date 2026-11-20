// Optimistic auth gate: sends visitors without a session cookie to sign-in before rendering.
// Pages still verify the session on the server (src/server/learner.ts); this only saves a render.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { bypassLearnerIdFrom } from "@/server/test-auth-bypass";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request) || bypassLearnerIdFrom(request.headers)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  // Everything except sign-in, the auth API, Next internals and static files.
  matcher: ["/((?!sign-in$|api/auth/|_next/static/|_next/image|favicon.ico$).*)"],
};
