
import { createBrowserRouter, Navigate } from "react-router"

import AppShell from "../components/AppShell"
import { ProtectedRoute, GuestRoute, AdminRoute, PublicRoute } from "../components/ProtectedRoute"

import { Login, Register, Forgot, Onboarding, AdminLogin } from "../features/auth/AuthPages"
import Dashboard from "../features/dashboard/Dashboard"

import {
  JournalPage,
  MoodPage,
  MediaPage,
  GoalsPage,
} from "../features/modules/ModulePages"

import {
  MemoriesList,
  MemoryForm,
  MemoryDetail,
  Timeline,
  MemoryCalendar,
  MemoryInsights,
  MemorySearch,
} from "../features/memories/MemoryPages"

import {
  AiInsights,
  Notifications,
  Profile,
  Settings,
  NotFound,
} from "../features/misc/MiscPages"

// Admin imports
import AdminLayout from "../admin/AdminLayout.jsx"
import { adminSession } from "../admin/services.js"

import {
  AdminIndex,
  AILogs,
  AIMonitoring,
  AIJobDetail,
  AuditLogs,
  CategoriesPage,
  Dashboard as AdminDashboard,
  ForgotPassword,
  MediaDetail,
  ModerationDetail,
  ModerationPage,
  NotFound as AdminNotFound,
  NotificationsPage,
  ProfilePage,
  ReportsPage,
  ResourcePage,
  RolesPage,
  SettingsPage,
  UserDetail,
  UsersPage,
} from "../admin/pages.jsx"

// User routes (protected by AppShell)
const shell = [
  { path: "dashboard", Component: Dashboard },

  { path: "journal", element: <JournalPage /> },
  { path: "journal/new", element: <JournalPage mode="new" /> },
  { path: "journal/:id", element: <JournalPage mode="detail" /> },
  { path: "journal/:id/edit", element: <JournalPage mode="edit" /> },

  { path: "mood", element: <MoodPage /> },
  { path: "mood/new", element: <MoodPage mode="new" /> },
  { path: "mood/history", element: <MoodPage mode="history" /> },
  { path: "mood/insights", element: <MoodPage mode="insights" /> },
  { path: "mood/:id/edit", element: <MoodPage mode="edit" /> },
  { path: "mood/:id", element: <MoodPage mode="detail" /> },

  { path: "media", element: <MediaPage /> },
  { path: "media/upload", element: <MediaPage mode="upload" /> },
  { path: "media/ai-image", element: <MediaPage mode="ai" /> },
  { path: "media/people", element: <MediaPage mode="people" /> },
  { path: "media/transcription", element: <MediaPage mode="transcription" /> },
  { path: "media/:id", element: <MediaPage mode="detail" /> },

  { path: "goals", element: <GoalsPage /> },
  { path: "goals/new", element: <GoalsPage mode="new" /> },
  { path: "goals/insights", element: <GoalsPage mode="insights" /> },
  { path: "goals/:id", element: <GoalsPage mode="detail" /> },
  { path: "goals/:id/edit", element: <GoalsPage mode="edit" /> },
  { path: "habits", element: <GoalsPage mode="habits" /> },

  { path: "memories", Component: MemoriesList },
  { path: "memories/new", element: <MemoryForm /> },
  { path: "memories/timeline", Component: Timeline },
  { path: "memories/calendar", Component: MemoryCalendar },
  { path: "memories/insights", Component: MemoryInsights },
  { path: "memories/search", Component: MemorySearch },
  { path: "memories/:id", Component: MemoryDetail },
  { path: "memories/:id/edit", element: <MemoryForm edit /> },

  { path: "ai-insights", Component: AiInsights },
  { path: "notifications", Component: Notifications },
  { path: "profile", Component: Profile },
  { path: "settings", Component: Settings },
  { path: "*", Component: NotFound },
]

// Protect Admin pages with JWT auth
function ProtectedAdminLayout() {
  return <AdminRoute Component={AdminLayout} />
}

// Application routes
export const router = createBrowserRouter([
  // User app
  { path: "/login", element: <GuestRoute Component={Login} /> },
  { path: "/register", element: <PublicRoute Component={Register} /> },
  { path: "/forgot-password", element: <GuestRoute Component={() => <Forgot />} /> },
  { path: "/reset-password", element: <GuestRoute Component={() => <Forgot reset />} /> },
  { path: "/onboarding", element: <ProtectedRoute Component={Onboarding} /> },
  { path: "/", element: <ProtectedRoute Component={() => <AppShell />} />, children: shell },

  // Admin login pages
  { path: "/admin/login", element: <GuestRoute Component={AdminLogin} /> },
  { path: "/admin/forgot-password", Component: ForgotPassword },

  // Admin dashboard and pages
  {
    path: "/admin",
    Component: ProtectedAdminLayout,
    children: [
      { index: true, Component: AdminIndex },
      { path: "dashboard", Component: AdminDashboard },

      { path: "users", Component: UsersPage },
      { path: "users/:id", Component: UserDetail },
      { path: "roles", Component: RolesPage },

      { path: "content", Component: ModerationPage },
      { path: "content/:id", Component: ModerationDetail },

      { path: "journal", element: <ResourcePage type="journal" /> },
      { path: "mood", element: <ResourcePage type="mood" /> },
      { path: "multimedia", element: <ResourcePage type="multimedia" /> },
      { path: "multimedia/:id", Component: MediaDetail },
      { path: "memories", element: <ResourcePage type="memories" /> },
      { path: "goals", element: <ResourcePage type="goals" /> },
      { path: "categories", Component: CategoriesPage },

      { path: "ai-monitoring", Component: AIMonitoring },
      { path: "ai-monitoring/:id", Component: AIJobDetail },
      { path: "ai-logs", Component: AILogs },
      { path: "reports", Component: ReportsPage },

      { path: "notifications", Component: NotificationsPage },
      { path: "audit-logs", Component: AuditLogs },
      { path: "settings", Component: SettingsPage },
      { path: "profile", Component: ProfilePage },

      { path: "*", Component: AdminNotFound },
    ],
  },
])
