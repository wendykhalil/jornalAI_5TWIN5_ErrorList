
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  habits as seedHabits,
  initialMedia,
  initialNotifications,
  moods as seedMoods,
  goals as seedGoals,
} from "../data/mockData"

import { memoryService } from "../services/memoryService"
import { journalService } from "../services/journalService"
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
  // =========================
  // AUTHENTICATION
  // =========================

  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // =========================
  // MEMORIES
  // =========================

  const [memories, setMemories] = useState([])

  // =========================
  // JOURNAL MANAGEMENT
  // =========================

  const [journals, setJournals] = useState([])
  const [journalsLoading, setJournalsLoading] = useState(false)

  // =========================
  // OTHER MODULES
  // =========================

  const [moods, setMoods] = useState(() =>
    stored("mindlog_moods", seedMoods)
  )

  const [media, setMedia] = useState(() =>
    stored("mindlog_media", initialMedia)
  )

  const [goals, setGoals] = useState(() =>
    stored("mindlog_goals", seedGoals)
  )

  const [habits, setHabits] = useState(() =>
    stored("mindlog_habits", seedHabits)
  )

  const [notifications, setNotifications] = useState(() =>
    stored("mindlog_notifications", initialNotifications)
  )

  const [toast, setToast] = useState(null)

  const [theme, setTheme] = useState(
    () => localStorage.getItem("mindlog_theme") || "light"
  )

  // =========================
  // LOAD CURRENT USER
  // =========================

  useEffect(() => {
    let active = true

    const loadCurrentUser = async () => {
      setAuthLoading(true)

      try {
        if (authService.isAuthenticated()) {
          const currentUser =
            await authService.getCurrentUser()

          if (!active) return

          setUser(currentUser)
          setIsAuthenticated(true)
          authService.setCachedUser(currentUser)
        } else {
          if (!active) return

          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error(
          "Failed to load current user:",
          error
        )

        if (!active) return

        setUser(null)
        setIsAuthenticated(false)
        setAuthError(error.message)
      } finally {
        if (active) {
          setAuthLoading(false)
        }
      }
    }

    loadCurrentUser()

    return () => {
      active = false
    }
  }, [])

  // =========================
  // MEMORIES
  // =========================

  useEffect(() => {
    if (!isAuthenticated) return

    memoryService
      .getMemories()
      .then(setMemories)
      .catch(console.error)
  }, [isAuthenticated])

  const refreshMemories = () =>
    memoryService.getMemories().then(setMemories)

  // =========================
  // JOURNAL MANAGEMENT
  // =========================

  const refreshJournals = async () => {
    setJournalsLoading(true)

    try {
      const entries = await journalService.getEntries()

      // Support standard DRF lists and paginated responses.
      const list = Array.isArray(entries)
        ? entries
        : entries?.results || []

      setJournals(list)

      return list
    } catch (error) {
      console.error(
        "Failed to load journal entries:",
        error
      )

      throw error
    } finally {
      setJournalsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setJournals([])
      return
    }

    let active = true

    const loadJournals = async () => {
      setJournalsLoading(true)

      try {
        const entries = await journalService.getEntries()

        if (!active) return

        setJournals(
          Array.isArray(entries)
            ? entries
            : entries?.results || []
        )
      } catch (error) {
        console.error(
          "Failed to load journals:",
          error
        )
      } finally {
        if (active) {
          setJournalsLoading(false)
        }
      }
    }

    loadJournals()

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id])

  const createJournal = async (data) => {
    const entry = await journalService.createEntry(data)

    setJournals((previous) => [entry, ...previous])

    return entry
  }

  const updateJournal = async (id, data) => {
    const entry = await journalService.updateEntry(id, data)

    setJournals((previous) =>
      previous.map((journal) =>
        String(journal.id) === String(id)
          ? entry
          : journal
      )
    )

    return entry
  }

  const deleteJournal = async (id) => {
    await journalService.deleteEntry(id)

    setJournals((previous) =>
      previous.filter(
        (journal) => String(journal.id) !== String(id)
      )
    )
  }

  // =========================
  // THEME
  // =========================

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    )

    localStorage.setItem("mindlog_theme", theme)
  }, [theme])

  // =========================
  // LOCAL STORAGE
  // =========================
  // Journal entries are no longer stored here.
  // Django/MySQL is their source of truth.

  useEffect(() => {
    Object.entries({
      mindlog_moods: moods,
      mindlog_media: media,
      mindlog_goals: goals,
      mindlog_habits: habits,
      mindlog_notifications: notifications,
    }).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
  }, [
    moods,
    media,
    goals,
    habits,
    notifications,
  ])

  // =========================
  // NOTIFICATIONS
  // =========================

  const notify = (message, type = "success") => {
    setToast({ message, type })

    setTimeout(() => {
      setToast(null)
    }, 2800)
  }

  // =========================
  // LOGIN
  // =========================

  const login = async (usernameOrEmail, password) => {
    try {
      setAuthError(null)

      const response = await authService.login(
        usernameOrEmail,
        password
      )

      if (response.user) {
        const currentUser =
          await authService.getCurrentUser()

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

  // =========================
  // REGISTER
  // =========================

  const register = async (userData) => {
    try {
      setAuthError(null)

      const response = await authService.register(userData)

      notify(
        "Account created successfully. Please log in."
      )

      return response
    } catch (error) {
      setAuthError(error.message)
      notify(error.message, "error")
      throw error
    }
  }

  // =========================
  // LOGOUT
  // =========================

  const logout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      setAuthError(null)
      setMemories([])
      setJournals([])

      notify("Logged out successfully")
    }
  }

  // =========================
  // PROFILE MANAGEMENT
  // =========================

  const updateUser = async (profileData) => {
    const updatedUser =
      await authService.updateProfile(profileData)

    setUser(updatedUser)

    authService.setCachedUser(updatedUser)

    return updatedUser
  }

  // =========================
  // GLOBAL STORE
  // =========================

  const value = useMemo(
    () => ({
      // Authentication
      user,
      isAuthenticated,
      authLoading,
      authError,
      login,
      register,
      logout,
      updateUser,

      // Memories
      memories,
      refreshMemories,

      // Journal
      journals,
      setJournals,
      journalsLoading,
      refreshJournals,
      createJournal,
      updateJournal,
      deleteJournal,

      // Mood
      moods,
      setMoods,

      // Media
      media,
      setMedia,

      // Goals
      goals,
      setGoals,

      // Habits
      habits,
      setHabits,

      // Notifications
      notifications,
      setNotifications,
      toast,
      notify,

      // Theme
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
      journalsLoading,
      moods,
      media,
      goals,
      habits,
      notifications,
      toast,
      theme,
    ]
  )

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
