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
CURIOUS_PERSONALITY_KEYWORDS = (
    "\u597d\u5947",
    "curious",
)
SOCIAL_INTENT_LOW_ENERGY_THRESHOLD = 30
SOCIAL_INTENT_LOW_FULLNESS_THRESHOLD = 30
SOCIAL_INTENT_LOW_HYDRATION_THRESHOLD = 25
SOCIAL_INTENT_LOW_CLEANLINESS_THRESHOLD = 30
SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD = 65
SOCIAL_INTENT_HIGH_AFFECTION_THRESHOLD = 65
SOCIAL_INTENT_LOW_AFFECTION_THRESHOLD = 40
SOCIAL_INTENT_REST_HYDRATION_THRESHOLD = 40
SOCIAL_INTENT_SOCIAL_WINDOW_HOURS = 12
SOCIAL_INTENT_LONG_SOCIAL_WINDOW_HOURS = 24
SOCIAL_INTENT_ACTIVE_SOCIAL_DRIVE_THRESHOLD = 60
SOCIAL_INTENT_ACTIVE_CURIOSITY_DRIVE_THRESHOLD = 50
SOCIAL_INTENT_OBSERVE_THRESHOLD = 40


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


def _coerce_recent_hours_since_social(pet: Pet) -> float | None:
    timestamp = getattr(pet, "last_interaction_at", None)
    if not isinstance(timestamp, datetime):
        return None

    normalized_timestamp = (
        timestamp.replace(tzinfo=timezone.utc)
        if timestamp.tzinfo is None
        else timestamp.astimezone(timezone.utc)
    )
    return (datetime.now(timezone.utc) - normalized_timestamp).total_seconds() / 3600


def _has_recent_social_gap(pet: Pet, *, hours: int) -> bool:
    elapsed_hours = _coerce_recent_hours_since_social(pet)
    if elapsed_hours is None:
        return False
    return elapsed_hours >= hours


def evaluate_social_intent(pet: Pet) -> str:
    """Return a social intent label derived from the pet's current state."""
    stats = _get_current_social_intent_stats(pet)

    if (
        stats["energy"] < SOCIAL_INTENT_LOW_ENERGY_THRESHOLD
        or stats["fullness"] < SOCIAL_INTENT_LOW_FULLNESS_THRESHOLD
        or stats["hydration"] < SOCIAL_INTENT_LOW_HYDRATION_THRESHOLD
    ):
        return "ignore_social_and_rest"

    if stats["cleanliness"] < SOCIAL_INTENT_LOW_CLEANLINESS_THRESHOLD:
        return "groom_self"

    personality = getattr(pet, "personality", "")
    normalized_personality = (
        personality.strip().lower() if isinstance(personality, str) else ""
    )
    is_introverted = _contains_personality_keyword(
        normalized_personality,
        INTROVERTED_PERSONALITY_KEYWORDS,
    )
    is_extroverted = _contains_personality_keyword(
        normalized_personality,
        EXTROVERTED_PERSONALITY_KEYWORDS,
    )

    social_drive = 0
    curiosity_drive = 0
    rest_drive = (
        max(0, 100 - stats["energy"])
        + max(0, 45 - stats["fullness"])
        + max(0, SOCIAL_INTENT_REST_HYDRATION_THRESHOLD - stats["hydration"]) // 2
    )

    if stats["energy"] >= SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD:
        social_drive += 25
        curiosity_drive += 20
    if stats["energy"] >= 80:
        social_drive += 8
        curiosity_drive += 8

    if stats["affection"] <= SOCIAL_INTENT_LOW_AFFECTION_THRESHOLD:
        social_drive += 25
    elif stats["affection"] >= SOCIAL_INTENT_HIGH_AFFECTION_THRESHOLD:
        social_drive += 12
    else:
        curiosity_drive += 10

    if is_extroverted:
        social_drive += 6
        curiosity_drive += 16

    if is_introverted:
        social_drive -= 12
        curiosity_drive -= 12
        rest_drive += 8

    if _contains_personality_keyword(
        normalized_personality,
        CURIOUS_PERSONALITY_KEYWORDS,
    ):
        curiosity_drive += 10

    if _has_recent_social_gap(pet, hours=SOCIAL_INTENT_SOCIAL_WINDOW_HOURS):
        social_drive += 12

    if _has_recent_social_gap(pet, hours=SOCIAL_INTENT_LONG_SOCIAL_WINDOW_HOURS):
        curiosity_drive += 4

    if (
        stats["energy"] >= SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD
        and stats["affection"] >= SOCIAL_INTENT_HIGH_AFFECTION_THRESHOLD
    ):
        social_drive += 8

    if (
        stats["affection"] <= SOCIAL_INTENT_LOW_AFFECTION_THRESHOLD
        and stats["energy"] >= SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD
    ):
        social_drive += 10

    if (
        stats["affection"] <= SOCIAL_INTENT_LOW_AFFECTION_THRESHOLD
        and stats["energy"] >= SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD
    ):
        return "seek_playmate"

    if (
        is_introverted
        and not is_extroverted
        and curiosity_drive < SOCIAL_INTENT_ACTIVE_CURIOSITY_DRIVE_THRESHOLD
        and not _has_recent_social_gap(pet, hours=SOCIAL_INTENT_SOCIAL_WINDOW_HOURS)
    ):
        return "observe_silently"

    if (
        _has_recent_social_gap(pet, hours=SOCIAL_INTENT_SOCIAL_WINDOW_HOURS)
        and stats["energy"] >= SOCIAL_INTENT_HIGH_ENERGY_THRESHOLD
        and stats["affection"] >= SOCIAL_INTENT_HIGH_AFFECTION_THRESHOLD
        and social_drive >= curiosity_drive
    ):
        return "seek_playmate"

    if is_extroverted and curiosity_drive >= SOCIAL_INTENT_OBSERVE_THRESHOLD:
        return "explore_around"

    if curiosity_drive >= SOCIAL_INTENT_ACTIVE_CURIOSITY_DRIVE_THRESHOLD:
        return "explore_around"

    if social_drive >= SOCIAL_INTENT_ACTIVE_SOCIAL_DRIVE_THRESHOLD:
        return "seek_playmate"

    if rest_drive >= social_drive and rest_drive >= SOCIAL_INTENT_OBSERVE_THRESHOLD:
        return "observe_silently"

    if curiosity_drive >= SOCIAL_INTENT_OBSERVE_THRESHOLD:
        return "explore_around"

    if social_drive >= SOCIAL_INTENT_OBSERVE_THRESHOLD:
        return "seek_playmate"

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
