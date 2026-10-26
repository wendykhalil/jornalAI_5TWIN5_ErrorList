from .models import GoalProgress


def record_progress(goal):
    latest = goal.history.order_by("-created_at").first()
    if latest is None or latest.progress != goal.progress:
        return GoalProgress.objects.create(goal=goal, progress=goal.progress)
    return latest


def sync_progress_from_steps(goal):
    steps = list(goal.steps.all())
    if not steps:
        return goal

    done = sum(1 for step in steps if step.done)
    progress = round(done / len(steps) * 100)
    if done == len(steps):
        status = "completed"
    elif done:
        status = "in-progress"
    elif goal.status == "completed":
        status = "not-started"
    else:
        status = goal.status

    goal.progress = progress
    goal.status = status
    goal.save(update_fields=["progress", "status", "updated_at"])
    record_progress(goal)
    return goal
