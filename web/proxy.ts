import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, PROTECTED_ROUTE_PREFIXES } from "./lib/auth";

const isProtectedPath = (pathname: string) =>
  PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim();

  if (authCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/", request.url);
  const nextPath = `${pathname}${search}`;

  if (nextPath && nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/community/:path*",
    "/create-pet/:path*",
    "/home/:path*",
    "/my-pet/:path*",
    "/shop/:path*",
    "/social/:path*",
  ],
};
