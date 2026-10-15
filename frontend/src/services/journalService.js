
import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"

const JOURNAL_URL = `${API_BASE_URL}/journal/`

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

function buildQueryParams(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      query.set(key, String(value))
    }
  })

  const result = query.toString()

  return result ? `?${result}` : ""
}

export const journalService = {
  // ==========================================
  // JOURNAL CRUD
  // ==========================================

  getEntries(params = {}) {
    return journalRequest(buildQueryParams(params))
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

  // ==========================================
  // JOURNAL ANALYTICS
  // ==========================================

  getAnalytics() {
    return journalRequest("analytics/")
  },

  // ==========================================
  // EXISTING AI ANALYSIS
  // ==========================================

  analyzeEntry(id) {
    return journalRequest(
      `${encodeURIComponent(id)}/analyze/`,
      {
        method: "POST",
      }
    )
  },

  // ==========================================
  // NEW: AI WRITING ASSISTANT
  // ==========================================

  improveText(content) {
    return journalRequest("improve-text/", {
      method: "POST",
      body: JSON.stringify({ content }),
    })
  },

  // ==========================================
  // NEW: ASK MY JOURNAL — AI CHAT
  // ==========================================

  askJournal(question) {
    return journalRequest("ask/", {
      method: "POST",
      body: JSON.stringify({ question }),
    })
  },
}

export default journalService
