"use client";

import { useEffect, useState } from "react";

import { readStoredAuthUserEmail } from "./auth";
import {
  getAuthProviderLabel,
  requestCurrentUser,
  type AuthUser,
} from "./auth-session";

type AuthSessionNoticeProps = {
  authToken: string | null;
  className?: string;
};

type SessionSnapshot = {
  token: string | null;
  user: AuthUser | null;
  hasError: boolean;
};

export function AuthSessionNotice({
  authToken,
  className = "",
}: AuthSessionNoticeProps) {
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSnapshot>({
    token: null,
    user: null,
    hasError: false,
  });

  useEffect(() => {
    let isMounted = true;

    if (!authToken) {
      return () => {
        isMounted = false;
      };
    }

    void requestCurrentUser(authToken)
      .then((user) => {
        if (!isMounted) {
          return;
        }

        setSessionSnapshot({
          token: authToken,
          user,
          hasError: false,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSessionSnapshot({
          token: authToken,
          user: null,
          hasError: true,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authToken]);

  if (!authToken) {
    return null;
  }

  const fallbackEmail = readStoredAuthUserEmail();
  const currentUser =
    sessionSnapshot.token === authToken ? sessionSnapshot.user : null;
  const hasError =
    sessionSnapshot.token === authToken && sessionSnapshot.hasError;
  const isLoading = sessionSnapshot.token !== authToken && !hasError;
  const toneClassName =
    hasError
      ? "border-amber-200 bg-amber-50/80 text-amber-900"
      : "border-emerald-200 bg-emerald-50/80 text-emerald-900";

  let message = "Checking the current session...";

  if (currentUser) {
    message = `Signed in with ${getAuthProviderLabel(currentUser.authProvider)} as ${currentUser.email}.`;
  } else if (isLoading && fallbackEmail) {
    message = `Signed-in session detected for ${fallbackEmail}. Checking account details...`;
  } else if (hasError && fallbackEmail) {
    message = `Signed-in session detected for ${fallbackEmail}, but account details are temporarily unavailable.`;
  } else if (hasError) {
    message = "Current session details are temporarily unavailable.";
  }

  const containerClassName = [
    "rounded-2xl border px-4 py-3 shadow-sm",
    toneClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={containerClassName} aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-80">
        Current session
      </p>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </section>
  );
}
