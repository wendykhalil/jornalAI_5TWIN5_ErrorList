import authService from "./authService"

export const API_MODE = Boolean(import.meta.env.VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"

export const apiClient = {
  baseUrl: API_BASE_URL,
  
  async request(path, options = {}) {
    if (!API_MODE) throw new Error("API mode is not configured.")
    
    const url = `${this.baseUrl}${path}`
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    // Inject access token if available
    const token = authService.getAccessToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle 401 - attempt token refresh
    if (response.status === 401 && token && !options.skipRefresh) {
      const refreshed = await authService.refreshAccessToken()
      if (refreshed) {
        // Retry with new token
        return this.request(path, { ...options, skipRefresh: true })
      } else {
        // Refresh failed - redirect to login
        window.location.href = "/login"
        throw new Error("Session expired. Please log in again.")
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.detail || 
        (typeof errorData === 'object' && Object.values(errorData)[0]) || 
        `API error ${response.status}`
      )
    }

    return response.status === 204 ? null : response.json()
  },

  get(path, options) {
    return this.request(path, { method: "GET", ...options })
  },

  post(path, data, options) {
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    })
  },

  put(path, data, options) {
    return this.request(path, {
      method: "PUT",
      body: JSON.stringify(data),
      ...options,
    })
  },

  patch(path, data, options) {
    return this.request(path, {
      method: "PATCH",
      body: JSON.stringify(data),
      ...options,
    })
  },

  delete(path, options) {
    return this.request(path, { method: "DELETE", ...options })
  },
}
