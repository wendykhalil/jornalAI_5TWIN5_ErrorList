import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BookOpen,
  HeartPulse,
  Images,
  CalendarHeart,
  Target,
  Tags,
  BrainCircuit,
  ScrollText,
  ChartNoAxesCombined,
  Bell,
  History,
  Settings,
  CircleUserRound,
  Menu,
  Search,
  LogOut,
  PanelLeftClose,
  ExternalLink,
  X,
} from "lucide-react"
import { AdminProvider, useAdmin } from "./AdminContext.jsx"
import { Button, Badge, SearchField } from "./ui.jsx"
import { staticData } from "./services.js"

const groups = [
  ["Overview", [["Dashboard", "/admin/dashboard", LayoutDashboard]]],
  [
    "User Management",
    [
      ["Users", "/admin/users", Users],
      ["Roles & Permissions", "/admin/roles", ShieldCheck],
    ],
  ],
  [
    "Content Management",
    [
      ["Moderation Queue", "/admin/content", ShieldCheck],
      ["Journal Entries", "/admin/journal", BookOpen],
      ["Mood Activity", "/admin/mood", HeartPulse],
      ["Multimedia", "/admin/multimedia", Images],
      ["Memories & Events", "/admin/memories", CalendarHeart],
      ["Goals & Habits", "/admin/goals", Target],
      ["Categories & Tags", "/admin/categories", Tags],
    ],
  ],
  [
    "AI & System",
    [
      ["AI Monitoring", "/admin/ai-monitoring", BrainCircuit],
      ["AI Activity Logs", "/admin/ai-logs", ScrollText],
      ["Reports & Analytics", "/admin/reports", ChartNoAxesCombined],
    ],
  ],
  [
    "Administration",
    [
      ["Notifications", "/admin/notifications", Bell],
      ["Audit Logs", "/admin/audit-logs", History],
      ["Settings", "/admin/settings", Settings],
      ["Admin Profile", "/admin/profile", CircleUserRound],
    ],
  ],
]

function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { store, toast } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => setMobile(false), [location.pathname])
  const results =
    query.length < 2
      ? []
      : [
          ...store.users
            .filter((u) =>
              `${u.name} ${u.email} ${u.id}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 4)
            .map((u) => ({
              label: u.name,
              type: "User",
              href: `/admin/users/${u.id}`,
            })),
          ...store.aiJobs
            .filter((j) =>
              `${j.id} ${j.feature}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 3)
            .map((j) => ({
              label: `${j.id} · ${j.feature}`,
              type: "AI job",
              href: `/admin/ai-monitoring/${j.id}`,
            })),
          ...store.reports
            .filter((r) =>
              `${r.id} ${r.reference}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 3)
            .map((r) => ({
              label: `${r.id} · ${r.reference}`,
              type: "Report",
              href: `/admin/content/${r.id}`,
            })),
          ...staticData.memories
            .filter((m) =>
              `${m.id} ${m.title}`.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 3)
            .map((m) => ({
              label: `${m.id} · ${m.title}`,
              type: "Memory metadata",
              href: "/admin/memories",
            })),
        ]
  const unread = store.notifications.filter((n) => !n.read).length
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {mobile && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-slate-950 text-white transition-all ${
          mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-20" : "w-72"}`}
      >
        <div className="flex h-17 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500 font-bold">
              M
            </div>
            {!collapsed && (
              <div>
                <div className="font-bold">MindLog AI</div>
                <div className="text-xs text-slate-400">Administration</div>
              </div>
            )}
          </div>
          <Button
            className="lg:hidden"
            variant="ghost"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(([label, links]) => (
            <div key={label} className="mb-5">
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
                  {label}
                </div>
              )}
              {links.map(([name, href, Icon]) => (
                <NavLink
                  key={href}
                  to={href}
                  title={collapsed ? name : undefined}
                  className={({ isActive }) =>
                    `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-violet-500 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {!collapsed && <span>{name}</span>}
                  {name === "Notifications" && unread > 0 && !collapsed && (
                    <span className="ml-auto rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                      {unread}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <NavLink
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <ExternalLink size={18} />
            {!collapsed && "Back to User App"}
          </NavLink>
          <button
            onClick={() => {
              localStorage.removeItem("mindlog-admin-auth")
              navigate("/admin/login")
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} />
            {!collapsed && "Sign out"}
          </button>
          <Button
            variant="ghost"
            className="mt-1 hidden w-full text-slate-400 lg:flex"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={18} />
            {!collapsed && "Collapse sidebar"}
          </Button>
        </div>
      </aside>
      <div className={`transition-all ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="sticky top-0 z-20 flex h-17 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </Button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex max-w-xl flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 hover:border-slate-300"
          >
            <Search size={17} /> Search authorized records…{" "}
            <kbd className="ml-auto hidden rounded border bg-white px-1.5 py-0.5 text-[10px] sm:block">
              ⌘ K
            </kbd>
          </button>
          <NavLink
            to="/admin/notifications"
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-500" />
            )}
          </NavLink>
          <NavLink
            to="/admin/profile"
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
              AD
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold">Amina Diallo</span>
              <span className="block text-[10px] text-slate-400">
                Super Admin
              </span>
            </span>
          </NavLink>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-[10vh]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b p-4">
              <SearchField
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users, metadata, AI jobs, reports…"
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {query.length < 2 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  Enter at least two characters. Private journal and mood
                  content is excluded.
                </p>
              ) : results.length ? (
                results.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigate(result.href)
                      setSearchOpen(false)
                      setQuery("")
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium">{result.label}</span>
                    <Badge>{result.type}</Badge>
                  </button>
                ))
              ) : (
                <p className="p-8 text-center text-sm text-slate-400">
                  No authorized metadata results found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  )
}
