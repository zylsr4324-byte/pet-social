import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";

export type FurnitureTemplate = {
  id: number;
  name: string;
  category: string;
  width: number;
  height: number;
  sprite_key: string;
  interaction_action: string | null;
  effects: string;
};

export type PlacedFurniture = {
  id: number;
  pet_id: number;
  template: FurnitureTemplate;
  room: "living" | "bedroom" | "kitchen";
  tile_x: number;
  tile_y: number;
  rotation: 0 | 90 | 180 | 270;
  flipped: boolean;
  placed_at: string;
};

export type PlacedFurnitureListResponse = {
  items: PlacedFurniture[];
};

export type FurnitureTemplateListResponse = {
  templates: FurnitureTemplate[];
};

export type PlacedFurnitureResponse = PlacedFurniture;

export const isPlacedFurnitureListResponse = (v: unknown): v is PlacedFurnitureListResponse =>
  typeof v === "object" && v !== null && Array.isArray((v as PlacedFurnitureListResponse).items);

export const fetchFurnitureTemplates = async (): Promise<FurnitureTemplate[]> => {
  const res = await fetch(`${API_BASE_URL}/furniture/templates`);
  if (!res.ok) throw new Error("获取家具模板失败");
  const data: FurnitureTemplateListResponse = await res.json();
  return data.templates;
};

export const fetchPlacedFurniture = async (
  petId: number,
  token: string
): Promise<PlacedFurniture[]> => {
  const res = await fetch(`${API_BASE_URL}/pets/${petId}/furniture`, {
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) throw new Error("获取已放置家具失败");
  const data: PlacedFurnitureListResponse = await res.json();
  return data.items;
};

export const placeFurniture = async (
  petId: number,
  token: string,
  templateId: number,
  tileX: number,
  tileY: number,
  flipped = false,
  room: PlacedFurniture["room"] = "living",
  rotation: PlacedFurniture["rotation"] = 0
): Promise<PlacedFurniture> => {
  const res = await fetch(`${API_BASE_URL}/pets/${petId}/furniture`, {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({
      template_id: templateId,
      room,
      tile_x: tileX,
      tile_y: tileY,
      rotation,
      flipped,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "放置家具失败");
  }
  return res.json();
};

export const moveFurniture = async (
  petId: number,
  token: string,
  placedId: number,
  room: PlacedFurniture["room"],
  tileX: number,
  tileY: number,
  rotation: PlacedFurniture["rotation"],
  flipped: boolean
): Promise<PlacedFurniture> => {
  const res = await fetch(
    `${API_BASE_URL}/pets/${petId}/furniture/${placedId}`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(token, true),
      body: JSON.stringify({
        room,
        tile_x: tileX,
        tile_y: tileY,
        rotation,
        flipped,
      }),
    }
  );
  if (!res.ok) throw new Error("移动家具失败");
  return res.json();
};

export const removeFurniture = async (
  petId: number,
  token: string,
  placedId: number
): Promise<void> => {
  const res = await fetch(
    `${API_BASE_URL}/pets/${petId}/furniture/${placedId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    }
  );
  if (!res.ok) throw new Error("移除家具失败");
};

export const CATEGORY_LABELS: Record<string, string> = {
  food: "饮食",
  water: "饮水",
  bed: "休息",
  toy: "玩具",
  seating: "座椅",
  decoration: "装饰",
};

export const SPRITE_EMOJI: Record<string, string> = {
  bowl_food: "🥣",
  bowl_water: "💧",
  toy_ball: "🎾",
  pet_bed: "🛏",
  cat_tree: "🌳",
  sofa: "🛋",
  rug: "🪆",
  plant: "🪴",
};
