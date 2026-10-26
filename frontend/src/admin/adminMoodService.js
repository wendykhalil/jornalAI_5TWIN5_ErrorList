import authService from "../services/authService"

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "")

const MOOD_URL = `${API_BASE_URL}/admin/moods/`

async function request(endpoint = "", options = {}, retry = true) {
  const { accessToken } = authService.getTokens()

  if (!accessToken) {
    throw new Error("Connectez-vous avec un compte administrateur.")
  }

  const response = await fetch(`${MOOD_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()
    if (refreshed) {
      return request(endpoint, options, false)
    }
    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      data.detail || data.error || `Erreur API ${response.status}`,
    )
  }

  return response.json()
}

function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value))
    }
  })
  const text = query.toString()
  return text ? `?${text}` : ""
}

const adminMoodService = {
  getStats() {
    return request("stats/")
  },

  getCheckins(params = {}) {
    return request(queryString(params))
  },
}

export default adminMoodService
