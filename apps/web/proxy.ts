import { NextRequest, NextResponse } from "next/server";

const publicHosts = new Set(["radardeescolhas.com", "www.radardeescolhas.com"]);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (publicHosts.has(host) && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/escolhas", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
