"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type AuthUser = {
  id: number;
  email: string;
  created_at: string;
};

type AuthLoginResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

type AuthMeResponse = {
  message: string;
  user: AuthUser;
};

type AuthLogoutResponse = {
  message: string;
};

const API_BASE_URL = "http://localhost:8000";
const AUTH_TOKEN_STORAGE_KEY = "pet-agent-social:auth-token";
const AUTH_EMAIL_STORAGE_KEY = "pet-agent-social:auth-user-email";

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
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

const readStoredAuthToken = () => {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

const storeAuthToken = (token: string, email: string) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, email);
};

const clearStoredAuth = () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(response, "当前登录状态校验失败了，请重新登录。")
    );
  }

  const data: unknown = await response.json();

  if (!isAuthMeResponse(data)) {
    throw new Error("当前登录状态校验失败了，请重新登录。");
  }

  return data.user;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      const token = readStoredAuthToken();

      if (!token) {
        if (isMounted) {
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
          message: `当前已登录：${user.email}`,
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
              : "当前登录状态校验失败了，请重新登录。",
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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatusMessage({
        type: "error",
        message: "请先填写邮箱和密码。",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          "登录失败了，请稍后再试。"
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();

      if (!isAuthLoginResponse(data)) {
        setStatusMessage({
          type: "error",
          message: "登录结果格式不正确，请稍后再试。",
        });
        return;
      }

      storeAuthToken(data.token, data.user.email);

      try {
        const verifiedUser = await requestCurrentUser(data.token);

        setCurrentUser(verifiedUser);
        setPassword("");
        setStatusMessage({
          type: "info",
          message: `登录成功，当前账号是 ${verifiedUser.email}。`,
        });
      } catch (error) {
        clearStoredAuth();
        setCurrentUser(null);
        setStatusMessage({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "登录状态校验失败了，请重新登录。",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        message: "登录失败了，请稍后再试。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          "退出登录失败了，请稍后再试。"
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
        : "已退出登录。";

      clearStoredAuth();
      setCurrentUser(null);
      setStatusMessage({
        type: "info",
        message: successMessage,
      });
    } catch {
      setStatusMessage({
        type: "error",
        message: "退出登录失败了，请稍后再试。",
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
            返回首页
          </Link>
          <Link href="/register" className="transition hover:text-gray-800">
            去注册
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">登录账号</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            先把最小登录体系接起来，后面我们再把宠物归属到当前用户。
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

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                邮箱
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="例如：demo@example.com"
                disabled={isSubmitting || isLoggingOut}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                密码
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                disabled={isSubmitting || isLoggingOut}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoggingOut}
              className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "登录中..." : "登录"}
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  当前登录状态
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {isCheckingAuth
                    ? "正在检查当前登录状态..."
                    : currentUser
                      ? `已登录账号：${currentUser.email}`
                      : "当前还没有登录账号。"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={!currentUser || isLoggingOut || isSubmitting}
                className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoggingOut ? "退出中..." : "退出登录"}
              </button>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            还没有账号？
            <Link href="/register" className="ml-1 text-gray-800 underline">
              去注册
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
