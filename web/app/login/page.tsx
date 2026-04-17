"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.replace(`/${window.location.search}`);
  }, []);

  return null;
}
