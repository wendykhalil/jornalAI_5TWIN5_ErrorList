import { createContext, useContext, useMemo, useState } from "react"
import { addAudit, loadStore, saveStore } from "./services.js"

const AdminContext = createContext(null)
export function AdminProvider({ children }) {
  const [store, setStoreState] = useState(loadStore)
  const [toast, setToast] = useState("")
  const commit = (next, message) => {
    setStoreState(next)
    saveStore(next)
    if (message) {
      setToast(message)
      window.setTimeout(() => setToast(""), 2600)
    }
  }
  const actions = useMemo(
    () => ({
      updateUser(id, patch, reason) {
        let next = {
          ...store,
          users: store.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        }
        next = addAudit(
          next,
          patch.status
            ? `User status changed to ${patch.status}`
            : "User profile updated",
          "User",
          id,
          reason,
        )
        commit(next, "User account updated")
      },
      updateReport(id, status, reason) {
        let next = {
          ...store,
          reports: store.reports.map((r) =>
            r.id === id ? { ...r, status, moderator: "Amina Diallo" } : r,
          ),
        }
        next = addAudit(next, `Report marked ${status}`, "Report", id, reason)
        commit(next, "Moderation decision saved")
      },
      retryJob(id) {
        let next = {
          ...store,
          aiJobs: store.aiJobs.map((j) =>
            j.id === id ? { ...j, status: "Processing", error: "—" } : j,
          ),
        }
        next = addAudit(next, "AI job retry", "AI Job", id)
        commit(next, "AI job queued for simulated retry")
      },
      updateCategory(id, patch) {
        const categories = id
          ? store.categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
          : [
              {
                id: `CAT-${Date.now()}`,
                usage: 0,
                status: "Active",
                createdAt: new Date().toISOString().slice(0, 10),
                ...patch,
              },
              ...store.categories,
            ]
        const next = addAudit(
          { ...store, categories },
          id ? "Category modification" : "Category creation",
          "Category",
          id || categories[0].id,
        )
        commit(next, "Category saved")
      },
      markNotification(id, read = true) {
        commit({
          ...store,
          notifications: store.notifications.map((n) =>
            !id || n.id === id ? { ...n, read } : n,
          ),
        })
      },
      deleteNotification(id) {
        commit(
          {
            ...store,
            notifications: store.notifications.filter((n) => n.id !== id),
          },
          "Notification dismissed",
        )
      },
      updateSettings(settings) {
        const next = addAudit(
          { ...store, settings },
          "Settings modification",
          "Settings",
          "APP",
        )
        commit(next, "Settings saved")
      },
    }),
    [store],
  )
  return (
    <AdminContext.Provider value={{ store, actions, toast }}>
      {children}
    </AdminContext.Provider>
  )
}
export const useAdmin = () => useContext(AdminContext)
