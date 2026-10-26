
import authService from "./authService"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"
const JOURNAL_URL = `${API_BASE_URL}/journal/`

function errorMessage(data, fallback) {
  if (typeof data?.detail === "string") return data.detail
  if (typeof data?.error === "string") return data.error
  if (data && typeof data === "object") {
    return Object.entries(data).map(([field, value]) =>
      `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
    ).join(" | ")
  }
  return fallback
}

async function journalRequest(endpoint = "", options = {}, retry = true) {
  const { accessToken } = authService.getTokens()
  const response = await fetch(`${JOURNAL_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()
    if (refreshed) return journalRequest(endpoint, options, false)
    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(errorMessage(data, `Erreur HTTP ${response.status}`))
  }

  if (response.status === 204) return null
  if (options.responseType === "blob") return response.blob()
  return response.json()
}

function buildQueryParams(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value))
    }
  })

  const result = query.toString()
  return result ? `?${result}` : ""
}

const entryPath = (id) => `${encodeURIComponent(id)}/`
const unlockHeaders = (token) => token ? { "X-Journal-Unlock": token } : {}

export const journalService = {
  getEntries(params = {}) {
    return journalRequest(buildQueryParams(params))
  },

  getEntry(id, token) {
    return journalRequest(entryPath(id), {
      headers: unlockHeaders(token),
    })
  },

  createEntry(data) {
    return journalRequest("", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateEntry(id, data, token) {
    return journalRequest(entryPath(id), {
      method: "PATCH",
      headers: unlockHeaders(token),
      body: JSON.stringify(data),
    })
  },

  deleteEntry(id, token) {
    return journalRequest(entryPath(id), {
      method: "DELETE",
      headers: unlockHeaders(token),
    })
  },

  getAnalytics() {
    return journalRequest("analytics/")
  },

  analyzeEntry(id, token) {
    return journalRequest(`${entryPath(id)}analyze/`, {
      method: "POST",
      headers: unlockHeaders(token),
    })
  },

  improveText(content) {
    return journalRequest("improve-text/", {
      method: "POST",
      body: JSON.stringify({ content }),
    })
  },

  askJournal(question) {
    return journalRequest("ask/", {
      method: "POST",
      body: JSON.stringify({ question }),
    })
  },

  toggleFavorite(id) {
    return journalRequest(`${entryPath(id)}toggle-favorite/`, {
      method: "POST",
    })
  },

  togglePin(id) {
    return journalRequest(`${entryPath(id)}toggle-pin/`, {
      method: "POST",
    })
  },

  setPin(id, pin) {
    return journalRequest(`${entryPath(id)}set-pin/`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    })
  },

  unlockEntry(id, pin) {
    return journalRequest(`${entryPath(id)}unlock/`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    })
  },

  removePin(id, token) {
    return journalRequest(`${entryPath(id)}remove-pin/`, {
      method: "POST",
      headers: unlockHeaders(token),
    })
  },

  async exportEntryPdf(id, token) {
    const blob = await journalRequest(`${entryPath(id)}export-pdf/`, {
      method: "GET",
      headers: unlockHeaders(token),
      responseType: "blob",
    })

    if (
      !blob ||
      !blob.size ||
      !(
        (blob.type || "").includes("pdf") ||
        (await blob.slice(0, 5).text()) === "%PDF-"
      )
    ) {
      throw new Error(
        "Le serveur n’a pas renvoyé un PDF valide. Vérifiez la vue Django export_pdf."
      )
    }

    const url = URL.createObjectURL(blob)

    try {
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `journal-${id}.pdf`

      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  },
}

export default journalService
