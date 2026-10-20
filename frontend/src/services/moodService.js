import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"

const MOOD_URL = `${API_BASE_URL}/moods/`

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

async function moodRequest(endpoint = "", options = {}, retry = true) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(`${MOOD_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()

    if (refreshed) {
      return moodRequest(endpoint, options, false)
    }

    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))

    throw new Error(errorMessage(data, `Erreur HTTP ${response.status}`))
  }

  if (response.status === 204) {
    return null
  }

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

export const moodService = {
  getMoods(params = {}) {
    return moodRequest(buildQueryParams(params))
  },

  getMood(id) {
    return moodRequest(`${encodeURIComponent(id)}/`)
  },

  createMood(data) {
    return moodRequest("", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateMood(id, data) {
    return moodRequest(`${encodeURIComponent(id)}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  deleteMood(id) {
    return moodRequest(`${encodeURIComponent(id)}/`, {
      method: "DELETE",
    })
  },

  getStats(params = {}) {
    return moodRequest(`stats/${buildQueryParams(params)}`)
  },

  summarizeMoods(days) {
    return moodRequest("summary/", {
      method: "POST",
      body: JSON.stringify({ days }),
    })
  },
}

export default moodService
