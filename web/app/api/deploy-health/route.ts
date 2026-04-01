import { NextResponse } from "next/server";

const DEFAULT_BACKEND_HEALTH_URL = "http://127.0.0.1:8000/health";

const readBackendHealthUrl = () =>
  `${(process.env.API_BASE_URL?.trim() || "http://127.0.0.1:8000").replace(/\/$/, "")}/health`;

export async function GET() {
  const backendHealthUrl = readBackendHealthUrl() || DEFAULT_BACKEND_HEALTH_URL;

  try {
    const response = await fetch(backendHealthUrl, {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          upstreamStatus: response.status,
          backend: payload,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      backend: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Backend health check failed.",
      },
      { status: 503 }
    );
  }
}
