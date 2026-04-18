from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
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

    def test_high_energy_and_social_need_is_not_stuck_in_observe_silently(self):
        last_interaction_at = datetime.now(timezone.utc) - timedelta(hours=18)
        pet = build_pet(
            energy=88,
            affection=72,
            fullness=80,
            cleanliness=82,
            personality="quiet but curious",
            last_interaction_at=last_interaction_at,
        )

        self.assertNotEqual(evaluate_social_intent(pet), "observe_silently")

    def test_low_energy_or_hunger_still_prefers_rest(self):
        tired_pet = build_pet(energy=22, fullness=80, hydration=80, cleanliness=90)
        hungry_pet = build_pet(energy=85, fullness=20, hydration=80, cleanliness=90)

        self.assertEqual(evaluate_social_intent(tired_pet), "ignore_social_and_rest")
        self.assertEqual(evaluate_social_intent(hungry_pet), "ignore_social_and_rest")

    def test_extroverted_pet_is_more_likely_to_initiate_than_introverted_pet(self):
        extroverted_pet = build_pet(
            energy=78,
            affection=60,
            cleanliness=80,
            personality="outgoing, friendly, playful",
        )
        introverted_pet = build_pet(
            energy=78,
            affection=60,
            cleanliness=80,
            personality="quiet, shy, reserved",
        )

        self.assertIn(
            evaluate_social_intent(extroverted_pet),
            {"seek_playmate", "explore_around"},
        )
        self.assertEqual(evaluate_social_intent(introverted_pet), "observe_silently")

    def test_social_gap_pushes_pet_toward_more_active_intent(self):
        last_interaction_at = datetime.now(timezone.utc) - timedelta(hours=20)
        pet_with_gap = build_pet(
            energy=74,
            affection=68,
            cleanliness=78,
            personality="quiet but curious",
            last_interaction_at=last_interaction_at,
        )

        self.assertIn(
            evaluate_social_intent(pet_with_gap),
            {"seek_playmate", "explore_around"},
        )

    def test_without_social_target_context_pet_can_still_explore_without_forced_social_push(self):
        pet = build_pet(
            energy=70,
            affection=52,
            cleanliness=85,
            personality="curious but independent",
        )

        self.assertEqual(evaluate_social_intent(pet), "explore_around")

    def test_mildly_low_hydration_influences_rest_drive_without_overcorrecting(self):
        pet = build_pet(
            energy=82,
            fullness=78,
            hydration=32,
            cleanliness=84,
            affection=58,
            personality="outgoing and friendly",
        )

        self.assertEqual(evaluate_social_intent(pet), "explore_around")

    def test_curious_personality_keyword_still_pushes_toward_exploration(self):
        pet = build_pet(
            energy=70,
            fullness=82,
            hydration=76,
            cleanliness=88,
            affection=54,
            personality="好奇但独立",
        )

        self.assertEqual(evaluate_social_intent(pet), "explore_around")


if __name__ == "__main__":
    unittest.main()
