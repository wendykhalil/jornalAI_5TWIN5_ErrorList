import { Navigate } from "react-router"
import { useStore } from "../store/AppStore"

/**
 * ProtectedRoute component that redirects unauthenticated users to login
 * Usage: <ProtectedRoute Component={Dashboard} />
 */
export function ProtectedRoute({ Component }) {
  const { isAuthenticated, authLoading } = useStore()

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-violet-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <Component /> : <Navigate to="/login" replace />
}

/**
 * AdminRoute component that redirects non-admin users
 * Usage: <AdminRoute Component={AdminDashboard} />
 */
export function AdminRoute({ Component }) {
  const { isAuthenticated, user, authLoading } = useStore()

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-violet-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return user?.role === "admin" ? (
    <Component />
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

/**
 * GuestRoute component that redirects authenticated users away from auth pages
 * Used for /login and /admin/login - authenticated users are redirected to their appropriate dashboard
 * Usage: <GuestRoute Component={Login} />
 */
export function GuestRoute({ Component }) {
  const { isAuthenticated, authLoading, user } = useStore()

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-violet-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    // Redirect authenticated users based on their role
    const redirectPath = user?.role === "admin" ? "/admin/dashboard" : "/dashboard"
    return <Navigate to={redirectPath} replace />
  }

  return <Component />
}

/**
 * PublicRoute component that allows both authenticated and unauthenticated users
 * Used for /register to allow existing authenticated users to create a new registration
 * (which will clear their current session during form submission)
 * Usage: <PublicRoute Component={Register} />
 */
export function PublicRoute({ Component }) {
  const { authLoading } = useStore()

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-violet-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Allow component to render regardless of authentication status
  return <Component />
}
