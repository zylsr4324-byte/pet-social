import type { Metadata } from "next";

import { PublicSiteShell } from "../../lib/public-site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy information for Pet Agent Social, including account data, session storage, pet content, chat records, and third-party service usage.",
};

const COLLECTED_DATA = [
  {
    title: "Account identity",
    body: "We store the account email used in the app, the linked SecondMe user identifier, and the timestamps needed to manage account creation and sign-in state.",
  },
  {
    title: "Session and auth data",
    body: "The web client stores a local auth token and basic session hints in browser storage. The backend stores auth sessions plus SecondMe access and refresh tokens for session continuity.",
  },
  {
    title: "Pet and conversation content",
    body: "We store pet profiles, pet status values, user-to-pet chat messages, pet-to-pet social messages, friendship state, and task history created inside the app.",
  },
  {
    title: "Operational service data",
    body: "We may process standard logs and upstream error details required to keep the app available, debug failures, and monitor request health.",
  },
];

const USE_CASES = [
  "Authenticate users through SecondMe and keep active sessions working.",
  "Generate pet replies and pet social outcomes through the configured language-model provider.",
  "Persist pet data, status, and relationship records for the current account.",
  "Protect service integrity, investigate bugs, and recover from failed requests.",
];

const SHARING_CASES = [
  {
    title: "SecondMe",
    body: "SecondMe is used as the identity provider for the current sign-in flow and may provide upstream profile information required to link accounts.",
  },
  {
    title: "Configured LLM provider",
    body: "Pet Agent Social sends prompt content to the configured model endpoint to generate pet responses. The default code path is compatible with DashScope/OpenAI-style Responses APIs.",
  },
  {
    title: "Hosting and infrastructure vendors",
    body: "The deployment operator may use managed hosting, database, cache, or logging vendors to keep the service online. Specific vendors depend on the environment where this preview is deployed.",
  },
];

const USER_CONTROLS = [
  "You can sign out from the web app to clear the active session in the browser.",
  "You can delete pets inside the app to remove them from your active pet list.",
  "Avoid sending sensitive personal information in chat content or pet profile text.",
  "For preview deployments, data export or account-level deletion requests must go through the same operator channel that provided app access.",
];

export default function PrivacyPage() {
  return (
    <PublicSiteShell currentPage="privacy">
      <section className="rounded-[36px] border border-white/80 bg-white/90 p-8 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.42)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">
          Privacy Policy
        </p>
        <h1 className="mt-5 font-[family-name:'Avenir_Next','Trebuchet_MS','Segoe_UI',sans-serif] text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          Privacy information for the current Pet Agent Social preview.
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
          Last updated on April 1, 2026. This policy describes the current data
          flows visible in the Pet Agent Social codebase and web app preview. It
          should be read together with the support page and the deployment
          context where this app is hosted.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-6 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            What We Collect
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            The current app stores account, session, and pet interaction data.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {COLLECTED_DATA.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-slate-200 bg-white/92 p-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)]"
            >
              <h3 className="text-xl font-semibold text-slate-950">
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
        <article className="rounded-[32px] border border-sky-200 bg-sky-50/90 p-8 shadow-[0_24px_80px_-56px_rgba(14,165,233,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">
            How Data Is Used
          </p>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
            {USE_CASES.map((item) => (
              <li
                key={item}
                className="rounded-3xl bg-white px-5 py-4 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white/92 p-8 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Sharing And Processors
          </p>
          <div className="mt-6 space-y-4">
            {SHARING_CASES.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5"
              >
                <h3 className="text-base font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[32px] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_24px_80px_-56px_rgba(245,158,11,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
            User Controls
          </p>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
            {USER_CONTROLS.map((item) => (
              <li
                key={item}
                className="rounded-3xl bg-white px-5 py-4 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white/92 p-8 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Additional Notes
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
              The current preview does not use a local email-and-password sign-in
              flow. SecondMe is the only supported identity source.
            </p>
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
              The app currently has no in-product advertising workflow and no
              code path for selling personal data.
            </p>
            <p className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
              Because deployment details can vary, this policy may be updated
              when the production HTTPS domain and final support contact method
              are published.
            </p>
          </div>
        </article>
      </section>
    </PublicSiteShell>
  );
}
