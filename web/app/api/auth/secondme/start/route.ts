import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { SECONDME_STATE_COOKIE_NAME } from "../../../../../lib/auth";
import { getAppBaseUrl } from "../../../../../lib/site";

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
};

const buildLoginRedirect = (message: string) => {
  const loginUrl = new URL("/login", getAppBaseUrl());

  loginUrl.searchParams.set("secondme_error", message);

  return loginUrl;
};

export async function GET() {
  try {
    const oauthUrl = new URL(getRequiredEnv("SECONDME_OAUTH_URL"));
    const clientId = getRequiredEnv("SECONDME_CLIENT_ID");
    const redirectUri = getRequiredEnv("SECONDME_REDIRECT_URI");
    const state = randomUUID();

    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(oauthUrl);
    response.cookies.set({
      name: SECONDME_STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return NextResponse.redirect(
      buildLoginRedirect(
        error instanceof Error ? error.message : "SecondMe OAuth is not configured."
      )
    );
  }
}
