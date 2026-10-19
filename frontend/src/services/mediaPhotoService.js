
import authService from "./authService"

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "")

const MEDIA_URL = `${API_BASE_URL}/media/`

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
    `${MEDIA_URL}${endpoint}`,
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

  return response.json()
}

// ==========================================
// FILE VALIDATION
// ==========================================

function validateFile(file) {
  if (!file) {
    throw new Error(
      "Veuillez sélectionner un fichier."
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

  return response?.results || []
}

// ==========================================
// MEDIA SERVICE
// ==========================================

export const mediaPhotoService = {

  // ========================================
  // GET ALL JOURNAL ATTACHMENTS
  // ========================================

  async getAttachments() {
    return this.getMedia()
  },

  // ========================================
  // GET IMAGES AND VIDEOS
  // ========================================

  async getMedia() {
    const allMedia = []
    let endpoint = ""
    const visited = new Set()

    const baseUrl = new URL(MEDIA_URL)

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

      const nextUrl = new URL(
        response.next,
        MEDIA_URL
      )

      if (
        nextUrl.origin !== baseUrl.origin ||
        nextUrl.pathname !== baseUrl.pathname
      ) {
        break
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
    const media = await this.getMedia()

    return media.filter(
      (item) => item.media_type === "image"
    )
  },

  // ========================================
  // GET ONLY VIDEOS
  // ========================================

  async getVideos() {
    const media = await this.getMedia()

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
      file.name.replace(/\.[^.]+$/, "")
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

    return this.uploadMedia(file, description)
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

    return this.uploadMedia(file, description)
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
      const media = await this.getMediaById(id)

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
        error.message.includes("Not found")
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
        exists: await this.verifyAttachment(id),
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

