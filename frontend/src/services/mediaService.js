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

  /**
   * Transcribe an ephemeral voice prompt using Whisper
   * Calls POST /api/media/transcribe-prompt/
   * @param {Blob|File} audioFile - max 30s audio
   * @returns {Promise<{text: string, language: string, duration: number}>}
   */
  transcribeVoicePrompt: (audioFile) => {
    const formData = new FormData()
    formData.append(
      "audio",
      audioFile,
      audioFile.name || `voice_prompt_${Date.now()}.webm`,
    )
    return mediaRequest("transcribe-prompt/", {
      method: "POST",
      body: formData,
    })
  },

  /**
   * Generate an image from prompt using Pollinations AI via Django backend
   * Calls POST /api/media/ai-generate/
   * @param {Object} params - { prompt, style, aspect_ratio, seed }
   * @returns {Promise<{image: string, prompt: string, model: string, content_type: string, width: number, height: number}>}
   */
  generateAiImage: ({ prompt, style, aspect_ratio = "1:1", seed }) => {
    const payload = {
      prompt: prompt?.trim(),
      aspect_ratio,
    }
    if (style && style !== "none" && style !== "Aucun") {
      payload.style = style
    }
    if (seed !== undefined && seed !== null && seed !== "") {
      payload.seed = Number(seed)
    }

    return mediaRequest("ai-generate/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
  },

  /**
   * Edit an existing image media using Pollinations AI via Django backend
   * Calls POST /api/media/{id}/ai-edit/
   * @param {string|number} mediaId - Source media UUID or ID
   * @param {Object} params - { prompt, seed }
   * @returns {Promise<{image: string, source_media_id: string, prompt: string, model: string, content_type: string, width: number, height: number}>}
   */
  editAiImage: (mediaId, { prompt, seed }) => {
    const payload = {
      prompt: prompt?.trim(),
    }
    if (seed !== undefined && seed !== null && seed !== "") {
      payload.seed = Number(seed)
    }

    return mediaRequest(`${encodeURIComponent(mediaId)}/ai-edit/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
  },

  /**
   * Voluntarily save an ephemeral AI preview image as a new Media in the user library
   * Does NOT overwrite or alter the source image.
   * @param {string} dataUrl - "data:image/jpeg;base64,..."
   * @param {Object} metadata - { title, description }
   * @returns {Promise<Object>} Created Media object
   */
  saveGeneratedImage: (
    dataUrl,
    { title = "Image générée par IA", description = "" } = {},
  ) => {
    const safeTitle = (title || "Image générée par IA").trim()
    const file = dataUrlToFile(dataUrl, `ai_${Date.now()}.jpg`)
    return mediaService.uploadMedia(file, safeTitle, "image", description || "")
  },
}

/**
 * Convert base64 data URL to a standard browser File object without extra dependencies.
 * @param {string} dataUrl - e.g. "data:image/jpeg;base64,..."
 * @param {string} filename - default filename
 * @returns {File}
 */
export function dataUrlToFile(dataUrl, filename = "image-ia.jpg") {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.includes(",")) {
    throw new Error("Format de données d'image invalide (data URL attendue).")
  }
  const [header, b64Data] = dataUrl.split(",")
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg"
  const ext = mime.split("/")[1] || "jpg"
  const cleanExt = ext === "jpeg" ? "jpg" : ext
  const finalFilename = filename.includes(".")
    ? filename
    : `${filename}.${cleanExt}`

  const byteString = atob(b64Data)
  const u8arr = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) {
    u8arr[i] = byteString.charCodeAt(i)
  }
  return new File([u8arr], finalFilename, { type: mime })
}

export default mediaService
