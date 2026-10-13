import { useState } from "react"
import { Link, useNavigate } from "react-router"
import {
  Brain,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button, Input } from "../../components/ui"
import { useStore } from "../../store/AppStore"

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-10 inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white">
              <Brain />
            </span>
            <span className="text-xl font-extrabold">
              MindLog <b className="text-violet-600">AI</b>
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold">
            <Sparkles size={14} /> Your personal AI workspace
          </span>
        </div>
        <div className="relative max-w-xl">
          <blockquote className="text-4xl font-semibold leading-tight">
            "Your days become memories. MindLog helps you take care of them."
          </blockquote>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              "Private by design",
              "Built for you",
              "Always accessible",
            ].map((x) => (
              <div
                key={x}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold"
              >
                <ShieldCheck className="mb-3 text-cyan-300" />
                {x}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-slate-400">
          Your life, your memories, your story.
        </p>
      </div>
    </div>
  )
}

export function Login() {
  const [form, setForm] = useState({
    usernameOrEmail: "",
    password: "",
  })
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { login } = useStore()

  const submit = async (e) => {
    e.preventDefault()
    setError("")

    if (!form.usernameOrEmail.trim() || !form.password) {
      setError("Please enter your email/username and password.")
      return
    }

    setLoading(true)
    try {
      const response = await login(form.usernameOrEmail, form.password)
      // Redirect based on user role from the login response
      const userRole = response.user?.role
      if (userRole === "admin") {
        nav("/admin/dashboard")
      } else {
        nav("/dashboard")
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to access your personal journal."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Email or username"
          type="text"
          value={form.usernameOrEmail}
          onChange={(e) =>
            setForm({ ...form, usernameOrEmail: e.target.value })
          }
          disabled={loading}
        />
        <div className="relative">
          <Input
            label="Password"
            type={show ? "text" : "password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-10 text-slate-400"
            aria-label="Show password"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              className="accent-violet-600"
              disabled={loading}
            />
            Remember me
          </label>
          <Link className="font-bold text-violet-600" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link className="font-bold text-violet-600" to="/register">
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}

/**
 * AdminLogin - Real admin authentication using Django JWT backend
 * Only admins (role === "admin") can access the admin dashboard
 */
export function AdminLogin() {
  const [form, setForm] = useState({
    usernameOrEmail: "",
    password: "",
  })
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const { login } = useStore()

  const submit = async (e) => {
    e.preventDefault()
    setError("")

    if (!form.usernameOrEmail.trim() || !form.password) {
      setError("Please enter your email and password.")
      return
    }

    setLoading(true)
    try {
      const response = await login(form.usernameOrEmail, form.password)
      const userRole = response.user?.role

      // Only admins can login via admin panel
      if (userRole === "admin") {
        nav("/admin/dashboard")
      } else {
        setError("You do not have administrator privileges.")
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <div className="hidden bg-slate-950 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500 text-lg font-bold">
            M
          </span>
          <div>
            <div className="font-bold">MindLog AI</div>
            <div className="text-xs text-slate-400">
              Restricted administration
            </div>
          </div>
        </div>
        <div>
          <div className="mb-5 h-1 w-16 rounded-full bg-cyan-400" />
          <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight">
            A calm, responsible view of platform operations.
          </h1>
          <p className="mt-6 max-w-lg leading-7 text-slate-400">
            Monitor service health and support users while protecting their
            private reflections and personal data.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Authentication is required. Only Django-verified administrators can
          access this area.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 font-bold text-white">
              M
            </span>
          </div>
          <p className="text-sm font-semibold text-violet-600">
            MindLog AI Admin
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Administration
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with an authorized administrator account.
          </p>
          <div className="mt-8 space-y-4">
            <Input
              label="Email or username"
              type="text"
              value={form.usernameOrEmail}
              onChange={(e) =>
                setForm({ ...form, usernameOrEmail: e.target.value })
              }
              disabled={loading}
            />
            <div className="relative">
              <Input
                label="Password"
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-10 text-slate-400"
                aria-label="Show password"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-violet-600"
                  disabled={loading}
                />
                Remember me
              </label>
              <Link
                className="font-semibold text-violet-600"
                to="/admin/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            {error && (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in to administration"}
            </Button>
          </div>
          <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            <strong>Admin access required</strong>
            <br />
            Only users with administrator privileges can access this panel.
            Use your regular account credentials.
          </div>
        </form>
      </div>
    </div>
  )
}

export function Register() {
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    terms: false,
  })
  const nav = useNavigate()
  const { register } = useStore()

  const set = (k, v) => setForm({ ...form, [k]: v })

  const submit = async (e) => {
    e.preventDefault()
    setError("")

    if (!form.first_name.trim() || !form.email || form.password.length < 8) {
      setError(
        "Please complete all fields. Password must be at least 8 characters."
      )
      return
    }

    if (form.password !== form.password_confirm) {
      setError("Passwords do not match.")
      return
    }

    if (!form.terms) {
      setError("Please accept the terms and conditions.")
      return
    }

    setLoading(true)
    try {
      await register({
        username: form.username || form.email,
        email: form.email,
        password: form.password,
        password_confirm: form.password_confirm,
        first_name: form.first_name,
        last_name: form.last_name,
      })
      nav("/login")
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start preserving what matters, at your own pace."
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          value={form.first_name}
          onChange={(e) => set("first_name", e.target.value)}
          disabled={loading}
        />
        <Input
          label="Last name"
          value={form.last_name}
          onChange={(e) => set("last_name", e.target.value)}
          disabled={loading}
        />
        <Input
          className="col-span-2"
          label="Username"
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
          disabled={loading}
        />
        <Input
          className="col-span-2"
          label="Email address"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={loading}
        />
        <Input
          label="Password"
          type={show ? "text" : "password"}
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          disabled={loading}
        />
        <Input
          label="Confirm password"
          type={show ? "text" : "password"}
          value={form.password_confirm}
          onChange={(e) => set("password_confirm", e.target.value)}
          disabled={loading}
        />
        <button
          type="button"
          className="col-span-2 text-left text-xs font-bold text-violet-600"
          onClick={() => setShow(!show)}
          disabled={loading}
        >
          {show ? "Hide" : "Show"} passwords
        </button>
        <div className="col-span-2 h-1.5 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${
              form.password.length > 10
                ? "w-full bg-emerald-500"
                : form.password.length > 5
                  ? "w-2/3 bg-amber-400"
                  : "w-1/3 bg-red-400"
            }`}
          />
        </div>
        <label className="col-span-2 flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => set("terms", e.target.checked)}
            className="mt-1 accent-violet-600"
            disabled={loading}
          />{" "}
          I accept the terms of service.
        </label>
        {error && (
          <p className="col-span-2 text-sm text-red-600">{error}</p>
        )}
        <Button className="col-span-2" disabled={loading}>
          {loading ? "Creating account..." : "Create my account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm">
        Already a member?{" "}
        <Link to="/login" className="font-bold text-violet-600">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

export function Forgot({ reset = false }) {
  const [done, setDone] = useState(false)
  const [value, setValue] = useState("")

  return (
    <AuthLayout
      title={
        reset
          ? "Choose a new password"
          : "Reset your password"
      }
      subtitle="This action is simulated in the demo version."
    >
      {done ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <Check className="mx-auto text-emerald-600" />
          <h2 className="mt-3 font-extrabold">Request recorded</h2>
          <p className="mt-2 text-sm text-slate-600">
            {reset
              ? "Your demo password has been updated."
              : "A reset link has been sent to your email."}
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block font-bold text-violet-600"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.length > 5) setDone(true)
          }}
          className="space-y-4"
        >
          <Input
            label={reset ? "New password" : "Email address"}
            type={reset ? "password" : "email"}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {reset && (
            <Input label="Confirm password" type="password" required />
          )}
          <Button className="w-full">
            {reset ? "Update password" : "Send reset link"}
          </Button>
          <Link
            to="/login"
            className="block text-center text-sm font-bold text-violet-600"
          >
            Back to login
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState(["Memories", "Learning"])
  const nav = useNavigate()

  const steps = [
    [
      "Welcome to MindLog AI",
      "We'll personalize your space in a few steps.",
    ],
    [
      "Your preferences",
      "Choose the language and appearance that suit you.",
    ],
    [
      "What matters to you",
      "Select the topics you want to track.",
    ],
    [
      "Your space is ready",
      "Start telling your story today.",
    ],
  ]

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
        <div className="mb-10 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-violet-600" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
        <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
          <Brain />
        </div>
        <h1 className="text-3xl font-extrabold">{steps[step][0]}</h1>
        <p className="mt-2 text-slate-500">{steps[step][1]}</p>
        <div className="my-8 min-h-40">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="First name" defaultValue="John" />
              <Input label="Last name" defaultValue="Doe" />
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="rounded-2xl border-2 border-violet-500 bg-violet-50 p-5 font-bold">
                English{" "}
                <span className="block text-sm font-normal text-slate-500">
                  Interface language
                </span>
              </label>
              <label className="rounded-2xl border border-slate-200 p-5 font-bold">
                Light mode{" "}
                <span className="block text-sm font-normal text-slate-500">
                  You can change this later
                </span>
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-wrap gap-3">
              {[
                "Memories",
                "Emotions",
                "Habits",
                "Learning",
                "Travel",
                "Family",
              ].map((x) => (
                <button
                  key={x}
                  onClick={() =>
                    setSelected(
                      selected.includes(x)
                        ? selected.filter((y) => y !== x)
                        : [...selected, x],
                    )
                  }
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    selected.includes(x)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-800">
              <Check className="mb-3" />
              Your preferences have been saved to your account.
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <div className="flex gap-2">
            {step < 3 && (
              <Button variant="secondary" onClick={() => setStep(3)}>
                Skip
              </Button>
            )}
            <Button
              onClick={() =>
                step === 3 ? nav("/dashboard") : setStep(step + 1)
              }
            >
              {step === 3 ? "Open dashboard" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
