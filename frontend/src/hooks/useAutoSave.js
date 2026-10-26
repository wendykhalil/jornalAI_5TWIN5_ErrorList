import { useEffect, useRef, useState, useCallback } from "react"
import { memoryService } from "../services/memoryService"

/**
 * useAutoSave: Automatically save form changes to backend with debounce and localStorage fallback
 *
 * @param {Object} form - Current form state
 * @param {Object} options - Configuration options
 * @param {number} options.debounceMs - Debounce delay in ms (default: 1000)
 * @param {string} options.userId - Authenticated user ID for localStorage scoping
 * @param {Array} options.media - Media array for cover URL mapping
 * @param {boolean} options.enabled - Whether auto-save is enabled (default: true)
 * @returns {Object} - { draftId, saveStatus, clearAutoSave }
 */
export function useAutoSave(form, options = {}) {
  const {
    debounceMs = 1000,
    userId,
    media = [],
    enabled = true,
  } = options

  // State tracking
  const [draftId, setDraftId] = useState(form.id || null)
  const [saveStatus, setSaveStatus] = useState("idle") // idle, saving, saved, failed
  const [lastSaveTime, setLastSaveTime] = useState(null)

  // Refs for managing debounce and request deduplication
  const debounceTimer = useRef(null)
  const lastSavedForm = useRef(null)
  const inFlightRequest = useRef(null)
  const requestCounter = useRef(0)

  /**
   * Save form to backend (create or update draft)
   */
  const performSave = useCallback(
    async (formData, isDraft = true) => {
      if (!enabled) return

      // Prevent overlapping requests
      if (inFlightRequest.current) {
        return
      }

      const currentRequestId = ++requestCounter.current

      try {
        setSaveStatus("saving")

        // First save: create new draft via POST
        if (!draftId) {
          const newDraft = await memoryService.createMemory(
            { ...formData, draft: isDraft },
            media
          )
          setDraftId(newDraft.id)
          lastSavedForm.current = formData
          setLastSaveTime(Date.now())
          setSaveStatus("saved")

          // Save to localStorage
          if (userId) {
            saveToLocalStorage(newDraft.id, formData, userId)
          }

          return newDraft.id
        }

        // Subsequent saves: update existing draft via PATCH
        const updatedDraft = await memoryService.updateMemory(
          draftId,
          { ...formData, draft: isDraft },
          media
        )

        // Ignore stale responses (only accept if this is still the current request)
        if (currentRequestId !== requestCounter.current) {
          return
        }

        lastSavedForm.current = formData
        setLastSaveTime(Date.now())
        setSaveStatus("saved")

        // Save to localStorage
        if (userId) {
          saveToLocalStorage(draftId, formData, userId)
        }
      } catch (error) {
        // Ignore stale request errors
        if (currentRequestId !== requestCounter.current) {
          return
        }

        console.error("Auto-save failed:", error)
        setSaveStatus("failed")

        // Save to localStorage as fallback
        if (userId && draftId) {
          saveToLocalStorage(draftId, formData, userId)
        }

        // Reset to idle after delay so user can see the error
        setTimeout(() => setSaveStatus("idle"), 3000)
      } finally {
        inFlightRequest.current = null
      }
    },
    [enabled, draftId, userId, media]
  )

  /**
   * Main auto-save effect: debounce form changes and save
   */
  useEffect(() => {
    if (!enabled) return

    // Don't save if form hasn't changed
    if (
      lastSavedForm.current &&
      JSON.stringify(lastSavedForm.current) === JSON.stringify(form)
    ) {
      return
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Set new debounce timer
    debounceTimer.current = setTimeout(() => {
      inFlightRequest.current = performSave(form, true)
    }, debounceMs)

    // Cleanup: clear timer on unmount
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [form, debounceMs, enabled, performSave])

  /**
   * Manually save to backend and clear auto-save state
   */
  const clearAutoSave = useCallback(() => {
    if (userId && draftId) {
      clearFromLocalStorage(draftId, userId)
    }
    setDraftId(null)
    lastSavedForm.current = null
    setLastSaveTime(null)
    setSaveStatus("idle")
  }, [userId, draftId])

  return {
    draftId,
    saveStatus,
    lastSaveTime,
    clearAutoSave,
  }
}

/**
 * Save form to localStorage for recovery
 */
export function saveToLocalStorage(draftId, formData, userId) {
  const key = `mindlog_memory_draft_${userId}_${draftId}`
  const data = {
    form: formData,
    timestamp: Date.now(),
    draftId,
  }
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn("Failed to save to localStorage:", e)
  }
}

/**
 * Load form from localStorage
 */
export function loadFromLocalStorage(draftId, userId) {
  const key = `mindlog_memory_draft_${userId}_${draftId}`
  try {
    const data = localStorage.getItem(key)
    if (data) {
      return JSON.parse(data)
    }
  } catch (e) {
    console.warn("Failed to load from localStorage:", e)
  }
  return null
}

/**
 * Clear form from localStorage
 */
export function clearFromLocalStorage(draftId, userId) {
  const key = `mindlog_memory_draft_${userId}_${draftId}`
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn("Failed to clear localStorage:", e)
  }
}

/**
 * Get all drafts for a user from localStorage
 */
export function getAllLocalDrafts(userId) {
  const prefix = `mindlog_memory_draft_${userId}_`
  const drafts = []

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const data = JSON.parse(localStorage.getItem(key))
        if (data && data.form && data.draftId) {
          drafts.push({
            draftId: data.draftId,
            form: data.form,
            timestamp: data.timestamp,
          })
        }
      }
    }
  } catch (e) {
    console.warn("Failed to read localStorage drafts:", e)
  }

  return drafts.sort((a, b) => b.timestamp - a.timestamp)
}
