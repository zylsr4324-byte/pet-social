import type { MetadataRoute } from "next";

import { buildAppUrl } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/support", "/privacy", "/login"],
    },
    sitemap: buildAppUrl("/sitemap.xml"),
  };
}
