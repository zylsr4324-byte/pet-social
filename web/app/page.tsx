import type { Metadata } from "next";
import Link from "next/link";

import { PublicSiteShell } from "../lib/public-site";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Pet Agent Social is an AI pet experience with SecondMe sign-in, pet chat, live pet status, and pet-to-pet social interactions.",
};

const FEATURE_CARDS = [
  {
    title: "Create more than one pet",
    body: "Users can keep multiple AI pets, switch between them, and maintain separate personalities, traits, and histories.",
  },
  {
    title: "Track living status",
    body: "Each pet exposes mood, energy, fullness, hydration, cleanliness, and affection so the app feels alive instead of static.",
  },
  {
    title: "Chat in real time",
    body: "Pets can reply in one-to-one chat and continue building a persistent message history for the current account.",
  },
  {
    title: "Let pets socialize",
    body: "Pets can greet, befriend, and run social rounds with other pets in the app through shared social records.",
  },
];

const REVIEW_FACTS = [
  "SecondMe is the only sign-in method in the current build.",
  "Pet profile data and chat history are stored per user account.",
  "The web app now includes public support and privacy pages.",
  "Integration review still waits for a public MCP endpoint, so App listing readiness comes first.",
];

const FLOW_STEPS = [
  {
    step: "1",
    title: "Sign in with SecondMe",
    body: "The current preview no longer offers local email registration or password login. Users enter through the configured SecondMe External App.",
  },
  {
    step: "2",
    title: "Create or select a pet",
    body: "After sign-in, users can create a pet, edit an existing pet, or switch between pets tied to the same account.",
  },
  {
    step: "3",
    title: "Chat, care, and socialize",
    body: "Users can keep pets active through chat, home scene interactions, survival status updates, and pet-to-pet social features.",
  },
];

export default function Home() {
  return (
    <PublicSiteShell currentPage="home">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="rounded-[36px] border border-white/80 bg-white/88 p-8 shadow-[0_28px_90px_-46px_rgba(15,23,42,0.45)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
            Public App Overview
          </p>
          <h1 className="mt-5 max-w-3xl font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            AI pets that can chat back, stay alive, and build relationships.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Pet Agent Social is a web app for creating AI pets, checking their
            status, talking with them, and triggering pet-to-pet interactions.
            The current preview is connected to SecondMe sign-in and is being
            prepared for App listing submission.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Continue With SecondMe
            </Link>
            <Link
              href="/support"
              className="inline-flex rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Support
            </Link>
            <Link
              href="/privacy"
              className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
            >
              Privacy Policy
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              SecondMe-only sign-in
            </span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">
              Multi-pet account support
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
              Persistent chat history
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-900">
              Pet social rounds
            </span>
          </div>
        </div>

        <aside className="rounded-[36px] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_28px_90px_-46px_rgba(15,23,42,0.7)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
            Review Snapshot
          </p>
          <h2 className="mt-4 font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-2xl font-semibold leading-tight">
            What this public site covers today
          </h2>
          <div className="mt-6 space-y-4">
            {REVIEW_FACTS.map((fact) => (
              <div
                key={fact}
                className="rounded-3xl border border-white/10 bg-white/6 px-4 py-4 text-sm leading-7 text-slate-200"
              >
                {fact}
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FEATURE_CARDS.map((card) => (
          <article
            key={card.title}
            className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)]"
          >
            <h2 className="font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-xl font-semibold text-slate-950">
              {card.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {card.body}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-[36px] border border-slate-200 bg-white/92 p-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.42)] sm:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
            User Flow
          </p>
          <h2 className="mt-4 font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-3xl font-semibold text-slate-950">
            The current product path is already clear enough for a public App
            website.
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            The missing items for submission are not local product pages anymore.
            They are the public deployment URL, final review assets, and
            platform-side listing data.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {FLOW_STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-[28px] border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {item.step}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[32px] border border-emerald-200 bg-emerald-50/90 p-8 shadow-[0_24px_80px_-52px_rgba(16,185,129,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
            Public Links
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">
            Listing-ready support pages now exist in the web app.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            Once the app is deployed to a stable HTTPS domain, the following
            routes can be used directly for the App listing:
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-800">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <strong className="font-semibold">Website:</strong> `/`
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <strong className="font-semibold">Support:</strong> `/support`
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <strong className="font-semibold">Privacy:</strong> `/privacy`
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_24px_80px_-52px_rgba(245,158,11,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
            Next Platform Step
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">
            Deploy first, then backfill the listing URLs.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            The App submission path is now mainly blocked on production hosting
            and review assets, not on missing public copy. Integration review is
            still separate and should wait for a real public MCP endpoint.
          </p>
        </article>
      </section>
    </PublicSiteShell>
  );
}
