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
import authService from "../services/authService"

const StoreContext = createContext(null)
const stored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

export function AppStore({ children }) {
  // Authentication state
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Application data state
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

  // Load current user on app startup
  useEffect(() => {
    const loadCurrentUser = async () => {
      setAuthLoading(true)
      try {
        if (authService.isAuthenticated()) {
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          setIsAuthenticated(true)
          authService.setCachedUser(currentUser)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("Failed to load current user:", error)
        setUser(null)
        setIsAuthenticated(false)
        setAuthError(error.message)
      } finally {
        setAuthLoading(false)
      }
    }

    loadCurrentUser()
  }, [])

  // Load memories data
  useEffect(() => {
    memoryService.getMemories().then(setMemories)
  }, [])

  // Update theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("mindlog_theme", theme)
  }, [theme])

  // Persist application data to localStorage
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

  // Notification helper
  const notify = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2800)
  }

  // Memory refresh helper
  const refreshMemories = () => memoryService.getMemories().then(setMemories)

  // Authentication helpers
  const login = async (usernameOrEmail, password) => {
    try {
      setAuthError(null)
      const response = await authService.login(usernameOrEmail, password)
      if (response.user) {
        // Fetch fresh user data from API to ensure it matches the JWT
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
        authService.setCachedUser(currentUser)
        notify("Logged in successfully", "success")
      }
      return response
    } catch (error) {
      setAuthError(error.message)
      notify(error.message, "error")
      throw error
    }
  }

  const register = async (userData) => {
    try {
      setAuthError(null)
      const response = await authService.register(userData)
      notify("Account created successfully. Please log in.", "success")
      return response
    } catch (error) {
      setAuthError(error.message)
      notify(error.message, "error")
      throw error
    }
  }

  const logout = async () => {
    try {
      // Call backend logout
      await authService.logout()
      // Clear AppStore state
      setUser(null)
      setIsAuthenticated(false)
      setAuthError(null)
      notify("Logged out successfully", "success")
    } catch (error) {
      console.error("Logout error:", error)
      // Still clear local state even if backend fails
      setUser(null)
      setIsAuthenticated(false)
      setAuthError(null)
      notify("Logged out successfully", "success")
    }
  }

  const value = useMemo(
    () => ({
      // Auth state
      user,
      isAuthenticated,
      authLoading,
      authError,
      login,
      register,
      logout,

      // App data state
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
      user,
      isAuthenticated,
      authLoading,
      authError,
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

