import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  habits as seedHabits, initialMedia, initialNotifications,
  journals as seedJournals, moods as seedMoods, goals as seedGoals,
} from "../data/mockData"
import { memoryService } from "../services/memoryService"
import authService from "../services/authService"

const StoreContext = createContext(null)
const stored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}

export function AppStore({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [memories, setMemories] = useState([])
  const [journals, setJournals] = useState(() => stored("mindlog_journals", seedJournals))
  const [moods, setMoods] = useState(() => stored("mindlog_moods", seedMoods))
  const [media, setMedia] = useState(() => stored("mindlog_media", initialMedia))
  const [goals, setGoals] = useState(() => stored("mindlog_goals", seedGoals))
  const [habits, setHabits] = useState(() => stored("mindlog_habits", seedHabits))
  const [notifications, setNotifications] = useState(() => stored("mindlog_notifications", initialNotifications))
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem("mindlog_theme") || "light")

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
      } finally { setAuthLoading(false) }
    }
    loadCurrentUser()
  }, [])

  useEffect(() => { memoryService.getMemories().then(setMemories).catch(console.error) }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("mindlog_theme", theme)
  }, [theme])
  useEffect(() => {
    Object.entries({
      mindlog_journals: journals, mindlog_moods: moods, mindlog_media: media,
      mindlog_goals: goals, mindlog_habits: habits, mindlog_notifications: notifications,
    }).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
  }, [journals, moods, media, goals, habits, notifications])

  const notify = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2800)
  }
  const refreshMemories = () => memoryService.getMemories().then(setMemories)

  const login = async (usernameOrEmail, password) => {
    try {
      setAuthError(null)
      const response = await authService.login(usernameOrEmail, password)
      if (response.user) {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
        authService.setCachedUser(currentUser)
        notify("Logged in successfully")
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
      notify("Account created successfully. Please log in.")
      return response
    } catch (error) {
      setAuthError(error.message)
      notify(error.message, "error")
      throw error
    }
  }
  const logout = async () => {
    try { await authService.logout() }
    catch (error) { console.error("Logout error:", error) }
    finally {
      setUser(null)
      setIsAuthenticated(false)
      setAuthError(null)
      notify("Logged out successfully")
    }
  }
  const updateUser = async (profileData) => {
    const updatedUser = await authService.updateProfile(profileData)
    setUser(updatedUser)
    authService.setCachedUser(updatedUser)
    return updatedUser
  }

  const value = useMemo(() => ({
    user, isAuthenticated, authLoading, authError, login, register, logout, updateUser,
    memories, refreshMemories, journals, setJournals, moods, setMoods,
    media, setMedia, goals, setGoals, habits, setHabits,
    notifications, setNotifications, toast, notify, theme, setTheme,
  }), [user, isAuthenticated, authLoading, authError, memories, journals, moods,
    media, goals, habits, notifications, toast, theme])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export const useStore = () => useContext(StoreContext)
