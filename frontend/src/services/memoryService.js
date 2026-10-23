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
   * French stop words to exclude from keyword matching
   * These are common words that add no semantic value
   * @private
   */
  _FRENCH_STOP_WORDS: new Set([
    // Articles
    'avec', 'sans', 'dans', 'pour', 'par', 'sur', 'sous', 'entre',
    'vers', 'chez', 'depuis', 'pendant', 'après', 'avant', 'lors',
    // Common prepositions and conjunctions
    'mais', 'donc', 'soit', 'bien', 'très', 'plus', 'moins', 'tant',
    'comme', 'alors', 'aussi', 'encore', 'toujours', 'jamais',
    // Common adjectives/adverbs
    'autre', 'même', 'seul', 'tel', 'quel', 'nouveau', 'dernier',
    'premier', 'ancien', 'bon', 'mauvais', 'grand', 'petit', 'haut',
    'bas', 'long', 'court', 'large', 'étroit', 'fort', 'faible',
    'special', 'spéciale', 'délicieux', 'délicieuse', 'magnifique',
    'merveilleux', 'formidable', 'génial', 'fantastique', 'super',
    'incroyable', 'inoubliable', 'important', 'impossible', 'possible',
    // Common generic words
    'moment', 'jour', 'temps', 'heure', 'fois', 'chose', 'pied',
    'main', 'tête', 'cœur', 'envie', 'besoin', 'raison', 'façon',
    'sorte', 'genre', 'espèce', 'type', 'kind', 'sort', 'partie',
    'morceau', 'coin', 'endroit', 'pôle', 'place', 'espace', 'zone',
    'région', 'zone', 'aire', 'monde', 'univers', 'vie', 'mort',
    // Verbs (infinitive forms and conjugations)
    'avoir', 'être', 'faire', 'aller', 'venir', 'pouvoir', 'vouloir',
    'devoir', 'savoir', 'falloir', 'valoir', 'oser', 'daigner',
    'penser', 'croire', 'savoir', 'sentir', 'voir', 'entendre',
    'trouver', 'laisser', 'donner', 'prendre', 'mettre', 'porter',
    'apporter', 'emporter', 'garder', 'perdre', 'laisser', 'trouver',
    'passer', 'marcher', 'courir', 'venir', 'entrer', 'sortir',
    // Pronouns
    'nous', 'vous', 'elles', 'tous', 'aucun', 'quelque', 'certains',
    'plusieurs', 'chacun', 'chaque',
  ]),

  /**
   * Extract keywords from text for similarity matching
   * Filters out French stop words and very generic adjectives
   * Handles French accented characters (é, è, ê, à, ù, etc.)
   * @private
   */
  _extractKeywords: (text) => {
    if (!text) return []
    const STOP_WORDS = memoryService._FRENCH_STOP_WORDS
    return text
      .toLowerCase()
      // FIXED: Preserve French accented characters (àâäéèêëïîôùûüœæç)
      .replace(/[^\wàâäéèêëïîôùûüœæç\s-]/g, ' ') // Remove punctuation but keep accents
      .split(/\s+/)
      .filter((w) => w.length > 3) // Only words > 3 chars
      .filter((w) => !STOP_WORDS.has(w)) // Exclude stop words
      .filter((w, i, arr) => arr.indexOf(w) === i) // Deduplicate
  },

  /**
   * Calculate relevance score between two memories (0-1 range)
   * Uses multi-signal approach optimized to distinguish related from unrelated memories.
   * 
   * Scoring Strategy:
   * - Strong structural match (category + location): Foundation for recommendation
   * - Meaningful shared tags: Secondary signal confirming relationship
   * - Title/Description: Tertiary signal for exact or near-duplicate detection
   * - Description keyword threshold: ≥3 when category/location match (related context)
   *                                   ≥4 when category/location differ (must have strong content overlap)
   * 
   * This prevents:
   * - Birthday→AI project (different category/location, no content overlap)
   * - Bali→Birthday (different category/location, no content overlap)
   * While allowing:
   * - Birthday→Birthday duplicate (same category, location, tags, description)
   * - Bali→Bali duplicate (same category, location, tags, description)
   * - AI→WebExam (same category, location, shared tags)
   * 
   * @private
   */
  _calculateSimilarityScore: (current, candidate, debug = false) => {
    let score = 0
    const signals = {}
    
    // 1. CATEGORY MATCH (weight: 6)
    const categoryMatch = current.category === candidate.category
    if (categoryMatch) {
      score += 6
      signals.category = 6
    } else {
      signals.category = 0
    }
    
    // 2. LOCATION MATCH (weight: 8 - highest specificity)
    const currLoc = (current.location || '').trim().toLowerCase()
    const candLoc = (candidate.location || '').trim().toLowerCase()
    const locationMatch = currLoc && candLoc && currLoc === candLoc
    if (locationMatch) {
      score += 8
      signals.location = 8
    } else {
      signals.location = 0
    }
    
    // Determine if there is a structural match (used for description threshold)
    const hasStructuralMatch = categoryMatch || locationMatch
    
    // 3. TAG MATCHES (weight: 2 per tag, max 6)
    const currTagSet = new Set(
      (current.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean)
    )
    const candTagSet = new Set(
      (candidate.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean)
    )
    const sharedTags = [...currTagSet].filter((t) => candTagSet.has(t))
    const tagScore = Math.min(sharedTags.length * 2, 6)
    score += tagScore
    signals.tags = tagScore
    signals.sharedTagCount = sharedTags.length
    
    // 4. TITLE SIMILARITY (weight: 4)
    const currTitle = (current.title || '').toLowerCase()
    const candTitle = (candidate.title || '').toLowerCase()
    let titleScore = 0
    if (currTitle && candTitle && currTitle.length > 5 && candTitle.length > 5) {
      const currWords = memoryService._extractKeywords(currTitle)
      const candWords = memoryService._extractKeywords(candTitle)
      const sharedWords = currWords.filter((w) => candWords.includes(w))
      if (sharedWords.length > 0) {
        titleScore = 4
        score += titleScore
      }
    }
    signals.title = titleScore
    
    // 5. DESCRIPTION KEYWORD OVERLAP (weight: 6)
    // ADAPTIVE THRESHOLD: Stricter when categories/locations differ
    // - If category AND location match: threshold = ≥3 (related context)
    // - If category OR location match: threshold = ≥3 (some structural alignment)
    // - If neither match: threshold = ≥4 (must have strong content overlap)
    let descScore = 0
    let overlapCount = 0
    const descriptionThreshold = hasStructuralMatch ? 3 : 4
    if (current.description && candidate.description) {
      const currWords = memoryService._extractKeywords(current.description)
      const candWords = memoryService._extractKeywords(candidate.description)
      overlapCount = currWords.filter((w) => candWords.includes(w)).length
      
      if (overlapCount >= descriptionThreshold) {
        descScore = Math.min(overlapCount, 6)
        score += descScore
      }
    }
    signals.description = descScore
    signals.descOverlapCount = overlapCount
    signals.descriptionThreshold = descriptionThreshold
    
    // NORMALIZATION
    // Max possible score: 6 + 8 + 6 + 4 + 6 = 30 points
    const maxScore = 30
    const normalizedScore = score / maxScore
    
    // Optional debug logging
    if (debug) {
      console.debug(`[SimilarMemories] "${current.title}" vs "${candidate.title}":`, {
        signals,
        rawScore: score,
        normalizedScore: normalizedScore.toFixed(2),
        threshold: 0.40,
        passes: normalizedScore >= 0.40,
      })
    }
    
    return normalizedScore // Returns 0-1 range
  },

  /**
   * Get similar memories based on multi-signal relevance scoring.
   * Considers: category, location, tags, title similarity, and description keywords.
   * Returns only memories above configurable relevance threshold.
   * 
   * Frontend-side filtering: load all and filter locally.
   * Ranked by normalized relevance score (0-1 range).
   * 
   * @param {string} id - Memory ID to find similar memories for
   * @param {Array} allMemories - Optional: pre-fetched array of all memories. If provided, uses this instead of fetching fresh
   * @param {boolean} debug - Optional: enable console logging of scoring for all candidates
   * @returns {Promise<Array>} - Up to 4 similar memories, ranked by relevance score
   */
  getSimilarMemories: async (id, allMemories = null, debug = false) => {
    // Use provided memories array or fetch fresh if not provided
    const all = allMemories || await memoryService.getMemories()
    const current = all.find((x) => x.id === id)

    if (!current) return []

    // Configuration: minimum relevance threshold (0-1 range)
    const MINIMUM_RELEVANCE_THRESHOLD = 0.40 // 40% of max score required
    const MAX_RESULTS = 4

    if (debug) {
      console.debug(`[SimilarMemories] Finding similar memories for: "${current.title}"`)
      console.debug(`[SimilarMemories] Total candidates to evaluate: ${all.length - 1}`)
    }

    // Calculate similarity scores for all candidates
    const scored = all
      .filter((x) => x.id !== id) // Exclude current memory from recommendations
      .map((x) => ({
        memory: x,
        score: memoryService._calculateSimilarityScore(current, x, debug),
      }))
      .filter((item) => {
        const passes = item.score >= MINIMUM_RELEVANCE_THRESHOLD
        if (debug && passes) {
          console.debug(`[SimilarMemories] ✓ PASSES threshold: "${item.memory.title}" (score: ${(item.score * 100).toFixed(1)}%)`)
        }
        return passes
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, MAX_RESULTS) // Limit to max results
      .map((item) => item.memory) // Extract memory objects

    if (debug) {
      console.debug(`[SimilarMemories] Found ${scored.length} similar memories (threshold: ${(MINIMUM_RELEVANCE_THRESHOLD * 100).toFixed(0)}%)`)
    }

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
