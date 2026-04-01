import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";

export type AuthUser = {
  id: number;
  email: string;
  authProvider: string;
  created_at: string;
};

type AuthMeResponse = {
  message: string;
  user: AuthUser;
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

export const getAuthProviderLabel = (authProvider: string) =>
  authProvider === "secondme" ? "SecondMe" : "local account";

export const requestCurrentUser = async (token: string) => {
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
