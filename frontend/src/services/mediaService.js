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

  /**
   * Resolve media file URL (relative or absolute)
   */
  resolveFileUrl,

  /**
   * Download a media file to user's disk
   */
  downloadMedia: downloadMediaFile,
}

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
}

const MEDIA_TYPE_DEFAULT_EXTENSIONS = {
  image: "jpg",
  audio: "mp3",
  video: "mp4",
  document: "pdf",
}

/**
 * Nettoie une chaîne pour en faire un nom de fichier sûr (sans caractères interdits ni injection de chemin).
 */
export function sanitizeFilename(name) {
  if (!name || typeof name !== "string") return "media"
  return (
    name
      .trim()
      .replace(/[\\/]/g, "_")
      .replace(/[:*?"<>|%]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 100) || "media"
  )
}

/**
 * Extrait l'extension valide depuis un chemin ou une URL.
 */
export function extractExtensionFromPath(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return ""
  const clean = pathOrUrl.split("?")[0].split("#")[0]
  const lastSlash = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"))
  const filename = lastSlash >= 0 ? clean.substring(lastSlash + 1) : clean
  const lastDot = filename.lastIndexOf(".")
  if (lastDot > 0 && lastDot < filename.length - 1) {
    const ext = filename.substring(lastDot + 1).toLowerCase()
    if (/^[a-z0-9]{2,5}$/.test(ext)) {
      return ext === "jpeg" ? "jpg" : ext
    }
  }
  return ""
}

/**
 * Résout une URL de fichier multimédia (relative, absolue ou data URL).
 */
export function resolveFileUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return ""
  if (
    rawUrl.startsWith("http://") ||
    rawUrl.startsWith("https://") ||
    rawUrl.startsWith("data:") ||
    rawUrl.startsWith("blob:")
  ) {
    return rawUrl
  }
  const cleanBase = API_BASE_URL.replace(/\/api\/?$/, "")
  return `${cleanBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
}

/**
 * Télécharge un fichier multimédia de façon réelle et forcée sur le disque de l'utilisateur.
 * Déclenche un flux binaire (Blob) avec conversion en URL d'objet de même origine,
 * évitant l'ouverture d'un nouvel onglet et contournant la restriction Same-Origin Policy sur l'attribut download.
 *
 * @param {string|Object} urlOrMedia - URL cible ou objet Media ({ url, title, media_type, file })
 * @param {string} [preferredName=""] - Nom préféré pour le fichier téléchargé
 * @param {string} [mediaType=""] - Type de média optionnel ("image", "audio", "video", "document")
 * @returns {Promise<{ success: boolean, filename: string, size?: number }>}
 */
export async function downloadMediaFile(
  urlOrMedia,
  preferredName = "",
  mediaType = "",
) {
  let targetUrl = ""
  let targetName = preferredName
  let targetType = mediaType

  if (urlOrMedia && typeof urlOrMedia === "object") {
    targetUrl = urlOrMedia.url || urlOrMedia.file || ""
    targetName = preferredName || urlOrMedia.title || urlOrMedia.file || ""
    targetType = mediaType || urlOrMedia.media_type || ""
  } else if (typeof urlOrMedia === "string") {
    targetUrl = urlOrMedia.trim()
  }

  if (!targetUrl) {
    throw new Error("URL de fichier invalide ou absente.")
  }

  const resolvedUrl = resolveFileUrl(targetUrl)

  // 1. Cas des data URLs (ex : images d'aperçu IA générées en direct)
  if (resolvedUrl.startsWith("data:")) {
    const mimeMatch = resolvedUrl.match(/^data:([^;]+);/)
    const dataMime = mimeMatch ? mimeMatch[1].toLowerCase() : ""
    let ext =
      MIME_TO_EXTENSION[dataMime] ||
      extractExtensionFromPath(targetName) ||
      "jpg"
    let cleanBaseName = sanitizeFilename(targetName || `image_ia_${Date.now()}`)
    if (cleanBaseName.toLowerCase().endsWith(`.${ext}`)) {
      cleanBaseName = cleanBaseName.slice(0, -(ext.length + 1))
    }
    const finalFilename = `${cleanBaseName}.${ext}`

    const link = document.createElement("a")
    link.href = resolvedUrl
    link.download = finalFilename
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return { success: true, filename: finalFilename }
  }

  // 2. Cas des blob: URLs
  if (resolvedUrl.startsWith("blob:")) {
    let ext =
      extractExtensionFromPath(targetName) ||
      MEDIA_TYPE_DEFAULT_EXTENSIONS[targetType] ||
      "bin"
    let cleanBaseName = sanitizeFilename(targetName || `fichier_${Date.now()}`)
    if (cleanBaseName.toLowerCase().endsWith(`.${ext}`)) {
      cleanBaseName = cleanBaseName.slice(0, -(ext.length + 1))
    }
    const finalFilename = `${cleanBaseName}.${ext}`

    const link = document.createElement("a")
    link.href = resolvedUrl
    link.download = finalFilename
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return { success: true, filename: finalFilename }
  }

  // 3. Téléchargement réseau HTTP / HTTPS
  const { accessToken } = authService.getTokens()
  let response

  try {
    const headers = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}
    response = await fetch(resolvedUrl, { headers })
    // Si le serveur de fichiers statiques rejette le header Authorization (CORS 401/403), retenter sans header
    if (
      !response.ok &&
      accessToken &&
      (response.status === 401 || response.status === 403)
    ) {
      response = await fetch(resolvedUrl)
    }
  } catch (netErr) {
    try {
      response = await fetch(resolvedUrl)
    } catch {
      throw new Error(
        `Impossible de contacter le serveur pour télécharger le fichier (${netErr.message || "erreur réseau"}).`,
      )
    }
  }

  if (!response.ok) {
    throw new Error(
      `Échec du téléchargement du fichier (HTTP ${response.status} ${response.statusText || ""}).`.trim(),
    )
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  if (contentType.includes("text/html")) {
    throw new Error(
      "Le serveur a retourné une page HTML au lieu du fichier binaire attendu.",
    )
  }

  const blob = await response.blob()
  if (!blob || blob.size === 0) {
    throw new Error("Le fichier téléchargé est vide (0 octet).")
  }

  // Détection de l'extension appropriée
  let ext = extractExtensionFromPath(resolvedUrl)
  if (!ext) {
    const cleanMime = contentType.split(";")[0].trim()
    ext = MIME_TO_EXTENSION[cleanMime]
  }
  if (!ext) {
    ext = extractExtensionFromPath(targetName)
  }
  if (!ext && targetType) {
    ext = MEDIA_TYPE_DEFAULT_EXTENSIONS[targetType]
  }
  if (!ext) {
    ext = "bin"
  }

  // Formatage du nom de fichier final
  let cleanBaseName = sanitizeFilename(targetName || `media_${Date.now()}`)
  if (cleanBaseName.toLowerCase().endsWith(`.${ext}`)) {
    cleanBaseName = cleanBaseName.slice(0, -(ext.length + 1))
  }
  const finalFilename = `${cleanBaseName}.${ext}`

  // Création d'un lien local de même origine via Blob URL
  const blobUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = finalFilename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Révocation de l'URL Blob après téléchargement pour libérer la mémoire du navigateur
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      // Ignorer si déjà révoquée
    }
  }, 2000)

  return { success: true, filename: finalFilename, size: blob.size }
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
