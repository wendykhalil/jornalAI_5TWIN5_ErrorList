import { useCallback, useEffect, useState } from "react"
import { useStore } from "../../../store/AppStore"
import { goalsService } from "../../../services/goalsService"

export function useGoalsData() {
  const { notify } = useStore()
  const [goals, setGoals] = useState([])
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [goalItems, habitItems] = await Promise.all([
        goalsService.listGoals(),
        goalsService.listHabits(),
      ])
      const habitsWithChecks = await Promise.all(
        habitItems.map(async (habit) => ({
          ...habit,
          checks: await goalsService.listChecks(habit.id),
        })),
      )
      setGoals(goalItems)
      setHabits(habitsWithChecks)
    } catch (error) {
      notify(error.message, "error")
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    reload()
  }, [reload])

  return { goals, habits, loading, reload, setHabits }
}
