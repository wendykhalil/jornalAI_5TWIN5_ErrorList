export const API_MODE = Boolean(import.meta.env.VITE_API_BASE_URL)
export const apiClient = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  async request(path, options = {}) {
    if (!API_MODE) throw new Error("Le mode API n’est pas configuré.")
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    })
    if (!response.ok) throw new Error(`Erreur API ${response.status}`)
    return response.status === 204 ? null : response.json()
  },
}
