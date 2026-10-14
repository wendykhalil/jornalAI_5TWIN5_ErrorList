
import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"

const JOURNAL_URL = `${API_BASE_URL}/journal/`

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

async function journalRequest(
  endpoint = "",
  options = {},
  retry = true
) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(
    `${JOURNAL_URL}${endpoint}`,
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
      return journalRequest(endpoint, options, false)
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

export const journalService = {
  getEntries() {
    return journalRequest()
  },

  getEntry(id) {
    return journalRequest(`${encodeURIComponent(id)}/`)
  },

  createEntry(data) {
    return journalRequest("", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateEntry(id, data) {
    return journalRequest(`${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  deleteEntry(id) {
    return journalRequest(`${encodeURIComponent(id)}/`, {
      method: "DELETE",
    })
  },
}

export default journalService
