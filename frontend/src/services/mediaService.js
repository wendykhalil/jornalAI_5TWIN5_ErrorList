import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"

const MEDIA_URL = `${API_BASE_URL}/media/`

/**
 * Format API error messages
 */
function errorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail
  }

  if (typeof data?.error === "string") {
    return data.error
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, value]) => {
        const message = Array.isArray(value) ? value.join(", ") : String(value)

        return `${field}: ${message}`
      })
      .join(" | ")
  }

  return fallback
}

/**
 * Authenticated API request for media
 */
async function mediaRequest(endpoint = "", options = {}, retry = true) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(`${MEDIA_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()

    if (refreshed) {
      return mediaRequest(endpoint, options, false)
    }

    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))

    const err = new Error(errorMessage(data, `Erreur HTTP ${response.status}`))
    err.status = response.status
    err.code = data?.code
    err.data = data
    throw err
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const mediaService = {
  /**
   * Fetch all media for current user
   */
  getMedia: async () => {
    const response = await mediaRequest()

    // Support both paginated and direct array responses
    if (Array.isArray(response)) {
      return response
    }

    // Paginated response: return all results
    return response?.results || []
  },

  /**
   * Fetch a single media by ID
   */
  getMediaById: (id) => {
    return mediaRequest(`${encodeURIComponent(id)}/`)
  },

  /**
   * Upload new media file
   * @param {File} file - The file to upload
   * @param {string} title - Media title
   * @param {string} mediaType - Media type (image, audio, video, document)
   * @param {string} description - Optional description
   */
  uploadMedia: (file, title, mediaType = "image", description = "") => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title)
    formData.append("media_type", mediaType)
    formData.append("description", description)

    return mediaRequest("", {
      method: "POST",
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    })
  },

  /**
   * Update media metadata
   */
  updateMedia: (id, data) => {
    return mediaRequest(`${encodeURIComponent(id)}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete media
   */
  deleteMedia: (id) => {
    return mediaRequest(`${encodeURIComponent(id)}/`, {
      method: "DELETE",
    })
  },

  /**
   * Transcribe audio media using Whisper
   * @param {string|number} id - Media ID
   */
  transcribeMedia: (id) => {
    return mediaRequest(`${encodeURIComponent(id)}/transcribe/`, {
      method: "POST",
    })
  },
}

export default mediaService
