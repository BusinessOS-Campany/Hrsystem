import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export const SESSION_COOKIE = "hrsys_session";

const handleI18n = createMiddleware(routing);

const PUBLIC_SEGMENTS = ["login", "forgot-password", "reset-password"];

/**
 * Optimistic gate only. Real authorization always happens on the server
 * (layouts, pages, server actions) against the database session.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/");
  const hasLocale = routing.locales.includes(segments[1] as "en" | "ar");
  const locale = hasLocale ? segments[1] : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(hasLocale ? 2 : 1).join("/");
  const isPublic =
    pathWithoutLocale === "/" ||
    PUBLIC_SEGMENTS.some((p) => pathWithoutLocale.startsWith(`/${p}`));
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSessionCookie && !isPublic) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    if (pathWithoutLocale !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return handleI18n(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
