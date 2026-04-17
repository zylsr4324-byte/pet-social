"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buildAuthHeaders, readStoredAuthToken } from "../../lib/auth";
import {
  CATEGORY_LABELS,
  SPRITE_EMOJI,
  type FurnitureTemplate,
} from "../../lib/furniture";
import { AppHeaderNav } from "../../lib/AppHeaderNav";
import { ui } from "../../lib/ui";

const API_BASE_URL = "http://localhost:8000";

type ShopInventoryItem = {
  id: number;
  user_id: number;
  template: FurnitureTemplate;
  quantity: number;
  purchased_at: string;
};

type ShopItem = {
  template: FurnitureTemplate;
  price: number;
  is_gifted: boolean;
  owned_quantity: number;
  can_purchase: boolean;
};

type ShopCatalogResponse = {
  coins: number;
  items: ShopItem[];
  inventory: ShopInventoryItem[];
};

type ShopPurchaseResponse = {
  message: string;
  coins: number;
  item: ShopItem;
  inventory_item: ShopInventoryItem;
};

function isFurnitureTemplate(value: unknown): value is FurnitureTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    typeof item.sprite_key === "string" &&
    typeof item.effects === "string"
  );
}

function isShopItem(value: unknown): value is ShopItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    isFurnitureTemplate(item.template) &&
    typeof item.price === "number" &&
    typeof item.is_gifted === "boolean" &&
    typeof item.owned_quantity === "number" &&
    typeof item.can_purchase === "boolean"
  );
}

function isShopInventoryItem(value: unknown): value is ShopInventoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.user_id === "number" &&
    isFurnitureTemplate(item.template) &&
    typeof item.quantity === "number" &&
    typeof item.purchased_at === "string"
  );
}

function isShopCatalogResponse(value: unknown): value is ShopCatalogResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.coins === "number" &&
    Array.isArray(response.items) &&
    response.items.every(isShopItem) &&
    Array.isArray(response.inventory) &&
    response.inventory.every(isShopInventoryItem)
  );
}

function isShopPurchaseResponse(value: unknown): value is ShopPurchaseResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.message === "string" &&
    typeof response.coins === "number" &&
    isShopItem(response.item) &&
    isShopInventoryItem(response.inventory_item)
  );
}

async function getResponseErrorMessage(
  response: Response,
  fallbackMessage: string
) {
  try {
    const data: unknown = await response.json();
    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export default function ShopPage() {
  const router = useRouter();
  const [coins, setCoins] = useState<number | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<ShopInventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [buyingTemplateId, setBuyingTemplateId] = useState<number | null>(null);

  useEffect(() => {
    const token = readStoredAuthToken();
    if (!token) {
      router.replace("/?next=/shop");
      return;
    }

    const loadShop = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/shop`, {
          cache: "no-store",
          headers: buildAuthHeaders(token),
        });

        if (!response.ok) {
          setError(await getResponseErrorMessage(response, "加载商店失败。"));
          return;
        }

        const data: unknown = await response.json();
        if (!isShopCatalogResponse(data)) {
          setError("商店数据格式不正确。");
          return;
        }

        setCoins(data.coins);
        setItems(data.items);
        setInventory(data.inventory);
      } catch {
        setError("加载商店失败。");
      }
    };

    void loadShop();
  }, [router]);

  const handlePurchase = async (templateId: number) => {
    const token = readStoredAuthToken();
    if (!token) {
      router.replace("/?next=/shop");
      return;
    }

    setBuyingTemplateId(templateId);
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE_URL}/shop/purchase`, {
        method: "POST",
        headers: buildAuthHeaders(token, true),
        body: JSON.stringify({ template_id: templateId }),
      });

      if (!response.ok) {
        setError(await getResponseErrorMessage(response, "购买失败。"));
        return;
      }

      const data: unknown = await response.json();
      if (!isShopPurchaseResponse(data)) {
        setError("购买结果格式不正确。");
        return;
      }

      setCoins(data.coins);
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.template.id === data.item.template.id ? data.item : item
        )
      );
      setInventory((currentInventory) => {
        const existingItem = currentInventory.find(
          (item) => item.id === data.inventory_item.id
        );
        if (!existingItem) {
          return [...currentInventory, data.inventory_item];
        }
        return currentInventory.map((item) =>
          item.id === data.inventory_item.id ? data.inventory_item : item
        );
      });
      setNotice(data.message);
      setError(null);
    } catch {
      setError("购买失败。");
    } finally {
      setBuyingTemplateId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff7ed] p-6 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <AppHeaderNav />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-amber-950">
              家具商店
            </h1>
          </div>

          <div className={`${ui.card} rounded-2xl px-5 py-4`}>
            <p className="text-xs font-medium tracking-[0.2em] text-amber-500">
              COINS
            </p>
            <p className="mt-2 text-3xl font-semibold text-amber-900">
              {coins ?? "--"}
            </p>
          </div>
        </div>

        {notice ? (
          <div className={`mb-4 ${ui.noticeSuccess}`}>
            {notice}
          </div>
        ) : null}

        {error && coins !== null ? (
          <div className={`mb-4 ${ui.noticeError}`}>
            {error}
          </div>
        ) : null}

        <section className={`${ui.card} p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">商品</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <article
                key={item.template.id}
                className={`${ui.cardSoft} rounded-[26px] border-[#f1dcc2] bg-[#fffaf4] p-4 shadow-sm`}
              >
                <div className={`${ui.cardInset} rounded-2xl p-5 text-center`}>
                  <div className="text-4xl">
                    {SPRITE_EMOJI[item.template.sprite_key] ?? "?"}
                  </div>
                  <p className="mt-3 text-base font-semibold text-gray-900">
                    {item.template.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {CATEGORY_LABELS[item.template.category] ??
                      item.template.category}{" "}
                    · {item.template.width}x{item.template.height}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">价格</p>
                    <p className="text-lg font-semibold text-amber-900">
                      {item.is_gifted ? "默认赠送" : `${item.price} 金币`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">已拥有</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {item.owned_quantity}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    !item.can_purchase || buyingTemplateId === item.template.id
                  }
                  onClick={() => {
                    void handlePurchase(item.template.id);
                  }}
                  className={`mt-4 w-full ${ui.buttonPrimary} disabled:bg-gray-300`}
                >
                  {!item.can_purchase
                    ? "默认物品"
                    : buyingTemplateId === item.template.id
                      ? "购买中..."
                      : "购买"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={`mt-6 ${ui.card} p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">家具库</h2>
          </div>

          {inventory.length === 0 ? (
            <div className={`${ui.cardGhost} border-[#ecd6b7] bg-orange-50/60 px-5 py-6 text-sm text-amber-700`}>
              还没有已拥有家具。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-orange-100 bg-[#fffaf4] px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {SPRITE_EMOJI[item.template.sprite_key] ?? "?"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.template.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[item.template.category] ??
                          item.template.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">数量</p>
                    <p className="text-lg font-semibold text-amber-900">
                      {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
