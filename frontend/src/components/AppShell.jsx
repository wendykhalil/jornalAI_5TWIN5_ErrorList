import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router"
import {
  LayoutDashboard,
  BookOpen,
  HeartPulse,
  Images,
  Target,
  CalendarHeart,
  Sparkles,
  Bell,
  UserRound,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  Brain,
  ChevronDown,
} from "lucide-react"
import { useStore } from "../store/AppStore"
import { Button } from "./ui"

const nav = [
  ["/dashboard", "Tableau de bord", LayoutDashboard],
  ["/journal", "Journal", BookOpen],
  ["/mood", "Humeurs", HeartPulse],
  ["/media", "Multimédia", Images],
  ["/goals", "Objectifs & habitudes", Target],
  ["/memories", "Souvenirs & événements", CalendarHeart],
  ["/ai-insights", "AI Insights", Sparkles],
  ["/notifications", "Notifications", Bell],
  ["/profile", "Profil", UserRound],
  ["/settings", "Paramètres", Settings],
]
export default function AppShell() {
  const [open, setOpen] = useState(false),
    [profile, setProfile] = useState(false),
    [collapsed, setCollapsed] = useState(false)
  const { notifications, toast } = useStore(),
    navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  const logout = () => {
    localStorage.removeItem("mindlog_auth")
    navigate("/login")
  }
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all ${
          collapsed ? "w-20" : "w-64"
        } ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-20 items-center gap-3 px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
            <Brain size={22} />
          </div>
          {!collapsed && (
            <div>
              <div className="font-extrabold">
                MindLog <span className="text-violet-600">AI</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Personal journal
              </div>
            </div>
          )}
          <button
            className="ml-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`
              }
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            {!collapsed && "Déconnexion"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1 hidden w-full rounded-xl py-2 text-xs font-bold text-slate-400 hover:bg-slate-50 lg:block"
          >
            {collapsed ? "Agrandir" : "Réduire la navigation"}
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
        />
      )}
      <div className={`transition-all ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <button
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="w-full rounded-xl bg-slate-100 py-2.5 pl-10 pr-14 text-sm outline-none focus:ring-4 focus:ring-violet-100"
              placeholder="Rechercher partout..."
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-400 shadow-sm">
              ⌘ K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              className="relative !p-2.5"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-violet-600 text-[9px] text-white">
                  {unread}
                </span>
              )}
            </Button>
            <div className="relative">
              <button
                onClick={() => setProfile(!profile)}
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-50"
              >
                <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                  AM
                </div>
                <div className="hidden text-left md:block">
                  <div className="text-xs font-bold">Aya Mansour</div>
                  <div className="text-[10px] text-slate-400">Étudiante</div>
                </div>
                <ChevronDown size={15} />
              </button>
              {profile && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    onClick={() => navigate("/profile")}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    Mon profil
                  </button>
                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    Paramètres
                  </button>
                  <button
                    onClick={logout}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-7">
          <Outlet />
        </main>
      </div>
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-xl ${
            toast.type === "error" ? "bg-red-600" : "bg-slate-900"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
