"use client";

import { useEffect, useState } from "react";
import { buildAuthHeaders } from "./auth";
import { API_BASE_URL } from "./constants";
import { isPetListResponse, writeStoredPetId, type ApiPet } from "./pet";

type PetSwitcherProps = {
  currentPetId: number | null;
  authToken: string;
  onPetSwitch: (petId: number) => void;
};

export function PetSwitcher({
  currentPetId,
  authToken,
  onPetSwitch,
}: PetSwitcherProps) {
  const [pets, setPets] = useState<ApiPet[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchPets = async () => {
      const response = await fetch(`${API_BASE_URL}/pets`, {
        cache: "no-store",
        headers: buildAuthHeaders(authToken),
      });

      if (!response.ok) return;

      const data: unknown = await response.json();
      if (isPetListResponse(data)) {
        setPets(data.pets);
      }
    };

    fetchPets();
  }, [authToken]);

  const handleSwitch = (petId: number) => {
    writeStoredPetId(petId);
    onPetSwitch(petId);
    setIsOpen(false);
  };

  if (pets.length <= 1) return null;

  const currentPet = pets.find((p) => p.id === currentPetId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        {currentPet ? currentPet.petName : "选择宠物"} ▼
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
          {pets.map((pet) => (
            <button
              key={pet.id}
              onClick={() => handleSwitch(pet.id)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 ${
                pet.id === currentPetId ? "bg-blue-50 font-semibold" : ""
              }`}
            >
              {pet.petName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
