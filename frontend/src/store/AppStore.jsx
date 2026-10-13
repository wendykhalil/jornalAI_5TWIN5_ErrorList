import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  habits as seedHabits,
  initialMedia,
  initialNotifications,
  journals as seedJournals,
  moods as seedMoods,
  goals as seedGoals,
} from "../data/mockData"
import { memoryService } from "../services/memoryService"

const StoreContext = createContext(null)
const stored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}
export function AppStore({ children }) {
  const [memories, setMemories] = useState([])
  const [journals, setJournals] = useState(() =>
    stored("mindlog_journals", seedJournals),
  )
  const [moods, setMoods] = useState(() => stored("mindlog_moods", seedMoods))
  const [media, setMedia] = useState(() =>
    stored("mindlog_media", initialMedia),
  )
  const [goals, setGoals] = useState(() => stored("mindlog_goals", seedGoals))
  const [habits, setHabits] = useState(() =>
    stored("mindlog_habits", seedHabits),
  )
  const [notifications, setNotifications] = useState(() =>
    stored("mindlog_notifications", initialNotifications),
  )
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(
    () => localStorage.getItem("mindlog_theme") || "light",
  )
  useEffect(() => {
    memoryService.getMemories().then(setMemories)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("mindlog_theme", theme)
  }, [theme])
  useEffect(() => {
    const values = {
      mindlog_journals: journals,
      mindlog_moods: moods,
      mindlog_media: media,
      mindlog_goals: goals,
      mindlog_habits: habits,
      mindlog_notifications: notifications,
    }
    Object.entries(values).forEach(([k, v]) =>
      localStorage.setItem(k, JSON.stringify(v)),
    )
  }, [journals, moods, media, goals, habits, notifications])
  const notify = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2800)
  }
  const refreshMemories = () => memoryService.getMemories().then(setMemories)
  const value = useMemo(
    () => ({
      memories,
      refreshMemories,
      journals,
      setJournals,
      moods,
      setMoods,
      media,
      setMedia,
      goals,
      setGoals,
      habits,
      setHabits,
      notifications,
      setNotifications,
      toast,
      notify,
      theme,
      setTheme,
    }),
    [
      memories,
      journals,
      moods,
      media,
      goals,
      habits,
      notifications,
      toast,
      theme,
    ],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export const useStore = () => useContext(StoreContext)
