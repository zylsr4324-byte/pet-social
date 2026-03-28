from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Pet

# 每小时衰减/恢复速率
FULLNESS_DECAY_PER_HOUR = 5
HYDRATION_DECAY_PER_HOUR = 8
ENERGY_RECOVERY_PER_HOUR = 10
CLEANLINESS_DECAY_PER_HOUR = 3


def project_current_stats(pet: Pet) -> dict:
    """纯计算，不修改 pet 对象，不写库。"""
    now = datetime.now(timezone.utc)
    elapsed_hours = (now - pet.stats_updated_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600

    return {
        "fullness": max(0, pet.fullness - int(elapsed_hours * FULLNESS_DECAY_PER_HOUR)),
        "hydration": max(0, pet.hydration - int(elapsed_hours * HYDRATION_DECAY_PER_HOUR)),
        "energy": min(100, pet.energy + int(elapsed_hours * ENERGY_RECOVERY_PER_HOUR)),
        "cleanliness": max(0, pet.cleanliness - int(elapsed_hours * CLEANLINESS_DECAY_PER_HOUR)),
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


def apply_decay_and_save(pet: Pet, db: Session) -> dict:
    """在写操作前调用：结算衰减，更新 pet 对象并落库。
    返回结算后的属性字典，供调用方叠加操作效果。"""
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
