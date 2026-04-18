from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.pet_stats import evaluate_social_intent


def build_pet(**overrides: object) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    defaults = {
        "fullness": 80,
        "hydration": 80,
        "energy": 80,
        "cleanliness": 80,
        "affection": 60,
        "personality": "quiet and reserved",
        "stats_updated_at": now,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class EvaluateSocialIntentTests(unittest.TestCase):
    def test_returns_ignore_social_and_rest_when_too_tired(self):
        pet = build_pet(energy=20, affection=10, cleanliness=10)

        self.assertEqual(evaluate_social_intent(pet), "ignore_social_and_rest")

    def test_returns_ignore_social_and_rest_when_too_hungry(self):
        pet = build_pet(fullness=25, energy=90, affection=10)

        self.assertEqual(evaluate_social_intent(pet), "ignore_social_and_rest")

    def test_returns_groom_self_when_dirty(self):
        pet = build_pet(cleanliness=20, affection=10, energy=90)

        self.assertEqual(evaluate_social_intent(pet), "groom_self")

    def test_returns_seek_playmate_when_low_affection_and_has_energy(self):
        pet = build_pet(affection=30, energy=85, cleanliness=75, personality="aloof")

        self.assertEqual(evaluate_social_intent(pet), "seek_playmate")

    def test_returns_observe_silently_for_introverted_personality(self):
        pet = build_pet(personality="quiet, reserved, and slow to warm up")

        self.assertEqual(evaluate_social_intent(pet), "observe_silently")

    def test_returns_explore_around_for_extroverted_personality(self):
        pet = build_pet(personality="outgoing, playful, and friendly")

        self.assertEqual(evaluate_social_intent(pet), "explore_around")

    def test_falls_back_to_raw_stats_when_projection_cannot_run(self):
        pet = SimpleNamespace(
            fullness=80,
            hydration=80,
            energy=80,
            cleanliness=80,
            affection=80,
            personality="outgoing and playful",
        )

        self.assertEqual(evaluate_social_intent(pet), "explore_around")


if __name__ == "__main__":
    unittest.main()
