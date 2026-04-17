"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearStoredAuth } from "./auth";
import { clearStoredPetId } from "./pet";
import { ui } from "./ui";

const NAV_ITEMS = [
  { href: "/home", label: "主页" },
  { href: "/my-pet", label: "宠物" },
  { href: "/chat", label: "聊天" },
  { href: "/social", label: "社交" },
  { href: "/shop", label: "商店" },
] as const;

type AppHeaderNavProps = {
  compact?: boolean;
};

export function AppHeaderNav({ compact = false }: AppHeaderNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredPetId();
    router.replace("/");
  };

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <nav
        className={`flex flex-wrap items-center gap-2 ${
          compact ? "" : "sm:gap-3"
        }`}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-stone-900 text-white shadow-sm"
                  : "bg-white/95 text-stone-600 ring-1 ring-[#e4d9ca] hover:text-stone-900 hover:ring-[#cdbfa8]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className={`${ui.buttonOutline} px-4 py-2`}
      >
        退出登录
      </button>
    </div>
  );
}
