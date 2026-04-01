import { NextRequest, NextResponse } from "next/server";

import {
  SECONDME_AUTH_RESULT_COOKIE_NAME,
  SECONDME_STATE_COOKIE_NAME,
} from "../../../../../lib/auth";
import { getAppBaseUrl } from "../../../../../lib/site";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

type SecondMeTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

type BackendLoginResponse = {
  message: string;
  token: string;
  user: {
    email: string;
  };
};

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
};

const readApiBaseUrl = () => {
  const configuredValue =
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    DEFAULT_API_BASE_URL;

  if (
    configuredValue.startsWith("http://") ||
    configuredValue.startsWith("https://")
  ) {
    return configuredValue.replace(/\/$/, "");
  }

  return new URL(configuredValue, getAppBaseUrl()).toString().replace(/\/$/, "");
};

const buildLoginUrl = (searchParams?: Record<string, string>) => {
  const loginUrl = new URL("/login", getAppBaseUrl());

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      loginUrl.searchParams.set(key, value);
    }
  }

  return loginUrl;
};

const buildLoginRedirect = (
  searchParams?: Record<string, string>,
  authResultCookie?: string
) => {
  const response = NextResponse.redirect(buildLoginUrl(searchParams));

  response.cookies.set({
    name: SECONDME_STATE_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });

  if (authResultCookie) {
    response.cookies.set({
      name: SECONDME_AUTH_RESULT_COOKIE_NAME,
      value: authResultCookie,
      path: "/",
      sameSite: "lax",
      maxAge: 60,
    });
  } else {
    response.cookies.set({
      name: SECONDME_AUTH_RESULT_COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
};

const isSecondMeTokenPayload = (
  value: unknown
): value is { code: number; data: SecondMeTokenPayload; message?: string } => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const data = payload.data as Record<string, unknown> | undefined;

  return (
    typeof payload.code === "number" &&
    !!data &&
    typeof data.accessToken === "string"
  );
};

const isBackendLoginResponse = (value: unknown): value is BackendLoginResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const user = payload.user as Record<string, unknown> | undefined;

  return (
    typeof payload.message === "string" &&
    typeof payload.token === "string" &&
    !!user &&
    typeof user.email === "string"
  );
};

const readResponseMessage = async (
  response: Response,
  fallbackMessage: string
) => {
  try {
    const data = await response.json();

    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
};

const encodeAuthResultCookie = (token: string, email: string) =>
  encodeURIComponent(
    Buffer.from(JSON.stringify({ token, email }), "utf-8").toString("base64url")
  );

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  const returnedState = request.nextUrl.searchParams.get("state")?.trim();
  const expectedState = request.cookies.get(SECONDME_STATE_COOKIE_NAME)?.value;

  if (!code) {
    return buildLoginRedirect({
      secondme_error: "SecondMe callback is missing the authorization code.",
    });
  }

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return buildLoginRedirect({
      secondme_error: "SecondMe OAuth state verification failed.",
    });
  }

  try {
    const tokenEndpoint = getRequiredEnv("SECONDME_TOKEN_ENDPOINT");
    const clientId = getRequiredEnv("SECONDME_CLIENT_ID");
    const clientSecret = getRequiredEnv("SECONDME_CLIENT_SECRET");
    const redirectUri = getRequiredEnv("SECONDME_REDIRECT_URI");
    const apiBaseUrl = readApiBaseUrl();

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenPayload: unknown = await tokenResponse.json();

    if (!tokenResponse.ok || !isSecondMeTokenPayload(tokenPayload)) {
      const message =
        tokenPayload &&
        typeof tokenPayload === "object" &&
        "message" in tokenPayload &&
        typeof tokenPayload.message === "string"
          ? tokenPayload.message
          : "SecondMe token exchange failed.";

      return buildLoginRedirect({ secondme_error: message });
    }

    if (tokenPayload.code !== 0) {
      return buildLoginRedirect({
        secondme_error: tokenPayload.message || "SecondMe token exchange failed.",
      });
    }

    const backendResponse = await fetch(`${apiBaseUrl}/auth/secondme/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: tokenPayload.data.accessToken,
        refreshToken: tokenPayload.data.refreshToken ?? null,
        expiresIn: tokenPayload.data.expiresIn ?? null,
      }),
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      return buildLoginRedirect({
        secondme_error: await readResponseMessage(
          backendResponse,
          "Local SecondMe login finalization failed."
        ),
      });
    }

    const backendPayload: unknown = await backendResponse.json();

    if (!isBackendLoginResponse(backendPayload)) {
      return buildLoginRedirect({
        secondme_error: "Local SecondMe login response is invalid.",
      });
    }

    return buildLoginRedirect(
      { secondme: "success" },
      encodeAuthResultCookie(backendPayload.token, backendPayload.user.email)
    );
  } catch (error) {
    return buildLoginRedirect({
      secondme_error:
        error instanceof Error ? error.message : "SecondMe login failed.",
    });
  }
}
