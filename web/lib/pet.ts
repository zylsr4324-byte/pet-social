import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";

export type PetProfile = {
  petName: string;
  species: string;
  color: string;
  size: string;
  personality: string;
  specialTraits: string;
};

export type ApiPet = PetProfile & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type PetApiResponse = {
  message: string;
  pet: ApiPet;
};

export type PetListResponse = {
  message: string;
  pets: ApiPet[];
};

export type PetRecoveryResult = {
  pet: ApiPet | null;
  unauthorized: boolean;
  errorMessage: string | null;
};

export const PET_ID_STORAGE_KEY = "pet-agent-social:pet-id";
export const LEGACY_PET_STORAGE_KEY = "pet-agent-social:pet-profile";

export const EMPTY_PET: PetProfile = {
  petName: "",
  species: "",
  color: "",
  size: "",
  personality: "",
  specialTraits: "",
};

export const isPetProfile = (value: unknown): value is PetProfile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pet = value as Record<string, unknown>;

  return (
    typeof pet.petName === "string" &&
    typeof pet.species === "string" &&
    typeof pet.color === "string" &&
    typeof pet.size === "string" &&
    typeof pet.personality === "string" &&
    typeof pet.specialTraits === "string"
  );
};

export const isPetApiResponse = (value: unknown): value is PetApiResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    isPetProfile(response.pet) &&
    typeof (response.pet as { id?: unknown }).id === "number"
  );
};

export const isPetListResponse = (value: unknown): value is PetListResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    Array.isArray(response.pets) &&
    response.pets.every(isPetProfile) &&
    response.pets.every((pet) => typeof (pet as { id?: unknown }).id === "number")
  );
};

export const mapApiPetToProfile = (pet: ApiPet): PetProfile => ({
  petName: pet.petName,
  species: pet.species,
  color: pet.color,
  size: pet.size,
  personality: pet.personality,
  specialTraits: pet.specialTraits,
});

export const clearStoredPetId = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PET_ID_STORAGE_KEY);
};

export const writeStoredPetId = (petId: number) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PET_ID_STORAGE_KEY, String(petId));
};

export const readStoredPetId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedPetId = window.localStorage.getItem(PET_ID_STORAGE_KEY);

  if (!storedPetId) {
    return null;
  }

  const parsedPetId = Number(storedPetId);

  if (Number.isInteger(parsedPetId) && parsedPetId > 0) {
    return parsedPetId;
  }

  clearStoredPetId();
  return null;
};

export const clearLegacyPetProfile = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_PET_STORAGE_KEY);
};

export const readLegacyPetProfile = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedPet = window.localStorage.getItem(LEGACY_PET_STORAGE_KEY);

    if (!storedPet) {
      return null;
    }

    const parsedPet = JSON.parse(storedPet);
    return isPetProfile(parsedPet) ? parsedPet : null;
  } catch {
    return null;
  }
};

export const getResponseErrorMessage = async (
  response: Response,
  fallbackMessage: string
) => {
  try {
    const data = await response.json();

    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
};

export const fetchLatestPetForCurrentUser = async (
  token: string,
  fallbackMessage: string
): Promise<PetRecoveryResult> => {
  const response = await fetch(`${API_BASE_URL}/pets`, {
    cache: "no-store",
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    return {
      pet: null,
      unauthorized: true,
      errorMessage: null,
    };
  }

  if (!response.ok) {
    return {
      pet: null,
      unauthorized: false,
      errorMessage: await getResponseErrorMessage(response, fallbackMessage),
    };
  }

  const data: unknown = await response.json();

  if (!isPetListResponse(data)) {
    return {
      pet: null,
      unauthorized: false,
      errorMessage: fallbackMessage,
    };
  }

  return {
    pet: data.pets[0] ?? null,
    unauthorized: false,
    errorMessage: null,
  };
};

export const recoverLatestPetForCurrentUser = async (
  token: string,
  fallbackMessage: string
) => {
  const result = await fetchLatestPetForCurrentUser(token, fallbackMessage);

  if (result.pet) {
    writeStoredPetId(result.pet.id);
  }

  return result;
};
