"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type AuthUser = {
  id: number;
  email: string;
  created_at: string;
};

type AuthRegisterResponse = {
  message: string;
  user: AuthUser;
};

const API_BASE_URL = "http://localhost:8000";

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

const isAuthRegisterResponse = (
  value: unknown
): value is AuthRegisterResponse => {
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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setStatusMessage({
        type: "error",
        message: "请先把邮箱和两次密码都填写完整。",
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage({
        type: "error",
        message: "两次输入的密码不一致，请再检查一下。",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
          "注册失败了，请稍后再试。"
        );

        setStatusMessage({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();

      if (!isAuthRegisterResponse(data)) {
        setStatusMessage({
          type: "error",
          message: "注册结果格式不正确，请稍后再试。",
        });
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setStatusMessage({
        type: "info",
        message: `${data.message} 当前账号：${data.user.email}`,
      });
    } catch {
      setStatusMessage({
        type: "error",
        message: "注册失败了，请稍后再试。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <Link href="/" className="transition hover:text-gray-800">
            返回首页
          </Link>
          <Link href="/login" className="transition hover:text-gray-800">
            去登录
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">注册账号</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            这一步先把最小用户体系搭起来，后面再接宠物归属和权限控制。
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

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label
                htmlFor="register-email"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                邮箱
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="例如：demo@example.com"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                密码
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                确认密码
              </label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再输入一次密码"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "注册中..." : "注册"}
            </button>
          </form>

          <div className="mt-6 text-sm text-gray-500">
            已经有账号了？
            <Link href="/login" className="ml-1 text-gray-800 underline">
              去登录
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
