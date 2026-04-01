import type { Metadata } from "next";

import { PublicSiteShell } from "../../lib/public-site";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Support information for Pet Agent Social, including sign-in, pet management, chat, social features, and preview support scope.",
};

const SUPPORT_TOPICS = [
  {
    title: "Sign-in and account access",
    body: "The current build supports SecondMe sign-in only. If sign-in fails, verify that your SecondMe authorization completed and retry from the login page.",
  },
  {
    title: "Pet creation and switching",
    body: "You can create multiple pets, edit an existing pet, and switch between pets from the in-app selectors on pet-related pages.",
  },
  {
    title: "Chat and social behavior",
    body: "If pet chat, status sync, or social actions look stale, refresh the page once to re-sync the current pet and session state.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What should I include when reporting a problem?",
    answer:
      "Include the page you were on, the pet name involved, what you expected to happen, and the visible error message or behavior you observed.",
  },
  {
    question: "Can I sign in with email and password?",
    answer:
      "No. Local email registration and local password login have been removed from the current preview. SecondMe is the only supported identity provider.",
  },
  {
    question: "Can I delete a pet myself?",
    answer:
      "Yes. The current app includes pet deletion from the pet list flow. Removing a pet deletes that pet from your active in-app list.",
  },
  {
    question: "Is there already a public integration endpoint?",
    answer:
      "No. Pet Agent Social is preparing App listing materials first. Integration submission still waits for a public HTTPS MCP endpoint.",
  },
];

export default function SupportPage() {
  return (
    <PublicSiteShell currentPage="support">
      <section className="rounded-[36px] border border-white/80 bg-white/90 p-8 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.42)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
          Support Center
        </p>
        <h1 className="mt-5 font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          Help for the current Pet Agent Social preview.
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
          This page documents the current support scope for Pet Agent Social as
          of April 1, 2026. It focuses on access, pet management, chat, and
          social interactions in the web app connected to SecondMe sign-in.
        </p>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        {SUPPORT_TOPICS.map((topic) => (
          <article
            key={topic.title}
            className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)]"
          >
            <h2 className="text-xl font-semibold text-slate-950">
              {topic.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {topic.body}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[32px] border border-sky-200 bg-sky-50/90 p-8 shadow-[0_24px_80px_-56px_rgba(14,165,233,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
            How To Get Help
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
            <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
              <strong className="font-semibold text-slate-950">Step 1.</strong>{" "}
              Reproduce the issue and capture the exact page, pet name, and
              visible error state.
            </div>
            <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
              <strong className="font-semibold text-slate-950">Step 2.</strong>{" "}
              If the issue is access-related, sign out and retry the SecondMe
              login flow before reporting it.
            </div>
            <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
              <strong className="font-semibold text-slate-950">Step 3.</strong>{" "}
              For preview access, reply in the same channel where you received
              the app link or reviewer handoff. A dedicated public support inbox
              has not been published yet.
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white/92 p-8 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Frequently Asked Questions
          </p>
          <div className="mt-6 space-y-4">
            {FAQ_ITEMS.map((item) => (
              <article
                key={item.question}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5"
              >
                <h2 className="text-base font-semibold text-slate-950">
                  {item.question}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-10 rounded-[32px] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_24px_80px_-56px_rgba(245,158,11,0.35)]">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
          Current Scope
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Supported today
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              SecondMe login, pet creation and editing, chat, status panels,
              social rounds, and home scene interactions.
            </p>
          </div>
          <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Not public yet
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A production support mailbox, a stable public domain, and a public
              MCP endpoint for integration release.
            </p>
          </div>
          <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Best reporting detail
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Include exact repro steps, current page, current pet, and whether
              the issue started during SecondMe authorization or after sign-in.
            </p>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
