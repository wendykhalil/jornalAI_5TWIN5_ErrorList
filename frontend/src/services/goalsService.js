import authService from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api"

/**
 * Format API error messages (DRF returns {field: [messages]} or {detail}).
 */
function errorMessage(data, fallback) {
  if (typeof data?.detail === "string") return data.detail
  if (typeof data?.error === "string") return data.error

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
 * Authenticated request to the goals / habits API (JWT, one refresh retry).
 */
async function request(path, options = {}, retry = true) {
  const { accessToken } = authService.getTokens()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (response.status === 401 && retry) {
    const refreshed = await authService.refreshAccessToken()
    if (refreshed) return request(path, options, false)
    throw new Error("Session expirée. Reconnectez-vous.")
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(errorMessage(data, `Erreur HTTP ${response.status}`))
  }

  if (response.status === 204) return null
  return response.json()
}

/**
 * The API is paginated (20 items per page): fetch every page.
 */
async function fetchAll(path) {
  const items = []
  let page = 1

  while (true) {
    const separator = path.includes("?") ? "&" : "?"
    const data = await request(`${path}${separator}page=${page}`)

    if (Array.isArray(data)) return data

    items.push(...(data.results || []))
    if (!data.next) break
    page += 1
  }

  return items
}

const body = (data) => JSON.stringify(data)

export const goalsService = {
  // ---- Goals ----
  listGoals: () => fetchAll("/goals/"),
  getGoal: (id) => request(`/goals/${id}/`),
  createGoal: (data) => request("/goals/", { method: "POST", body: body(data) }),
  updateGoal: (id, data) =>
    request(`/goals/${id}/`, { method: "PATCH", body: body(data) }),
  deleteGoal: (id) => request(`/goals/${id}/`, { method: "DELETE" }),
  breakdownGoal: (id) => request(`/goals/${id}/breakdown/`, { method: "POST", body: body({}) }),
  createGoalSteps: (id, steps) =>
    request(`/goals/${id}/steps/`, {
      method: "POST",
      body: body({ steps }),
    }),

  // ---- Habits ----
  listHabits: () => fetchAll("/habits/"),
  createHabit: (data) =>
    request("/habits/", { method: "POST", body: body(data) }),
  updateHabit: (id, data) =>
    request(`/habits/${id}/`, { method: "PATCH", body: body(data) }),
  deleteHabit: (id) => request(`/habits/${id}/`, { method: "DELETE" }),

  // ---- Daily validation ----
  checkHabit: (id, date, completed = true) =>
    request(`/habits/${id}/check/`, {
      method: "POST",
      body: body({ date, completed }),
    }),
  listChecks: (id) => request(`/habits/${id}/checks/`),

  // ---- AI (Ollama on the backend) ----
  // { insights: string[], source: "ai" | "rules", warning?: string }
  insights: () => request("/goals/insights/"),
  // { answer: string, sources: [{ type, id, title }] }
  coach: (question, history = []) =>
    request("/goals/coach/", {
      method: "POST",
      body: body({ question, history }),
    }),
}

export default goalsService
