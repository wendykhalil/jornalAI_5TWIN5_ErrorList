import * as seed from "./mockData.js"

const KEY = "mindlog-admin-demo-v1"
const clone = (value) => JSON.parse(JSON.stringify(value))
const initial = () => ({
  users: clone(seed.users),
  reports: clone(seed.reports),
  aiJobs: clone(seed.aiJobs),
  categories: clone(seed.categories),
  notifications: clone(seed.notifications),
  auditLogs: clone(seed.auditLogs),
  settings: {
    appName: "MindLog AI",
    language: "English",
    timezone: "Europe/Paris",
    maintenance: false,
    aiFeatures: true,
    multimedia: true,
  },
})
export const loadStore = () => {
  try {
    return { ...initial(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }
  } catch {
    return initial()
  }
}
export const saveStore = (store) =>
  localStorage.setItem(KEY, JSON.stringify(store))
export const addAudit = (
  store,
  action,
  target,
  reference,
  reason = "Authorized operational action",
) => ({
  ...store,
  auditLogs: [
    {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      admin: "Amina Diallo",
      action,
      target,
      reference,
      reason,
      result: "Success",
    },
    ...store.auditLogs,
  ],
})
export const authenticate = (email, password) =>
  email === "admin@mindlog.ai" && password === "MindlogDemo!"
export const adminSession = {
  get: () => localStorage.getItem("mindlog-admin-auth") === "true",
  set: (value) => localStorage.setItem("mindlog-admin-auth", String(value)),
}
export const staticData = {
  journalEntries: seed.journalEntries,
  media: seed.media,
  memories: seed.memories,
  activityTrend: seed.activityTrend,
  roles: seed.roles,
  goals: Array.from({ length: 35 }, (_, i) => ({
    id: `${i < 15 ? "GOAL" : "HAB"}-${7001 + i}`,
    ownerId: seed.users[i % 20].id,
    type: i < 15 ? "Goal" : "Habit",
    createdAt: `2025-10-${String((i % 27) + 1).padStart(2, "0")}`,
    status: i % 4 === 0 ? "Completed" : "Active",
    lastActivity: `${i + 1}h ago`,
    reportStatus: "None",
  })),
}
export const apiConfig = {
  mode: "mock",
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
  note: "Future Django REST Framework endpoints will replace mock adapters.",
}
