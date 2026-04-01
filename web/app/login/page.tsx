"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  buildAuthHeaders,
  clearStoredAuth,
  clearTemporarySecondMeAuthResult,
  readStoredAuthToken,
  readTemporarySecondMeAuthResult,
  storeAuthToken,
} from "../../lib/auth";
import { API_BASE_URL } from "../../lib/constants";

type AuthUser = {
  id: number;
  email: string;
  authProvider: string;
  created_at: string;
};

type AuthMeResponse = {
  message: string;
  user: AuthUser;
};

type AuthLogoutResponse = {
  message: string;
};

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
    typeof user.authProvider === "string" &&
    typeof user.created_at === "string"
  );
};

const getAuthProviderLabel = (authProvider: string) =>
  authProvider === "secondme" ? "SecondMe" : "local account";

const isAuthMeResponse = (value: unknown): value is AuthMeResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string" && isAuthUser(response.user);
};

const isAuthLogoutResponse = (value: unknown): value is AuthLogoutResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string";
};

const getResponseErrorMessage = async (
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

const requestCurrentUser = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "Current login state could not be verified. Please log in again."
      )
    );
  }

  const data: unknown = await response.json();

  if (!isAuthMeResponse(data)) {
    throw new Error(
      "Current login state could not be verified. Please log in again."
    );
  }

  return data.user;
};

export default function LoginPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const stripOAuthQuery = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("secondme");
      url.searchParams.delete("secondme_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    };

    const loadCurrentUser = async () => {
      const temporarySecondMeResult = readTemporarySecondMeAuthResult();
      const secondMeError = new URLSearchParams(window.location.search).get(
        "secondme_error"
      );

      if (temporarySecondMeResult) {
        clearTemporarySecondMeAuthResult();
        storeAuthToken(
          temporarySecondMeResult.token,
          temporarySecondMeResult.email
        );
        stripOAuthQuery();
      } else if (secondMeError) {
        stripOAuthQuery();
      }

      const token = readStoredAuthToken();

      if (!token) {
        if (isMounted) {
          setStatusMessage(
            secondMeError
              ? { type: "error", message: secondMeError }
              : null
          );
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        const user = await requestCurrentUser(token);

        if (!isMounted) {
          return;
        }

        setCurrentUser(user);
        setStatusMessage({
          type: "info",
          message: temporarySecondMeResult
            ? `SecondMe login successful. Current account: ${user.email}`
            : `Current ${getAuthProviderLabel(user.authProvider)}: ${user.email}`,
        });
      } catch (error) {
        clearStoredAuth();

        if (!isMounted) {
          return;
        }

        setCurrentUser(null);
        setStatusMessage({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Current login state could not be verified. Please log in again.",
        });
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    const token = readStoredAuthToken();

    if (!token || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: buildAuthHeaders(token),
      });

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          "Logout failed. Please try again later."
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();
      const successMessage = isAuthLogoutResponse(data)
        ? data.message
        : "Logged out.";

      clearStoredAuth();
      setCurrentUser(null);
      setStatusMessage({
        type: "info",
        message: successMessage,
      });
    } catch {
      setStatusMessage({
        type: "error",
        message: "Logout failed. Please try again later.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            Back to home
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Continue with SecondMe</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            Local email registration and login have been removed. Use the
            configured SecondMe app as the only sign-in method.
          </p>
        </div>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {statusMessage ? (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                statusMessage.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {statusMessage.message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Single Sign-On
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start the OAuth flow with your configured SecondMe External App.
            </p>
            <a
              href="/api/auth/secondme/start"
              className="mt-4 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Continue with SecondMe
            </a>
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Current session
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {isCheckingAuth
                    ? "Checking the current login state..."
                    : currentUser
                      ? `Signed in with ${getAuthProviderLabel(currentUser.authProvider)} as ${currentUser.email}`
                      : "No active login session yet."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={!currentUser || isLoggingOut || isCheckingAuth}
                className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
