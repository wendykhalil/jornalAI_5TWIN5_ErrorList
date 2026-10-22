
import authService from "./authService"

const configuredBase = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"
).replace(/\/$/, "")

const API_ROOT = configuredBase.endsWith("/api")
  ? configuredBase
  : `${configuredBase}/api`

async function visionRequest(entryId, mediaId, retry = true) {
  const { accessToken } = authService.getTokens()

  if (!accessToken) {
    throw new Error("Session expirée. Reconnectez-vous.")
  }

  const response = await fetch(
    `${API_ROOT}/journal/${encodeURIComponent(entryId)}/analyze-photo/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ media_id: mediaId }),
    }
  )

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()

    if (refreshed) {
      return visionRequest(entryId, mediaId, false)
    }

    throw new Error("Session expirée. Reconnectez-vous.")
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error || data.detail || `Erreur HTTP ${response.status}`
    )
  }

  return data
}

export const journalVisionService = {
  analyzePhoto(entryId, mediaId) {
    return visionRequest(entryId, mediaId)
  },
}

export default journalVisionService
