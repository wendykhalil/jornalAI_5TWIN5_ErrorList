
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  habits as seedHabits,
  initialNotifications,
  moods as seedMoods,
  goals as seedGoals,
} from "../data/mockData"

import { memoryService } from "../services/memoryService"
import { journalService } from "../services/journalService"
import { mediaService } from "../services/mediaService"
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
  // MEDIA
  // =========================

  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setMedia([])
      return
    }

    let active = true

    const loadMedia = async () => {
      setMediaLoading(true)

      try {
        const mediaList = await mediaService.getMedia()

        if (!active) return

        setMedia(mediaList)
      } catch (error) {
        console.error("Failed to load media:", error)
      } finally {
        if (active) {
          setMediaLoading(false)
        }
      }
    }

    loadMedia()

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id])

  const refreshMedia = async () => {
    setMediaLoading(true)

    try {
      const mediaList = await mediaService.getMedia()
      setMedia(mediaList)
      return mediaList
    } catch (error) {
      console.error("Failed to refresh media:", error)
      throw error
    } finally {
      setMediaLoading(false)
    }
  }

  const uploadMedia = async (file, title, mediaType, description) => {
    try {
      const uploadedMedia = await mediaService.uploadMedia(
        file,
        title,
        mediaType,
        description
      )
      setMedia((previous) => [uploadedMedia, ...previous])
      return uploadedMedia
    } catch (error) {
      console.error("Failed to upload media:", error)
      throw error
    }
  }

  const [moods, setMoods] = useState(() =>
    stored("mindlog_moods", seedMoods)
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
          // Token exists. Validate it with the backend.
          const currentUser =
            await authService.getCurrentUser()

          if (!active) return

          setUser(currentUser)
          setIsAuthenticated(true)
          authService.setCachedUser(currentUser)
        } else {
          if (!active) return

          // No valid token. Clear all auth state and cached user.
          setUser(null)
          setIsAuthenticated(false)
          authService.clearAuth()
        }
      } catch (error) {
        console.error(
          "Failed to load current user:",
          error
        )

        if (!active) return

        // Token validation failed. Clear all auth data.
        setUser(null)
        setIsAuthenticated(false)
        setAuthError(error.message)
        authService.clearAuth()
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
    if (!isAuthenticated) {
      setMemories([])
      return
    }

    let active = true

    const loadMemories = async () => {
      try {
        const memories = await memoryService.getMemories(media)

        if (!active) return

        setMemories(memories)
      } catch (error) {
        console.error("Failed to load memories:", error)
      }
    }

    loadMemories()

    return () => {
      active = false
    }
  }, [isAuthenticated, user?.id, media])

  const refreshMemories = async () => {
    try {
      const memories = await memoryService.getMemories(media)
      setMemories(memories)
      return memories
    } catch (error) {
      console.error("Failed to refresh memories:", error)
      throw error
    }
  }

  const createMemory = async (data) => {
    const memory = await memoryService.createMemory(data, media)
    setMemories((previous) => [memory, ...previous])
    return memory
  }

  const updateMemory = async (id, data) => {
    const memory = await memoryService.updateMemory(id, data, media)
    setMemories((previous) =>
      previous.map((m) =>
        String(m.id) === String(id) ? memory : m
      )
    )
    return memory
  }

  const deleteMemory = async (id) => {
    await memoryService.deleteMemory(id)
    setMemories((previous) =>
      previous.filter((m) => String(m.id) !== String(id))
    )
  }

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
        
        // Return the fresh user object from getCurrentUser(), not the login response
        return { user: currentUser }
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
      createMemory,
      updateMemory,
      deleteMemory,

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
      mediaLoading,
      refreshMedia,
      uploadMedia,

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
