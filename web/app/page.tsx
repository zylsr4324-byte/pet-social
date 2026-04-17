"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

import {
  clearStoredAuth,
  clearTemporarySecondMeAuthResult,
  readStoredAuthToken,
  readTemporarySecondMeAuthResult,
  storeAuthToken,
} from "../lib/auth";
import { API_BASE_URL } from "../lib/constants";
import { clearStoredPetId } from "../lib/pet";
import { ui } from "../lib/ui";

type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  email: string;
  authProvider: string;
  coins: number;
  created_at: string;
};

type AuthLoginResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

type AuthRegisterResponse = {
  message: string;
  user: AuthUser;
};

type AuthMeResponse = {
  message: string;
  user: AuthUser;
};

const AUTH_CHECK_TIMEOUT_MS = 5000;

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
    typeof user.authProvider === "string" &&
    typeof user.coins === "number" &&
    typeof user.created_at === "string"
  );
};

const isAuthLoginResponse = (value: unknown): value is AuthLoginResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    typeof response.token === "string" &&
    isAuthUser(response.user)
  );
};

const isAuthRegisterResponse = (
  value: unknown
): value is AuthRegisterResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string" && isAuthUser(response.user);
};

const isAuthMeResponse = (value: unknown): value is AuthMeResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string" && isAuthUser(response.user);
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

const requestCurrentUser = async (
  token: string,
  timeoutMs = AUTH_CHECK_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, "无法验证当前登录状态，请重新登录。")
      );
    }

    const data: unknown = await response.json();

    if (!isAuthMeResponse(data)) {
      throw new Error("登录状态校验失败，请重新登录。");
    }

    return data.user;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("登录状态检查超时，请重新登录。");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const resolvePostAuthPath = (nextPath: string | null) =>
  nextPath?.startsWith("/") ? nextPath : "/home";

const buildAuthEntryUrl = (mode: AuthMode, nextPath: string | null) => {
  const params = new URLSearchParams();

  if (mode === "register") {
    params.set("mode", "register");
  }

  if (nextPath?.startsWith("/")) {
    params.set("next", nextPath);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
};

function AuthLandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  const modeFromQuery = searchParams.get("mode");
  const nextPath = searchParams.get("next");

  useEffect(() => {
    if (modeFromQuery === "register") {
      setMode("register");
      return;
    }

    setMode("login");
  }, [modeFromQuery]);

  useEffect(() => {
    let isMounted = true;
    let didRedirect = false;

    const stripSecondMeQuery = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("secondme");
      url.searchParams.delete("secondme_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    };

    const checkAuth = async () => {
      const temporarySecondMeResult = readTemporarySecondMeAuthResult();
      const secondMeError = searchParams.get("secondme_error");

      if (temporarySecondMeResult) {
        clearTemporarySecondMeAuthResult();
        storeAuthToken(
          temporarySecondMeResult.token,
          temporarySecondMeResult.email
        );
        stripSecondMeQuery();
      } else if (secondMeError) {
        stripSecondMeQuery();
      }

      const token = readStoredAuthToken();

      if (!token) {
        if (isMounted) {
          setStatusMessage(
            secondMeError ? { type: "error", message: secondMeError } : null
          );
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        await requestCurrentUser(token);

        if (!isMounted) {
          return;
        }

        didRedirect = true;
        router.replace(resolvePostAuthPath(nextPath));
      } catch (error) {
        clearStoredAuth();
        clearStoredPetId();

        if (isMounted) {
          setStatusMessage({
            type: "info",
            message:
              error instanceof Error
                ? error.message
                : "登录状态校验失败，请重新登录。",
          });
          setIsCheckingAuth(false);
        }
      } finally {
        if (isMounted && !didRedirect) {
          setIsCheckingAuth(false);
        }
      }
    };

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [nextPath, router, searchParams]);

  const title = useMemo(() => (mode === "login" ? "登录" : "注册"), [mode]);

  const switchMode = (nextMode: AuthMode) => {
    setStatusMessage(null);
    setPassword("");
    setConfirmPassword("");
    router.replace(buildAuthEntryUrl(nextMode, nextPath));
  };

  const loginWithCredentials = async (
    loginEmail: string,
    loginPassword: string
  ) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, "登录失败，请检查邮箱和密码。")
      );
    }

    const data: unknown = await response.json();

    if (!isAuthLoginResponse(data)) {
      throw new Error("登录响应格式不正确，请稍后重试。");
    }

    storeAuthToken(data.token, data.user.email);
    clearStoredPetId();

    try {
      await requestCurrentUser(data.token);
    } catch (error) {
      clearStoredAuth();
      clearStoredPetId();
      throw error;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password.trim()) {
      setStatusMessage({
        type: "error",
        message: "请先填写邮箱和密码。",
      });
      return;
    }

    if (mode === "register") {
      if (!confirmPassword.trim()) {
        setStatusMessage({
          type: "error",
          message: "请再输入一次确认密码。",
        });
        return;
      }

      if (password !== confirmPassword) {
        setStatusMessage({
          type: "error",
          message: "两次输入的密码不一致。",
        });
        return;
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (mode === "register") {
        const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        });

        if (!registerResponse.ok) {
          setStatusMessage({
            type: "error",
            message: await getResponseErrorMessage(
              registerResponse,
              "注册失败，请稍后重试。"
            ),
          });
          return;
        }

        const registerData: unknown = await registerResponse.json();

        if (!isAuthRegisterResponse(registerData)) {
          setStatusMessage({
            type: "error",
            message: "注册响应格式不正确，请稍后重试。",
          });
          return;
        }
      }

      await loginWithCredentials(normalizedEmail, password);
      router.replace(resolvePostAuthPath(nextPath));
    } catch (error) {
      setStatusMessage({
        type: "error",
        message:
          error instanceof Error ? error.message : "认证失败，请稍后重试。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-[#f7f1e8] px-6 py-12 text-stone-900">
        <div
          className={`mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center px-8 py-20 ${ui.card}`}
        >
          <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">
            正在检查登录状态
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#f7f1e8_52%,_#efe4d2)] px-6 py-8 text-stone-900 sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-stone-200 bg-[#201611] px-8 py-10 text-[#f7f1e8] shadow-[0_40px_100px_rgba(32,22,17,0.24)] sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.32),_transparent_38%),linear-gradient(140deg,_rgba(255,255,255,0.05),_transparent_55%)]" />
          <div className="relative">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs tracking-[0.24em] text-amber-100 uppercase">
              Pet Agent Social
            </div>

            <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
              进入你的宠物主页
            </h1>
          </div>
        </section>

        <section className="rounded-[36px] border border-stone-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(92,69,38,0.08)] backdrop-blur sm:p-8">
          <div className="flex rounded-full bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              注册
            </button>
          </div>

          <div className="mt-8">
            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
              {mode === "login" ? "Sign In" : "Create Account"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {title}
            </h2>
          </div>

          {statusMessage ? (
            <div
              className={`mt-6 ${
                statusMessage.type === "error" ? ui.noticeError : ui.noticeInfo
              }`}
            >
              {statusMessage.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="auth-email"
                className="mb-2 block text-sm font-medium text-stone-800"
              >
                邮箱
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isSubmitting}
                className={ui.input}
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-2 block text-sm font-medium text-stone-800"
              >
                密码
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                disabled={isSubmitting}
                className={ui.input}
              />
            </div>

            {mode === "register" ? (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="mb-2 block text-sm font-medium text-stone-800"
                >
                  确认密码
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再输入一次密码"
                  disabled={isSubmitting}
                  className={ui.input}
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full ${ui.buttonPrimary}`}
            >
              {isSubmitting
                ? mode === "login"
                  ? "登录中..."
                  : "注册并登录中..."
                : mode === "login"
                  ? "登录并进入主页"
                  : "注册并进入主页"}
            </button>
          </form>

          <div className="mt-5">
            <a
              href="/api/auth/secondme/start"
              className={`w-full ${ui.buttonSecondary}`}
            >
              使用 SecondMe 登录
            </a>
          </div>

          <div className="mt-6 text-sm leading-7 text-stone-500">
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="ml-1 font-medium text-stone-900 underline underline-offset-4"
            >
              {mode === "login" ? "去注册" : "去登录"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <AuthLandingContent />
    </Suspense>
  );
}
