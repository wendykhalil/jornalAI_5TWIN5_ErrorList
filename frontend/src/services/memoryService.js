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
    draft: apiMemory.draft || false,
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
    draft: formData.draft || false,
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
   * Search memories using intelligent backend search with Ollama expansion
   * 
   * Takes a natural language query, sends it to backend which:
   * 1. Uses Ollama to expand query with synonyms and related terms
   * 2. Calculates relevance scores for matching memories
   * 3. Returns ranked results
   * 
   * @param {string} query - Natural language search query
   * @returns {Promise<Object>} { query, results: [...], count, expansion: {...}, search_method }
   * @throws {Error} If query empty, network error, or search service unavailable
   */
  intelligentSearch: async (query) => {
    if (!query || !query.trim()) {
      throw new Error("Query is required")
    }

    try {
      const response = await memoryRequest("ai/search/", {
        method: "POST",
        body: JSON.stringify({ query: query.trim() }),
      })
      
      // Transform results from snake_case (backend) to camelCase (frontend)
      // Backend MemorySerializer returns event_date, ai_summary, related_journal_entry in snake_case
      if (response.results && Array.isArray(response.results)) {
        response.results = response.results.map(result => 
          mapBackendToFrontend(result, [])
        )
      }
      
      return response
    } catch (error) {
      // Re-throw with user-friendly message
      if (error.message.includes("timeout")) {
        throw new Error("Search timed out. Try again.")
      }
      if (error.message.includes("unavailable")) {
        throw new Error("Search service is unavailable. Try again later.")
      }
      throw error
    }
  },

  /**
   * Search memories by query string (classical client-side fallback)
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
   * Get similar memories based on shared category, tags, and location.
   * Frontend-side filtering: load all and filter locally.
   * Ranks by relevance: shared category, number of shared tags, matching location.
   * 
   * @param {string} id - Memory ID to find similar memories for
   * @returns {Promise<Array>} - Up to 4 similar memories, ranked by relevance
   */
  getSimilarMemories: async (id) => {
    const all = await memoryService.getMemories()
    const current = all.find((x) => x.id === id)

    if (!current) return []

    // Calculate relevance score for each potential match
    const scored = all
      .filter((x) => x.id !== id) // Exclude current memory
      .map((x) => {
        let score = 0
        
        // Category match (highest weight: 3 points)
        if (x.category === current.category) {
          score += 3
        }
        
        // Shared tags (1 point per shared tag, max 2)
        const sharedTagCount = x.tags.filter((t) =>
          current.tags.some((ct) => ct.toLowerCase().trim() === t.toLowerCase().trim())
        ).length
        score += Math.min(sharedTagCount, 2)
        
        // Location match: only if both non-empty and identical (case-insensitive)
        const currentLocation = (current.location || '').trim().toLowerCase()
        const xLocation = (x.location || '').trim().toLowerCase()
        if (currentLocation && xLocation && currentLocation === xLocation) {
          score += 1
        }
        
        return { memory: x, score }
      })
      .filter((item) => item.score > 0) // Only keep memories with at least one match
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, 4) // Take top 4
      .map((item) => item.memory) // Extract memory objects

    return scored
  },

  /**
   * Suggest a category based on description using real AI (Ollama)
   * 
   * @param {string} description - Memory description text
   * @returns {Promise<Object>} { suggested_category, confidence, reasoning }
   * @throws {Error} If description is empty, network error, or AI service unavailable
   */
  suggestMemoryCategory: async (description) => {
    if (!description || !description.trim()) {
      throw new Error("Description is required")
    }

    try {
      const response = await memoryRequest("ai/suggest-category/", {
        method: "POST",
        body: JSON.stringify({ description: description.trim() }),
      })
      return response
    } catch (error) {
      // Re-throw with user-friendly message
      if (error.message.includes("timeout")) {
        throw new Error("AI suggestion took too long. Try again.")
      }
      if (error.message.includes("unavailable")) {
        throw new Error("AI service is unavailable. Suggestions disabled.")
      }
      throw error
    }
  },

  /**
   * Suggest tags based on title and description using real AI (Ollama)
   * 
   * @param {string} title - Memory title
   * @param {string} description - Memory description text
   * @returns {Promise<Object>} { suggested_tags: [...], confidence }
   * @throws {Error} If inputs empty, network error, or AI service unavailable
   */
  suggestMemoryTags: async (title, description) => {
    if (!title || !title.trim()) {
      throw new Error("Title is required")
    }

    if (!description || !description.trim()) {
      throw new Error("Description is required")
    }

    try {
      const response = await memoryRequest("ai/suggest-tags/", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      })
      return response
    } catch (error) {
      // Re-throw with user-friendly message
      if (error.message.includes("timeout")) {
        throw new Error("AI suggestion took too long. Try again.")
      }
      if (error.message.includes("unavailable")) {
        throw new Error("AI service is unavailable. Suggestions disabled.")
      }
      throw error
    }
  },

  /**
   * Generate a concise AI summary for a memory using real AI (Ollama)
   * 
   * @param {string} title - Memory title
   * @param {string} description - Memory description text
   * @param {string} [category] - Optional memory category
   * @param {Array<string>} [tags] - Optional memory tags
   * @param {string} [location] - Optional memory location
   * @returns {Promise<Object>} { summary: string, model: string }
   * @throws {Error} If inputs empty, network error, or AI service unavailable
   */
  generateMemorySummary: async (title, description, category = null, tags = null, location = null) => {
    if (!title || !title.trim()) {
      throw new Error("Title is required")
    }

    if (!description || !description.trim()) {
      throw new Error("Description is required")
    }

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
      }
      
      if (category) {
        payload.category = category
      }
      if (tags && Array.isArray(tags) && tags.length > 0) {
        payload.tags = tags
      }
      if (location) {
        payload.location = location
      }
      
      const response = await memoryRequest("ai/generate-summary/", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      return response
    } catch (error) {
      // Re-throw with user-friendly message
      if (error.message.includes("timeout")) {
        throw new Error("Summary generation took too long. Try again.")
      }
      if (error.message.includes("unavailable")) {
        throw new Error("AI service is unavailable. Try again later.")
      }
      throw error
    }
  },
}
