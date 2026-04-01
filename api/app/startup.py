import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.services.auto_social import run_auto_social_tick, run_decay_tick

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def run_startup() -> None:
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(run_decay_tick, "interval", minutes=10, id="decay_tick")
    _scheduler.add_job(run_auto_social_tick, "interval", minutes=30, id="auto_social_tick")
    _scheduler.start()
    logger.info("APScheduler started: decay every 10m, auto_social every 30m")


def run_shutdown() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler shutdown")
