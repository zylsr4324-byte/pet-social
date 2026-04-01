import type { MetadataRoute } from "next";

import { buildAppUrl, PUBLIC_SITE_PATHS } from "../lib/site";

const LAST_MODIFIED = new Date("2026-04-01T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITE_PATHS.map((pathname) => ({
    url: buildAppUrl(pathname),
    lastModified: LAST_MODIFIED,
    changeFrequency: pathname === "/" ? "weekly" : "monthly",
    priority: pathname === "/" ? 1 : 0.7,
  }));
}
