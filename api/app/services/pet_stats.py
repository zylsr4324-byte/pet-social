from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Pet

# Per-hour stat changes.
FULLNESS_DECAY_PER_HOUR = 5
HYDRATION_DECAY_PER_HOUR = 8
ENERGY_RECOVERY_PER_HOUR = 10
CLEANLINESS_DECAY_PER_HOUR = 3
INTROVERTED_PERSONALITY_KEYWORDS = (
    "\u9ad8\u51b7",
    "\u5185\u5411",
    "\u5b89\u9759",
    "\u6162\u70ed",
    "\u5bb3\u7f9e",
    "\u72ec\u7acb",
    "\u8c28\u614e",
    "\u51b7\u6de1",
    "introvert",
    "introverted",
    "quiet",
    "shy",
    "reserved",
    "aloof",
    "independent",
)
EXTROVERTED_PERSONALITY_KEYWORDS = (
    "\u6d3b\u6cfc",
    "\u5916\u5411",
    "\u4eb2\u4eba",
    "\u9ecf\u4eba",
    "\u6492\u5a07",
    "\u70ed\u60c5",
    "\u597d\u52a8",
    "\u793e\u725b",
    "\u597d\u5947",
    "extrovert",
    "extroverted",
    "outgoing",
    "friendly",
    "playful",
    "energetic",
    "curious",
    "social",
)


def project_current_stats(pet: Pet) -> dict:
    """Compute projected current stats without mutating the pet or writing to the DB."""
    now = datetime.now(timezone.utc)
    elapsed_hours = (
        now - pet.stats_updated_at.replace(tzinfo=timezone.utc)
    ).total_seconds() / 3600

    return {
        "fullness": max(0, pet.fullness - int(elapsed_hours * FULLNESS_DECAY_PER_HOUR)),
        "hydration": max(
            0, pet.hydration - int(elapsed_hours * HYDRATION_DECAY_PER_HOUR)
        ),
        "energy": min(100, pet.energy + int(elapsed_hours * ENERGY_RECOVERY_PER_HOUR)),
        "cleanliness": max(
            0, pet.cleanliness - int(elapsed_hours * CLEANLINESS_DECAY_PER_HOUR)
        ),
        "affection": pet.affection,
    }


def calculate_mood(
    fullness: int, hydration: int, energy: int, cleanliness: int, affection: int
) -> str:
    if fullness < 20 or hydration < 20:
        return "sad"
    if cleanliness < 30:
        return "uncomfortable"
    if affection > 80 and energy > 60:
        return "happy"
    return "normal"


def _coerce_stat_value(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _get_current_social_intent_stats(pet: Pet) -> dict[str, int]:
    try:
        projected = project_current_stats(pet)
    except (AttributeError, TypeError, ValueError):
        projected = {}

    return {
        "fullness": clamp(
            _coerce_stat_value(projected.get("fullness", getattr(pet, "fullness", 100)), 100)
        ),
        "hydration": clamp(
            _coerce_stat_value(
                projected.get("hydration", getattr(pet, "hydration", 100)),
                100,
            )
        ),
        "energy": clamp(
            _coerce_stat_value(projected.get("energy", getattr(pet, "energy", 100)), 100)
        ),
        "cleanliness": clamp(
            _coerce_stat_value(
                projected.get("cleanliness", getattr(pet, "cleanliness", 100)),
                100,
            )
        ),
        "affection": clamp(
            _coerce_stat_value(projected.get("affection", getattr(pet, "affection", 50)), 50)
        ),
    }


def _contains_personality_keyword(personality: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in personality for keyword in keywords)


def evaluate_social_intent(pet: Pet) -> str:
    """Return a social intent label derived from the pet's current state."""
    stats = _get_current_social_intent_stats(pet)

    if stats["energy"] < 30 or stats["fullness"] < 30:
        return "ignore_social_and_rest"

    if stats["cleanliness"] < 30:
        return "groom_self"

    if stats["affection"] < 40 and stats["energy"] > 60:
        return "seek_playmate"

    personality = getattr(pet, "personality", "")
    normalized_personality = (
        personality.strip().lower() if isinstance(personality, str) else ""
    )

    if _contains_personality_keyword(
        normalized_personality, INTROVERTED_PERSONALITY_KEYWORDS
    ):
        return "observe_silently"

    if _contains_personality_keyword(
        normalized_personality, EXTROVERTED_PERSONALITY_KEYWORDS
    ):
        return "explore_around"

    return "observe_silently"


def apply_decay_and_save(pet: Pet, db: Session) -> dict:
    """Apply decay to persisted stats and update the in-memory pet object."""
    projected = project_current_stats(pet)

    pet.fullness = projected["fullness"]
    pet.hydration = projected["hydration"]
    pet.energy = projected["energy"]
    pet.cleanliness = projected["cleanliness"]
    pet.affection = projected["affection"]
    pet.mood = calculate_mood(
        pet.fullness, pet.hydration, pet.energy, pet.cleanliness, pet.affection
    )
    pet.stats_updated_at = datetime.now(timezone.utc)

    return projected


def clamp(value: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, value))
