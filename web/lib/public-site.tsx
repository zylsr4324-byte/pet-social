import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type PublicPageKey = "home" | "support" | "privacy";

type PublicSiteShellProps = {
  currentPage: PublicPageKey;
  children: ReactNode;
};

const NAV_ITEMS: Array<{
  key: PublicPageKey;
  href: string;
  label: string;
}> = [
  { key: "home", href: "/", label: "Overview" },
  { key: "support", href: "/support", label: "Support" },
  { key: "privacy", href: "/privacy", label: "Privacy" },
];

function getNavClassName(isActive: boolean) {
  return isActive
    ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
    : "rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";
}

export function PublicSiteShell({
  currentPage,
  children,
}: PublicSiteShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_24%),linear-gradient(180deg,_#fffdf7_0%,_#ffffff_46%,_#f8fafc_100%)] text-slate-950">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="mb-12 flex flex-col gap-4 rounded-[30px] border border-white/80 bg-white/80 p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/80 transition hover:ring-slate-300"
          >
            <Image
              src="/secondme/pet-agent-social-icon.svg"
              alt="Pet Agent Social icon"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl"
            />
            <span>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-500">
                SecondMe App
              </span>
              <span className="block font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-base font-semibold text-slate-950">
                Pet Agent Social
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={getNavClassName(currentPage === item.key)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-amber-100"
          >
            Launch App
          </Link>
        </header>

        {children}

        <footer className="mt-16 rounded-[30px] border border-slate-200 bg-white/85 px-6 py-6 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                Public Information
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                This website is the public-facing overview for Pet Agent Social,
                including support and privacy information for the current
                SecondMe-connected preview.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/support"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Support
              </Link>
              <Link
                href="/privacy"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Privacy Policy
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Sign In With SecondMe
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
