import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"

const MEMORIES_URL = `${API_BASE_URL}/memories/`

/**
 * Format API error messages
 */
function errorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value)

        return `${field}: ${message}`
      })
      .join(" | ")
  }

  return fallback
}

/**
 * Authenticated API request for memories
 */
async function memoryRequest(
  endpoint = "",
  options = {},
  retry = true
) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(
    `${MEMORIES_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    }
  )

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()

    if (refreshed) {
      return memoryRequest(endpoint, options, false)
    }

    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))

    throw new Error(
      errorMessage(data, `Erreur HTTP ${response.status}`)
    )
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

/**
 * Map backend API response to frontend data structure
 * Backend uses snake_case; frontend uses camelCase
 */
function mapBackendToFrontend(apiMemory, mediaArray = []) {
  if (!apiMemory) return null

  // Try to find media IDs that match the cover URL
  let mediaIds = []
  if (apiMemory.cover && mediaArray.length > 0) {
    const matchingMedia = mediaArray.find((m) => m.url === apiMemory.cover)
    if (matchingMedia) {
      mediaIds = [String(matchingMedia.id)]
    }
    // Note: If matching fails, mediaIds stays empty but cover is preserved below
  }

  return {
    id: apiMemory.id,
    title: apiMemory.title,
    description: apiMemory.description,
    eventDate: apiMemory.event_date,
    location: apiMemory.location || "",
    category: apiMemory.category,
    importance: apiMemory.importance,
    tags: apiMemory.tags || [],
    cover: apiMemory.cover || null,
    favorite: apiMemory.favorite,
    aiSummary: apiMemory.ai_summary || "",
    relatedJournalEntryId: apiMemory.related_journal_entry || null,
    mediaIds: mediaIds,
    createdAt: apiMemory.created_at,
    updatedAt: apiMemory.updated_at,
  }
}

/**
 * Map frontend form data to backend API structure
 * @param {Object} formData - Frontend form state
 * @param {Array} mediaArray - Optional array of media objects to find cover URL from mediaIds
 */
function mapFrontendToBackend(formData, mediaArray = []) {
  // Use explicit cover field if set, otherwise derive from mediaIds
  let coverUrl = formData.cover || null
  
  if (!coverUrl && formData.mediaIds && formData.mediaIds.length > 0 && mediaArray.length > 0) {
    // Find the first selected media and get its URL
    const firstMediaId = formData.mediaIds[0]
    const firstMedia = mediaArray.find(
      (m) => String(m.id) === String(firstMediaId)
    )
    if (firstMedia && firstMedia.url) {
      coverUrl = firstMedia.url
    }
  }

  return {
    title: formData.title,
    description: formData.description,
    event_date: formData.eventDate,
    location: formData.location || "",
    category: formData.category,
    importance: formData.importance,
    tags: formData.tags || [],
    cover: coverUrl,
    favorite: formData.favorite || false,
    related_journal_entry: formData.relatedJournalEntryId || null,
    // mediaIds, aiSummary, createdAt, updatedAt not sent to API
  }
}

export const memoryService = {
  /**
   * Fetch all memories (supports pagination)
   * Backend returns paginated: { count, next, previous, results: [...] }
   * or array directly
   */
  getMemories: async (mediaArray = []) => {
    const response = await memoryRequest()

    // Support both paginated and direct array responses
    if (Array.isArray(response)) {
      return response.map((m) => mapBackendToFrontend(m, mediaArray))
    }

    // Paginated response: return all results mapped
    const memories = (response?.results || []).map((m) =>
      mapBackendToFrontend(m, mediaArray)
    )
    return memories
  },

  /**
   * Fetch a single memory by ID
   */
  getMemoryById: (id, mediaArray = []) => {
    return memoryRequest(`${encodeURIComponent(id)}/`).then((m) =>
      mapBackendToFrontend(m, mediaArray)
    )
  },

  /**
   * Create a new memory
   */
  createMemory: (formData, mediaArray = []) => {
    return memoryRequest("", {
      method: "POST",
      body: JSON.stringify(mapFrontendToBackend(formData, mediaArray)),
    }).then((m) => mapBackendToFrontend(m, mediaArray))
  },

  /**
   * Update an existing memory (PATCH for partial updates)
   */
  updateMemory: (id, formData, mediaArray = []) => {
    return memoryRequest(`${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(mapFrontendToBackend(formData, mediaArray)),
    }).then((m) => mapBackendToFrontend(m, mediaArray))
  },

  /**
   * Delete a memory
   */
  deleteMemory: (id) => {
    return memoryRequest(`${encodeURIComponent(id)}/`, {
      method: "DELETE",
    })
  },

  /**
   * Search memories by query string
   * Frontend-side filtering: load all and filter locally
   */
  searchMemories: async (query) => {
    const all = await memoryService.getMemories()
    const q = query
      .toLowerCase()
      .replace("vacances", "voyages")
      .replace("université", "études")

    return all.filter((x) =>
      [x.title, x.description, x.location, x.category, ...x.tags]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  },

  /**
   * Get memories for a date range
   * Frontend-side filtering: load all and filter locally
   */
  getMemoriesByPeriod: async (start, end) => {
    const all = await memoryService.getMemories()
    return all.filter((x) => x.eventDate >= start && x.eventDate <= end)
  },

  /**
   * Get similar memories (same category or shared tags)
   * Frontend-side filtering: load all and filter locally
   */
  getSimilarMemories: async (id) => {
    const all = await memoryService.getMemories()
    const current = all.find((x) => x.id === id)

    if (!current) return []

    return all
      .filter(
        (x) =>
          x.id !== id &&
          (x.category === current.category ||
            x.tags.some((t) => current.tags.includes(t))),
      )
      .slice(0, 4)
  },

  /**
   * Suggest a category based on text
   * Simulated: rules-based suggestion
   */
  suggestMemoryCategory: (text) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const suggested = /campus|étude|examen|projet/i.test(text)
          ? "Études"
          : /plage|voyage|mer/i.test(text)
            ? "Voyages"
            : "Événements personnels"
        resolve(suggested)
      }, 650)
    })
  },

  /**
   * Suggest tags based on text
   * Simulated: extract words from text
   */
  suggestMemoryTags: (text) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const tags = [
          ...new Set(
            (text.toLowerCase().match(/[a-zà-ÿ]{5,}/g) || []).slice(0, 4),
          ),
        ]
        resolve(tags)
      }, 650)
    })
  },
}
