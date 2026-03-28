const AUTH_TOKEN_STORAGE_KEY = "pet-agent-social:auth-token";
const AUTH_USER_EMAIL_STORAGE_KEY = "pet-agent-social:auth-user-email";

export const readStoredAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  return storedToken?.trim() ? storedToken : null;
};

export const readStoredAuthUserEmail = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedEmail = window.localStorage.getItem(AUTH_USER_EMAIL_STORAGE_KEY);

  return storedEmail?.trim() ? storedEmail : null;
};

export const hasStoredAuthToken = () => readStoredAuthToken() !== null;

export const clearStoredAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_EMAIL_STORAGE_KEY);
};

export const buildAuthHeaders = (token: string, includeJson = false) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};
