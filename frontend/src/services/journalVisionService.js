
// Optional image analysis for an existing journal entry.
// If your auth service stores JWT differently, reuse its token getter here.

const configuredBase = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "")

const API_ROOT = configuredBase.endsWith("/api")
  ? configuredBase
  : `${configuredBase}/api`

function accessToken() {
  for (const key of [
    "access",
    "access_token",
    "accessToken",
    "token",
    "jwt_access",
    "authTokens",
    "tokens",
    "auth",
    "user",
  ]) {
    const raw =
      localStorage.getItem(key) ||
      sessionStorage.getItem(key)

    if (!raw) continue

    try {
      const value = JSON.parse(raw)

      if (
        typeof value === "string" &&
        value.split(".").length === 3
      ) {
        return value
      }

      const token =
        value?.access ||
        value?.access_token ||
        value?.accessToken ||
        value?.tokens?.access

      if (typeof token === "string") return token
    } catch {
      if (raw.split(".").length === 3) return raw
    }
  }

  return null
}

export const journalVisionService = {
  async analyzePhoto(entryId, mediaId) {
    const token = accessToken()

    if (!token) {
      throw new Error(
        "Session introuvable. Reconnectez-vous."
      )
    }

    const response = await fetch(
      `${API_ROOT}/journal/${encodeURIComponent(entryId)}/analyze-photo/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          media_id: mediaId,
        }),
      }
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.detail ||
        `Erreur HTTP ${response.status}`
      )
    }

    return data
  },
}
