
import authService from "./authService.js"

const API_BASE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:8000/api"
).replace(/\/+$/, "")

const MEDIA_URL = `${API_BASE_URL}/media/`

/**
 * Safely resolves an absolute URL even when MEDIA_URL is relative (e.g. /api/media/).
 * Works in both browser environments (window.location.origin) and SSR/tests.
 */
export function getSafeBaseUrl(url = MEDIA_URL) {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    return new URL(url)
  }
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost:8000"
  return new URL(url, origin)
}

/**
 * Safely resolves the next pagination URL relative to the base media URL.
 */
export function getSafeNextUrl(next, baseUrl) {
  if (typeof next === "string" && /^https?:\/\//i.test(next)) {
    return new URL(next)
  }
  return new URL(next, baseUrl)
}

/**
 * Builds the final URL for media API requests without duplicating slashes.
 */
export function buildMediaRequestUrl(endpoint = "") {
  if (!endpoint) return MEDIA_URL
  if (endpoint.startsWith("?")) return `${MEDIA_URL}${endpoint}`
  const cleanEndpoint = endpoint.replace(/^\/+/, "")
  return `${MEDIA_URL}${cleanEndpoint}`
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]

const IMAGE_MAX_SIZE = 10 * 1024 * 1024
const VIDEO_MAX_SIZE = 100 * 1024 * 1024

// ==========================================
// ERROR HANDLING
// ==========================================

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail
  }

  if (typeof data?.error === "string") {
    return data.error
  }

  if (data && typeof data === "object") {
    const messages = Object.entries(data).map(
      ([field, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value)

        return `${field}: ${message}`
      }
    )

    return messages.join(" | ") || fallback
  }

  return fallback
}

// ==========================================
// AUTHENTICATED MEDIA REQUEST
// ==========================================

async function mediaRequest(
  endpoint = "",
  options = {},
  retry = true
) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(
    buildMediaRequestUrl(endpoint),
    {
      ...options,
      headers: {
        ...options.headers,
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    }
  )

  if (response.status === 401 && retry) {
    const refreshed =
      await authService.refreshAccessToken()

    if (refreshed) {
      return mediaRequest(endpoint, options, false)
    }

    throw new Error(
      "Session expirée. Reconnectez-vous."
    )
  }

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({}))

    throw new Error(
      getErrorMessage(
        data,
        `Erreur HTTP ${response.status}`
      )
    )
  }

  if (response.status === 204) {
    return null
  }

  const contentType =
    response.headers.get("content-type") || ""

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Réponse inattendue du serveur."
    )
  }

  return response.json()
}

// ==========================================
// FILE VALIDATION
// ==========================================

function validateFile(file) {
  if (!file || !(file instanceof File)) {
    throw new Error(
      "Veuillez sélectionner un fichier valide."
    )
  }

  if (file.size === 0) {
    throw new Error(
      "Le fichier sélectionné est vide."
    )
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Format non autorisé. Utilisez JPG, PNG, WEBP, GIF, MP4 ou WEBM."
    )
  }

  const isVideo = file.type.startsWith("video/")

  const maxSize = isVideo
    ? VIDEO_MAX_SIZE
    : IMAGE_MAX_SIZE

  if (file.size > maxSize) {
    throw new Error(
      isVideo
        ? "La vidéo ne doit pas dépasser 100 Mo."
        : "L'image ne doit pas dépasser 10 Mo."
    )
  }

  return isVideo ? "video" : "image"
}

// ==========================================
// PAGINATION
// ==========================================

function normalizeResults(response) {
  if (Array.isArray(response)) {
    return response
  }

  return Array.isArray(response?.results)
    ? response.results
    : []
}

// ==========================================
// MEDIA SERVICE
// ==========================================

export const mediaPhotoService = {

  // ========================================
  // JOURNAL ATTACHMENT UPLOAD
  // ========================================

  async uploadAttachment(file, description = "") {
    return mediaPhotoService.uploadMedia(
      file,
      description
    )
  },

  // ========================================
  // GET ALL JOURNAL ATTACHMENTS
  // ========================================

  async getAttachments() {
    return mediaPhotoService.getMedia()
  },

  // ========================================
  // GET IMAGES AND VIDEOS
  // ========================================

  async getMedia() {
    const allMedia = []
    let endpoint = ""
    const visited = new Set()

    const baseUrl = getSafeBaseUrl(MEDIA_URL)

    while (true) {
      if (visited.has(endpoint)) {
        break
      }

      visited.add(endpoint)

      const response = await mediaRequest(endpoint)

      allMedia.push(...normalizeResults(response))

      if (Array.isArray(response) || !response?.next) {
        break
      }

      const nextUrl = getSafeNextUrl(
        response.next,
        baseUrl
      )

      const isSameHost =
        nextUrl.hostname === baseUrl.hostname ||
        nextUrl.origin === baseUrl.origin
      const isSamePath =
        nextUrl.pathname.replace(/\/+$/, "") ===
        baseUrl.pathname.replace(/\/+$/, "")

      if (!isSameHost || !isSamePath) {
        throw new Error(
          "Pagination média invalide."
        )
      }

      endpoint = nextUrl.search
    }

    return allMedia.filter(
      (media) =>
        media.media_type === "image" ||
        media.media_type === "video"
    )
  },

  // ========================================
  // GET ONLY IMAGES
  // ========================================

  async getImages() {
    const media = await mediaPhotoService.getMedia()

    return media.filter(
      (item) => item.media_type === "image"
    )
  },

  // ========================================
  // GET ONLY VIDEOS
  // ========================================

  async getVideos() {
    const media = await mediaPhotoService.getMedia()

    return media.filter(
      (item) => item.media_type === "video"
    )
  },

  // ========================================
  // UPLOAD PHOTO OR VIDEO
  // ========================================

  async uploadMedia(file, description = "") {
    const mediaType = validateFile(file)

    const formData = new FormData()

    formData.append("file", file)

    formData.append(
      "title",
      file.name.replace(/\.[^.]+$/, "").slice(0, 255)
    )

    formData.append("media_type", mediaType)

    formData.append(
      "description",
      description ||
        (mediaType === "video"
          ? "Vidéo attachée au journal"
          : "Photo attachée au journal")
    )

    const uploaded = await mediaRequest("", {
      method: "POST",
      body: formData,
    })

    if (!uploaded?.id) {
      throw new Error(
        "Le serveur n'a pas retourné d'identifiant de média."
      )
    }

    return uploaded
  },

  // ========================================
  // UPLOAD IMAGE
  // ========================================

  async uploadImage(file, description = "") {
    if (!file?.type?.startsWith("image/")) {
      throw new Error(
        "Veuillez sélectionner une image."
      )
    }

    return mediaPhotoService.uploadMedia(
      file,
      description
    )
  },

  // ========================================
  // UPLOAD VIDEO
  // ========================================

  async uploadVideo(file, description = "") {
    if (!file?.type?.startsWith("video/")) {
      throw new Error(
        "Veuillez sélectionner une vidéo."
      )
    }

    return mediaPhotoService.uploadMedia(
      file,
      description
    )
  },

  // ========================================
  // GET ONE MEDIA FILE
  // ========================================

  getMediaById(id) {
    return mediaRequest(
      `${encodeURIComponent(id)}/`
    )
  },

  // ========================================
  // CHECK IF ATTACHMENT EXISTS
  // ========================================

  async verifyAttachment(id) {
    try {
      const media =
        await mediaPhotoService.getMediaById(id)

      return Boolean(
        media &&
        (
          media.media_type === "image" ||
          media.media_type === "video"
        )
      )
    } catch (error) {
      if (
        error.message.includes("404") ||
        error.message.toLowerCase().includes("not found")
      ) {
        return false
      }

      throw error
    }
  },

  // ========================================
  // VERIFY MULTIPLE ATTACHMENTS
  // ========================================

  async verifyAttachments(ids = []) {
    const results = await Promise.all(
      ids.map(async (id) => ({
        id,
        exists:
          await mediaPhotoService.verifyAttachment(id),
      }))
    )

    return {
      validIds: results
        .filter((item) => item.exists)
        .map((item) => item.id),

      invalidIds: results
        .filter((item) => !item.exists)
        .map((item) => item.id),
    }
  },

  // ========================================
  // DELETE MEDIA
  // ========================================

  deleteMedia(id) {
    return mediaRequest(
      `${encodeURIComponent(id)}/`,
      {
        method: "DELETE",
      }
    )
  },
}

export default mediaPhotoService
