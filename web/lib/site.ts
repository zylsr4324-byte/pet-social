const DEFAULT_APP_BASE_URL = "http://localhost:3000";

export const PUBLIC_SITE_PATHS = ["/", "/support", "/privacy", "/login"] as const;

const normalizeAppBaseUrl = (value: string | undefined) => value?.trim() || "";

export const getConfiguredAppBaseUrl = () =>
  normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_BASE_URL) ||
  normalizeAppBaseUrl(process.env.APP_BASE_URL) ||
  DEFAULT_APP_BASE_URL;

export const getAppBaseUrl = () => {
  try {
    return new URL(getConfiguredAppBaseUrl());
  } catch {
    return new URL(DEFAULT_APP_BASE_URL);
  }
};

export const buildAppUrl = (pathname: string) =>
  new URL(pathname, getAppBaseUrl()).toString();
