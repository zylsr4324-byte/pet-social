export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const ui = {
  card:
    "rounded-[30px] border border-[#eadfce] bg-white/96 shadow-[0_24px_60px_-28px_rgba(107,70,36,0.24)]",
  cardWarm:
    "rounded-[30px] border border-[#f1dcc2] bg-gradient-to-br from-[#fff7ed] via-white to-[#fff1df] shadow-[0_24px_60px_-28px_rgba(180,83,9,0.3)]",
  cardInset:
    "rounded-[26px] border border-[#f1dcc2] bg-white shadow-[0_18px_45px_-24px_rgba(180,83,9,0.28)]",
  cardSoft:
    "rounded-2xl border border-[#eee4d6] bg-[#fbf8f4] p-4",
  cardGhost:
    "rounded-[28px] border border-dashed border-[#ddd1bf] bg-[#faf5ed] p-8",
  chip:
    "rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-amber-700 shadow-sm",
  pill:
    "rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-600 shadow-sm",
  buttonPrimary:
    "inline-flex items-center justify-center rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60",
  buttonSecondary:
    "inline-flex items-center justify-center rounded-xl bg-[#efe2cf] px-5 py-3 text-sm font-medium text-[#7b4b22] transition hover:bg-[#e5d2b4] disabled:cursor-not-allowed disabled:opacity-60",
  buttonOutline:
    "inline-flex items-center justify-center rounded-xl border border-[#d7c6b1] bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60",
  buttonSubtle:
    "text-sm font-medium text-stone-600 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60",
  input:
    "w-full rounded-xl border border-[#d7c6b1] bg-[#faf6ef] px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60",
  noticeError:
    "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700",
  noticeSuccess:
    "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700",
  noticeInfo:
    "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700",
  emptyText: "text-sm leading-7 text-stone-600",
} as const;
