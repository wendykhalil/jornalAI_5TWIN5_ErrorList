import { useMemo, useState } from "react"
import AdminJournalPage from "./AdminJournalPage.jsx"
import AdminMoodPage from "./AdminMoodPage.jsx"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import {
  Users,
  UserCheck,
  UserPlus,
  BookOpen,
  CalendarHeart,
  Images,
  BrainCircuit,
  TriangleAlert,
  Activity,
  ShieldCheck,
  Eye,
  RotateCcw,
  Plus,
  Pencil,
  Bell,
  CheckCheck,
  Trash2,
  Save,
  Database,
  Clock3,
  CheckCircle2,
  XCircle,
  Target,
  Tags,
  LockKeyhole,
  ArrowLeft,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAdmin } from "./AdminContext.jsx"
import { activityTrend, roles } from "./mockData.js"
import { adminSession, authenticate, staticData } from "./services.js"
import {
  Badge,
  Button,
  Card,
  DataTable,
  ExportButton,
  Input,
  Modal,
  PageHeader,
  SearchField,
  Select,
  StatCard,
} from "./ui.jsx"

const chartColors = ["#6C63FF", "#22D3EE", "#10B981", "#F59E0B", "#F43F5E"]
const moduleData = [
  { name: "Journal", value: 34 },
  { name: "Mood", value: 22 },
  { name: "Memories", value: 19 },
  { name: "Goals", value: 14 },
  { name: "Media", value: 11 },
]
const titleCase = (value) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function UserLanding() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex min-h-[90vh] max-w-5xl items-center">
        <Card className="w-full overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="bg-slate-950 p-10 text-white md:p-14">
              <div className="mb-16 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 text-lg font-bold">
                M
              </div>
              <p className="text-sm font-semibold text-cyan-300">MindLog AI</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                Your private space for reflection and growth.
              </h1>
              <p className="mt-5 leading-7 text-slate-400">
                The user application remains separate from administration. This
                scaffold did not contain previous user modules, so this route is
                preserved as the user-facing entry point.
              </p>
            </div>
            <div className="flex flex-col justify-center p-10 md:p-14">
              <Badge tone="violet">Frontend demonstration</Badge>
              <h2 className="mt-5 text-2xl font-bold">
                Administrative workspace
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Authorized team members can access operational monitoring,
                privacy-aware moderation, analytics, and system administration.
              </p>
              <Link
                className="mt-8 inline-flex w-fit items-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                to="/admin/login"
              >
                Open admin login
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    email: "admin@mindlog.ai",
    password: "MindlogDemo!",
  })
  const [error, setError] = useState("")
  const submit = (event) => {
    event.preventDefault()
    if (!form.email.includes("@") || !form.password)
      return setError("Enter a valid administrator email and password.")
    if (!authenticate(form.email, form.password))
      return setError("The mock credentials do not match.")
    adminSession.set(true)
    navigate("/admin/dashboard")
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
          Client-side access is demonstrative only. Django must enforce
          authentication and authorization.
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
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Password"
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  defaultChecked
                  className="accent-violet-600"
                />{" "}
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
            <Button className="w-full" type="submit">
              Sign in to administration
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              type="button"
              onClick={() => setShow(!show)}
            >
              {show ? "Hide password" : "Show password"}
            </Button>
          </div>
          <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50 p-4 text-xs leading-5 text-violet-800">
            <strong>Demo administrator</strong>
            <br />
            admin@mindlog.ai
            <br />
            MindlogDemo!
          </div>
        </form>
      </div>
    </div>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 font-bold text-white">
          M
        </span>
        <h1 className="mt-6 text-2xl font-bold">Reset admin password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your administrator email. This demo simulates the recovery
          workflow.
        </p>
        {sent ? (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            If the account exists, recovery instructions have been simulated.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <Input
              label="Administrator email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!email.includes("@")}
              onClick={() => setSent(true)}
            >
              Send recovery link
            </Button>
          </div>
        )}
        <Link
          to="/admin/login"
          className="mt-6 inline-flex text-sm font-semibold text-violet-600"
        >
          Return to admin login
        </Link>
      </Card>
    </div>
  )
}

export function Dashboard() {
  const { store } = useAdmin()
  const [period, setPeriod] = useState("Last 7 days")
  const failed = store.aiJobs.filter((j) => j.status === "Failed").length
  const active = store.users.filter((u) => u.status === "Active").length
  const stats = [
    ["Registered users", store.users.length, "+8.4% this month", Users],
    [
      "Active users",
      active,
      `${Math.round((active / store.users.length) * 100)}% of users`,
      UserCheck,
    ],
    [
      "New this month",
      store.users.filter((u) => u.registeredAt.startsWith("2025-10")).length,
      "+3 from prior period",
      UserPlus,
    ],
    ["Journal entries", staticData.journalEntries.length, "+12.6%", BookOpen],
    ["Memories", staticData.memories.length, "+9.2%", CalendarHeart],
    ["Multimedia items", staticData.media.length, "3 need attention", Images],
    ["AI operations", store.aiJobs.length, "+18.1%", BrainCircuit],
    [
      "AI error rate",
      `${Math.round((failed / store.aiJobs.length) * 100)}%`,
      `${failed} failed jobs`,
      TriangleAlert,
    ],
  ]
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational overview across MindLog AI. All values are calculated from the shared demonstration datasets."
        action={
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              "Last 7 days",
              "Last 30 days",
              "Last 90 days",
              "This year",
            ]}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, change, icon]) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            change={change}
            icon={icon}
          />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-5">
            <h2 className="font-bold">Platform activity</h2>
            <p className="text-xs text-slate-500">
              Daily users and AI operations · {period}
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={activityTrend}>
                <defs>
                  <linearGradient id="violet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#6C63FF"
                  fill="url(#violet)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="ai"
                  stroke="#22D3EE"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Activity distribution</h2>
          <p className="text-xs text-slate-500">Aggregate module use</p>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={moduleData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                >
                  {moduleData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Attention />
        <RecentActivity />
      </div>
    </>
  )
}

function Attention() {
  const { store } = useAdmin()
  const items = [
    [
      store.reports.filter((r) => r.status === "Pending Review").length,
      "Reports awaiting review",
      "/admin/content",
    ],
    [
      store.aiJobs.filter((j) => j.status === "Failed").length,
      "AI operations with errors",
      "/admin/ai-monitoring",
    ],
    [
      staticData.media.filter((m) => m.status === "Failed").length,
      "Media processing failures",
      "/admin/multimedia",
    ],
    [2, "Suspicious signals requiring human review", "/admin/audit-logs"],
  ]
  return (
    <Card>
      <div className="border-b p-5">
        <h2 className="font-bold">Attention required</h2>
        <p className="text-xs text-slate-500">
          Signals are not proof of wrongdoing.
        </p>
      </div>
      <div className="divide-y">
        {items.map(([count, label, href]) => (
          <Link
            key={label}
            to={href}
            className="flex items-center gap-4 p-4 hover:bg-slate-50"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 font-bold text-amber-700">
              {count}
            </span>
            <span className="flex-1 text-sm font-medium">{label}</span>
            <span className="text-violet-600">View →</span>
          </Link>
        ))}
      </div>
    </Card>
  )
}
function RecentActivity() {
  const rows = [
    {
      id: 1,
      time: "10:42",
      type: "User registration",
      entity: "USR-020",
      status: "Completed",
    },
    {
      id: 2,
      time: "10:31",
      type: "Memory created",
      entity: "MEM-3024",
      status: "Completed",
    },
    {
      id: 3,
      time: "10:18",
      type: "Media upload",
      entity: "MED-2030",
      status: "Processing",
    },
    {
      id: 4,
      time: "09:54",
      type: "AI summary",
      entity: "AI-4024",
      status: "Failed",
    },
    {
      id: 5,
      time: "09:36",
      type: "Content report",
      entity: "RPT-5010",
      status: "Pending Review",
    },
  ]
  return (
    <Card>
      <div className="border-b p-5">
        <h2 className="font-bold">Recent activity</h2>
        <p className="text-xs text-slate-500">
          Privacy-safe operational events
        </p>
      </div>
      <DataTable
        columns={[
          { key: "time", label: "Time" },
          { key: "type", label: "Activity" },
          { key: "entity", label: "Entity" },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge>{r.status}</Badge>,
          },
        ]}
        rows={rows}
      />
    </Card>
  )
}

export function UsersPage() {
  const { store, actions } = useAdmin()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("All statuses")
  const [role, setRole] = useState("All roles")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState("")
  const filtered = store.users.filter(
    (u) =>
      `${u.name} ${u.username} ${u.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" || u.status === status) &&
      (role === "All roles" || u.role === role),
  )
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const columns = [
    {
      key: "name",
      label: "User",
      render: (u) => (
        <Link
          to={`/admin/users/${u.id}`}
          className="flex items-center gap-3 font-semibold text-slate-900"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-xs text-violet-700">
            {u.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
          <span>
            {u.name}
            <small className="block font-normal text-slate-400">
              @{u.username}
            </small>
          </span>
        </Link>
      ),
    },
    { key: "email", label: "Email" },
    { key: "registeredAt", label: "Registered" },
    { key: "lastActivity", label: "Last active" },
    {
      key: "status",
      label: "Status",
      render: (u) => <Badge>{u.status}</Badge>,
    },
    { key: "role", label: "Role" },
    { key: "journals", label: "Journal" },
    { key: "memories", label: "Memories" },
    { key: "media", label: "Media" },
    {
      key: "actions",
      label: "Actions",
      render: (u) => (
        <div className="flex gap-1">
          <Link
            className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"
            to={`/admin/users/${u.id}`}
          >
            <Eye size={16} />
          </Link>
          <Button variant="ghost" onClick={() => setSelected(u)}>
            <ShieldCheck size={16} />
          </Button>
        </div>
      ),
    },
  ]
  const confirm = () => {
    actions.updateUser(
      selected.id,
      { status: selected.status === "Suspended" ? "Active" : "Suspended" },
      reason || "Account status review",
    )
    setSelected(null)
    setReason("")
  }
  return (
    <>
      <PageHeader
        title="Users"
        description="Manage account metadata and status without exposing passwords or private content."
        action={
          <div className="flex gap-2">
            <ExportButton rows={filtered} filename="mindlog-users.csv" />
            <Button>
              <Plus size={16} /> Add user
            </Button>
          </div>
        }
      />
      <Card>
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[1fr_180px_160px_auto]">
          <SearchField
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, username, or email"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              "All statuses",
              "Active",
              "Inactive",
              "Suspended",
              "Pending verification",
            ]}
          />
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={["All roles", "Member", "Moderator", "Administrator"]}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("")
              setStatus("All statuses")
              setRole("All roles")
            }}
          >
            Clear filters
          </Button>
        </div>
        <DataTable columns={columns} rows={visible} />
        <div className="flex flex-col items-center justify-between gap-3 border-t p-4 text-sm text-slate-500 sm:flex-row">
          <span>
            Showing {visible.length} of {filtered.length} users
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              options={["5", "10", "20"]}
            />
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              variant="secondary"
              disabled={page * pageSize >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected?.status === "Suspended"
            ? "Restore account"
            : "Suspend account"
        }
        description={`You are changing access for ${selected?.name}. This requires backend enforcement in production.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              variant={selected?.status === "Suspended" ? "primary" : "danger"}
              disabled={!reason.trim()}
              onClick={confirm}
            >
              Confirm action
            </Button>
          </>
        }
      >
        <Input
          label="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Document the administrative reason"
        />
      </Modal>
    </>
  )
}

export function UserDetail() {
  const { id } = useParams()
  const { store, actions } = useAdmin()
  const user = store.users.find((u) => u.id === id)
  const [modal, setModal] = useState(false)
  const [status, setStatus] = useState(user?.status || "Active")
  const [reason, setReason] = useState("")
  if (!user) return <NotFound />
  const metrics = [
    ["Journal entries", user.journals],
    ["Mood check-ins", user.moods],
    ["Multimedia", user.media],
    ["Memories", user.memories],
    ["Goals & habits", user.goals],
  ]
  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.id} · Privacy-aware account overview`}
        action={
          <Link to="/admin/users">
            <Button variant="secondary">
              <ArrowLeft size={16} /> Users
            </Button>
          </Link>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-xl font-bold text-violet-700">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <h2 className="mt-4 text-xl font-bold">{user.name}</h2>
          <p className="text-sm text-slate-500">@{user.username}</p>
          <div className="mt-4">
            <Badge>{user.status}</Badge>
          </div>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-slate-400">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Registered</dt>
              <dd className="font-medium">{user.registeredAt}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Last activity</dt>
              <dd className="font-medium">{user.lastActivity}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Role</dt>
              <dd className="font-medium">{user.role}</dd>
            </div>
          </dl>
        </Card>
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map(([l, v]) => (
              <StatCard key={l} label={l} value={v} />
            ))}
          </div>
          <Card>
            <div className="border-b p-5">
              <h2 className="font-bold">Recent authorized activity</h2>
            </div>
            <DataTable
              rows={[
                {
                  id: 1,
                  time: "Today, 09:42",
                  event: "Account sign-in",
                  module: "Account",
                },
                {
                  id: 2,
                  time: "Yesterday",
                  event: "Used memory search",
                  module: "Memories",
                },
                {
                  id: 3,
                  time: "Oct 24",
                  event: "Updated profile metadata",
                  module: "Account",
                },
              ]}
              columns={[
                { key: "time", label: "Timestamp" },
                { key: "event", label: "Event" },
                { key: "module", label: "Module" },
              ]}
            />
          </Card>
          <Card className="p-5">
            <h2 className="font-bold">Administrative actions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sensitive actions are logged and must be enforced by the future
              backend.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setModal(true)}>
                Change account status
              </Button>
              <Button variant="secondary">Change role</Button>
              <Link to="/admin/audit-logs">
                <Button variant="secondary">View audit history</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Change account status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reason}
              onClick={() => {
                actions.updateUser(id, { status }, reason)
                setModal(false)
              }}
            >
              Save change
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="New status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              "Active",
              "Inactive",
              "Suspended",
              "Pending verification",
            ]}
          />
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}

export function RolesPage() {
  const permissions = [
    "View dashboard",
    "Manage users",
    "Manage roles",
    "Review reported content",
    "Manage media metadata",
    "View aggregate mood statistics",
    "View private content when explicitly authorized",
    "View AI operational logs",
    "Manage settings",
  ]
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState([])
  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Mock role visibility for interface demonstration. Hiding controls is not security; Django must enforce every permission."
      />
      <Card>
        <DataTable
          rows={roles}
          columns={[
            {
              key: "name",
              label: "Role",
              render: (r) => (
                <span className="font-semibold text-slate-900">{r.name}</span>
              ),
            },
            { key: "members", label: "Members" },
            {
              key: "permissions",
              label: "Permission coverage",
              render: (r) => (
                <span>
                  {r.permissions.filter(Boolean).length} of {permissions.length}
                </span>
              ),
            },
            {
              key: "action",
              label: "",
              render: (r) => (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(r)
                    setDraft([...r.permissions])
                  }}
                >
                  <Pencil size={15} /> Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">Permission matrix</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left">Capability</th>
                {roles.map((r) => (
                  <th key={r.name} className="p-3 text-center">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, i) => (
                <tr key={p} className="border-t">
                  <td className="p-3 text-slate-600">{p}</td>
                  {roles.map((r) => (
                    <td key={r.name} className="p-3 text-center">
                      {r.permissions[i] ? (
                        <CheckCircle2
                          className="mx-auto text-emerald-500"
                          size={17}
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name}`}
        description="Changes are simulated for this frontend prototype."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => setEditing(null)}>
              Confirm permissions
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {permissions.map((p, i) => (
            <label
              key={p}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span>{p}</span>
              <input
                type="checkbox"
                className="accent-violet-600"
                checked={!!draft[i]}
                onChange={() =>
                  setDraft(draft.map((v, x) => (x === i ? !v : v)))
                }
              />
            </label>
          ))}
        </div>
      </Modal>
    </>
  )
}

export function ModerationPage() {
  const { store } = useAdmin()
  const [tab, setTab] = useState("Pending Review")
  const rows = store.reports.filter((r) => r.status === tab)
  return (
    <>
      <PageHeader
        title="Content Moderation"
        description="Review reported records with minimum necessary metadata. AI flags never trigger automatic punishment."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["Pending Review", "Under Review", "Resolved", "Dismissed"].map(
          (t) => (
            <Button
              key={t}
              variant={tab === t ? "primary" : "secondary"}
              onClick={() => setTab(t)}
            >
              {t}{" "}
              <Badge>
                {store.reports.filter((r) => r.status === t).length}
              </Badge>
            </Button>
          ),
        )}
      </div>
      <Card>
        <DataTable
          rows={rows}
          columns={[
            {
              key: "id",
              label: "Report",
              render: (r) => (
                <Link
                  className="font-semibold text-violet-600"
                  to={`/admin/content/${r.id}`}
                >
                  {r.id}
                </Link>
              ),
            },
            { key: "type", label: "Content type" },
            { key: "reference", label: "Reference" },
            { key: "reporter", label: "Reporter" },
            { key: "reason", label: "Reason" },
            { key: "reportedAt", label: "Reported" },
            { key: "moderator", label: "Moderator" },
            {
              key: "action",
              label: "",
              render: (r) => (
                <Link to={`/admin/content/${r.id}`}>
                  <Button variant="secondary">Review</Button>
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}

export function ModerationDetail() {
  const { id } = useParams()
  const { store, actions } = useAdmin()
  const report = store.reports.find((r) => r.id === id)
  const [modal, setModal] = useState("")
  const [reason, setReason] = useState("")
  if (!report) return <NotFound />
  return (
    <>
      <PageHeader
        title={`Moderation ${report.id}`}
        description="Controlled review workflow with restricted content access."
        action={
          <Link to="/admin/content">
            <Button variant="secondary">
              <ArrowLeft size={16} /> Queue
            </Button>
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-bold">Report information</h2>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Content type</dt>
              <dd className="font-medium">{report.type}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Reference</dt>
              <dd className="font-medium">{report.reference}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Reason</dt>
              <dd className="font-medium">{report.reason}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Reporter</dt>
              <dd className="font-medium">{report.reporter}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Assigned moderator</dt>
              <dd className="font-medium">{report.moderator}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd>
                <Badge>{report.status}</Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <strong>Restricted content.</strong> Only the minimum metadata is
            shown. Sensitive text or media requires explicit server-authorized
            access and an audit trail.
          </div>
          <div className="mt-6">
            <h3 className="font-semibold">Reporter explanation</h3>
            <p className="mt-2 text-sm text-slate-600">{report.explanation}</p>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Review actions</h2>
          <div className="mt-4 space-y-2">
            {["Under Review", "Resolved", "Dismissed"].map((s) => (
              <Button
                key={s}
                className="w-full"
                variant={s === "Dismissed" ? "secondary" : "primary"}
                onClick={() => setModal(s)}
              >
                Mark {s.toLowerCase()}
              </Button>
            ))}
            <Button className="w-full" variant="secondary">
              Request more information
            </Button>
          </div>
        </Card>
      </div>
      <Modal
        open={!!modal}
        onClose={() => setModal("")}
        title={`Mark report ${modal.toLowerCase()}`}
        description="A moderation reason is required and will be added to the audit log."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal("")}>
              Cancel
            </Button>
            <Button
              disabled={!reason}
              onClick={() => {
                actions.updateReport(id, modal, reason)
                setModal("")
              }}
            >
              Confirm decision
            </Button>
          </>
        }
      >
        <Input
          label="Moderation reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  )
}

const resourceConfigs = {
  journal: {
    title: "Journal Administration",
    description:
      "Aggregate monitoring and authorized moderation. Private entry contents are not available in this list.",
    icon: BookOpen,
    stats: [
      ["Total entries", 30],
      ["Created this week", 8],
      ["Created this month", 21],
      ["Favorites", 6],
      ["AI analyzed", 26],
      ["AI failures", 4],
    ],
    rows: () => staticData.journalEntries,
    columns: [
      ["id", "Entry ID"],
      ["ownerId", "Owner reference"],
      ["title", "Restricted preview"],
      ["createdAt", "Created"],
      ["tags", "Tags"],
      ["aiStatus", "AI analysis"],
      ["reportStatus", "Report"],
    ],
  },
  multimedia: {
    title: "Multimedia",
    description:
      "Manage processing and metadata. Sensitive files are hidden by default.",
    icon: Images,
    stats: [
      ["Total media", 30],
      ["Images", 10],
      ["Audio", 10],
      ["Videos", 10],
      ["Storage estimate", "86.4 MB"],
      ["Processing queue", 3],
      ["Failed jobs", 3],
    ],
    rows: () => staticData.media,
    columns: [
      ["id", "Media ID"],
      ["ownerId", "Owner"],
      ["type", "Type"],
      ["title", "Metadata title"],
      ["uploadedAt", "Uploaded"],
      ["status", "Processing"],
      ["linkedTo", "Linked reference"],
    ],
    detail: "multimedia",
  },
  memories: {
    title: "Memories & Events",
    description:
      "Operational metadata for Souvenirs & Événements. Descriptions and linked media stay restricted.",
    icon: CalendarHeart,
    stats: [
      ["Total memories", 25],
      ["Created this month", 25],
      ["Categories", 4],
      ["Important", 8],
      ["With media", 20],
      ["Reported", 4],
    ],
    rows: () => staticData.memories,
    columns: [
      ["id", "Memory ID"],
      ["ownerId", "Owner"],
      ["title", "Restricted preview"],
      ["eventDate", "Event date"],
      ["category", "Category"],
      ["importance", "Importance"],
      ["mediaCount", "Media"],
      ["aiStatus", "AI status"],
      ["reportStatus", "Report"],
    ],
  },
  goals: {
    title: "Goals & Habits",
    description:
      "Aggregate product activity without unnecessary personal descriptions.",
    icon: Target,
    stats: [
      ["Total goals", 15],
      ["Active goals", 11],
      ["Completed goals", 4],
      ["Total habits", 20],
      ["Completions this week", 94],
    ],
    chart: true,
    rows: () => staticData.goals,
    columns: [
      ["id", "Reference"],
      ["ownerId", "Owner"],
      ["type", "Type"],
      ["createdAt", "Created"],
      ["status", "Status"],
      ["lastActivity", "Last activity"],
      ["reportStatus", "Report"],
    ],
  },
}

export function ResourcePage({ type }) {
  if (type === "journal") {
    return <AdminJournalPage />
  }

  if (type === "mood") {
    return <AdminMoodPage />
  }

  return <OtherResourcePage type={type} />
}

function OtherResourcePage({ type }) {
  const config = resourceConfigs[type]
  const [query, setQuery] = useState("")
  const rows = config
    .rows()
    .filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    )
  const columns = config.columns.map(([key, label]) => ({
    key,
    label,
    render: ["status", "aiStatus", "reportStatus"].includes(key)
      ? (r) => <Badge>{r[key]}</Badge>
      : undefined,
  }))
  if (config.detail)
    columns.push({
      key: "action",
      label: "",
      render: (r) => (
        <Link to={`/admin/${config.detail}/${r.id}`}>
          <Button variant="secondary">Details</Button>
        </Link>
      ),
    })
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        action={<ExportButton rows={rows} filename={`mindlog-${type}.csv`} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.stats.map(([l, v]) => (
          <StatCard key={l} label={l} value={v} icon={config.icon} />
        ))}
      </div>
      {config.chart && (
        <Card className="mt-6 p-5">
          <h2 className="font-bold">Aggregate activity trend</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar
                  dataKey="users"
                  fill="#6C63FF"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card className="mt-6">
        <div className="border-b p-4">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search authorized metadata…"
          />
        </div>
        <DataTable columns={columns} rows={rows} />
      </Card>
    </>
  )
}

export function MediaDetail() {
  const { id } = useParams()
  const item = staticData.media.find((m) => m.id === id)
  const { actions } = useAdmin()
  if (!item) return <NotFound />
  return (
    <>
      <PageHeader
        title={item.id}
        description="Media operational detail. File contents remain private."
        action={
          <Link to="/admin/multimedia">
            <Button variant="secondary">
              <ArrowLeft size={16} /> Multimedia
            </Button>
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="grid h-40 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <Images size={42} />
            <span className="sr-only">Private media not displayed</span>
          </div>
          <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
            {Object.entries(item).map(([k, v]) => (
              <div key={k}>
                <span className="block text-xs uppercase tracking-wide text-slate-400">
                  {titleCase(k)}
                </span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Processing actions</h2>
          <p className="mt-2 text-sm text-slate-500">
            AI/provider information is simulated.
          </p>
          <div className="mt-4 space-y-2">
            <Button
              className="w-full"
              disabled={item.status !== "Failed"}
              onClick={() => actions.retryJob("AI-4001")}
            >
              <RotateCcw size={16} /> Retry processing
            </Button>
            <Button className="w-full" variant="secondary">
              Edit metadata
            </Button>
            <Button className="w-full" variant="secondary">
              Review report
            </Button>
            <Button className="w-full" variant="danger">
              Delete media record
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

export function CategoriesPage() {
  const { store, actions } = useAdmin()
  const [tab, setTab] = useState("Memory categories")
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "Active",
  })
  const open = (item) => {
    setEditing(item || {})
    setForm(item || { name: "", description: "", status: "Active" })
  }
  return (
    <>
      <PageHeader
        title="Categories & Tags"
        description="Manage shared taxonomy safely. In-use categories can be deactivated but not silently deleted."
        action={
          <Button onClick={() => open(null)}>
            <Plus size={16} /> New category
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        {["Memory categories", "Approved tags", "Taxonomy settings"].map(
          (t) => (
            <Button
              key={t}
              variant={tab === t ? "primary" : "secondary"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ),
        )}
      </div>
      <Card>
        <DataTable
          rows={store.categories}
          columns={[
            {
              key: "name",
              label: "Category",
              render: (r) => (
                <span className="font-semibold text-slate-900">{r.name}</span>
              ),
            },
            { key: "description", label: "Description" },
            { key: "usage", label: "Usage" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            { key: "createdAt", label: "Created" },
            {
              key: "action",
              label: "",
              render: (r) => (
                <Button variant="secondary" onClick={() => open(r)}>
                  <Pencil size={15} /> Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit category" : "Create category"}
        description={
          editing?.usage
            ? `Used by ${editing.usage} records; deactivate instead of deleting.`
            : "Add an approved shared category."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name?.trim()}
              onClick={() => {
                actions.updateCategory(editing.id, form)
                setEditing(null)
              }}
            >
              Save category
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Description"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            label="Status"
            value={form.status || "Active"}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={["Active", "Inactive"]}
          />
        </div>
      </Modal>
    </>
  )
}

export function AIMonitoring() {
  const { store, actions } = useAdmin()
  const [status, setStatus] = useState("All statuses")
  const failed = store.aiJobs.filter((j) => j.status === "Failed").length
  const completed = store.aiJobs.filter((j) => j.status === "Completed").length
  const rows = store.aiJobs.filter(
    (j) => status === "All statuses" || j.status === status,
  )
  return (
    <>
      <PageHeader
        title="AI Monitoring"
        description="Simulated operational telemetry without private prompts, journal content, or provider credentials."
        action={
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              "All statuses",
              "Queued",
              "Processing",
              "Completed",
              "Failed",
              "Cancelled",
            ]}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total operations"
          value={store.aiJobs.length}
          icon={BrainCircuit}
        />
        <StatCard label="Successful" value={completed} icon={CheckCircle2} />
        <StatCard label="Failed" value={failed} icon={XCircle} />
        <StatCard
          label="Success rate"
          value={`${Math.round((completed / store.aiJobs.length) * 100)}%`}
          icon={Activity}
        />
        <StatCard label="Avg. duration" value="2.4s" icon={Clock3} />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">AI operation volume & failures</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer>
            <LineChart data={activityTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Line dataKey="ai" stroke="#6C63FF" strokeWidth={2} />
              <Line dataKey="failures" stroke="#F43F5E" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="mt-6">
        <DataTable
          rows={rows}
          columns={[
            {
              key: "id",
              label: "Job ID",
              render: (r) => (
                <Link
                  className="font-semibold text-violet-600"
                  to={`/admin/ai-monitoring/${r.id}`}
                >
                  {r.id}
                </Link>
              ),
            },
            { key: "feature", label: "Feature" },
            { key: "module", label: "Module" },
            { key: "createdAt", label: "Created" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            { key: "duration", label: "Duration" },
            { key: "provider", label: "Provider" },
            { key: "error", label: "Error" },
            {
              key: "action",
              label: "",
              render: (r) => (
                <div className="flex gap-2">
                  <Link to={`/admin/ai-monitoring/${r.id}`}>
                    <Button variant="secondary">View</Button>
                  </Link>
                  {r.status === "Failed" && (
                    <Button onClick={() => actions.retryJob(r.id)}>
                      <RotateCcw size={14} /> Retry
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}

export function AIJobDetail() {
  const { id } = useParams()
  const { store, actions } = useAdmin()
  const job = store.aiJobs.find((j) => j.id === id)
  if (!job) return <NotFound />
  return (
    <>
      <PageHeader
        title={job.id}
        description="Non-sensitive operational metadata for a simulated AI job."
        action={
          <Link to="/admin/ai-monitoring">
            <Button variant="secondary">
              <ArrowLeft size={16} /> AI Monitoring
            </Button>
          </Link>
        }
      />
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{job.feature}</h2>
            <p className="text-sm text-slate-500">{job.module}</p>
          </div>
          <Badge>{job.status}</Badge>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(job).map(([k, v]) => (
            <div key={k}>
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                {titleCase(k)}
              </span>
              <span className="mt-1 block text-sm font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <strong>Provider notice:</strong> This is a placeholder integration.
          No API keys, private prompts, or credentials are exposed.
        </div>
        {job.status === "Failed" && (
          <Button className="mt-5" onClick={() => actions.retryJob(id)}>
            <RotateCcw size={16} /> Retry simulated job
          </Button>
        )}
      </Card>
    </>
  )
}

export function AILogs() {
  const { store } = useAdmin()
  const [q, setQ] = useState("")
  const rows = store.aiJobs.filter((j) =>
    JSON.stringify(j).toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        title="AI Activity Logs"
        description="Audit-oriented operational metadata; personal prompts and content are intentionally excluded."
        action={<ExportButton rows={rows} filename="mindlog-ai-logs.csv" />}
      />
      <Card>
        <div className="border-b p-4">
          <SearchField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jobs, features, modules, status…"
          />
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: "createdAt", label: "Timestamp" },
            { key: "feature", label: "Operation" },
            { key: "module", label: "Module" },
            { key: "id", label: "Job ID" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            { key: "duration", label: "Duration" },
            { key: "error", label: "Error code" },
            {
              key: "action",
              label: "Admin action",
              render: (r) => (r.status === "Failed" ? "Retry available" : "—"),
            },
          ]}
        />
      </Card>
    </>
  )
}

export function ReportsPage() {
  const [report, setReport] = useState("User growth")
  const [period, setPeriod] = useState("Last 30 days")
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Consistent operational reports calculated from the shared mock datasets."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            <ExportButton rows={activityTrend} filename="mindlog-report.csv" />
          </div>
        }
      />
      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Report type"
            value={report}
            onChange={(e) => setReport(e.target.value)}
            options={[
              "User growth",
              "User activity by module",
              "Journal activity",
              "Mood tracking usage",
              "Multimedia usage",
              "Memories and events",
              "Goals and habits",
              "AI usage and errors",
              "Moderation activity",
            ]}
          />
          <Select
            label="Date range"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              "Last 7 days",
              "Last 30 days",
              "Last 90 days",
              "This year",
            ]}
          />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Report" value={report} />
        <StatCard label="Period" value={period} />
        <StatCard label="Compared with prior period" value="+8.4%" />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-bold">{report}</h2>
        <div className="mt-5 h-72">
          <ResponsiveContainer>
            <BarChart data={activityTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" axisLine={false} />
              <YAxis axisLine={false} />
              <Tooltip />
              <Bar dataKey="users" fill="#6C63FF" radius={[5, 5, 0, 0]} />
              <Bar dataKey="memories" fill="#22D3EE" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="mt-6">
        <DataTable
          rows={activityTrend.map((x, i) => ({ id: i + 1, ...x }))}
          columns={Object.keys(activityTrend[0]).map((key) => ({
            key,
            label: titleCase(key),
          }))}
        />
      </Card>
    </>
  )
}

export function NotificationsPage() {
  const { store, actions } = useAdmin()
  const [type, setType] = useState("All types")
  const rows = store.notifications.filter(
    (n) => type === "All types" || n.type === type,
  )
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Operational alerts and review reminders."
        action={
          <Button onClick={() => actions.markNotification(null)}>
            <CheckCheck size={16} /> Mark all as read
          </Button>
        }
      />
      <div className="mb-4 max-w-xs">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            "All types",
            "Moderation",
            "AI failure",
            "Media failure",
            "Milestone",
            "Configuration",
          ]}
        />
      </div>
      <div className="space-y-3">
        {rows.map((n) => (
          <Card
            key={n.id}
            className={`flex items-start gap-4 p-4 ${
              !n.read ? "border-violet-200 bg-violet-50/30" : ""
            }`}
          >
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                n.read ? "bg-slate-200" : "bg-violet-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{n.title}</h2>
                <Badge>{n.type}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{n.message}</p>
              <p className="mt-2 text-xs text-slate-400">{n.createdAt}</p>
            </div>
            <div className="flex gap-1">
              {!n.read && (
                <Button
                  variant="ghost"
                  onClick={() => actions.markNotification(n.id)}
                >
                  <CheckCheck size={16} />
                </Button>
              )}
              <Link to={n.href}>
                <Button variant="secondary">Open</Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => actions.deleteNotification(n.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export function AuditLogs() {
  const { store } = useAdmin()
  const [q, setQ] = useState("")
  const rows = store.auditLogs.filter((x) =>
    JSON.stringify(x).toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Append-only in the intended architecture. This prototype persists simulated records locally."
        action={<ExportButton rows={rows} filename="mindlog-audit.csv" />}
      />
      <Card>
        <div className="border-b p-4">
          <SearchField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, admin, target, reference…"
          />
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: "timestamp", label: "Timestamp" },
            { key: "admin", label: "Administrator" },
            { key: "action", label: "Action" },
            { key: "target", label: "Target" },
            { key: "reference", label: "Reference" },
            { key: "reason", label: "Reason" },
            {
              key: "result",
              label: "Result",
              render: (r) => <Badge>{r.result}</Badge>,
            },
          ]}
        />
      </Card>
    </>
  )
}

export function SettingsPage() {
  const { store, actions } = useAdmin()
  const [tab, setTab] = useState("General")
  const [form, setForm] = useState(store.settings)
  return (
    <>
      <PageHeader
        title="Settings"
        description="Frontend demonstration settings. Backend authorization and external services are not configured here."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {["General", "Features", "AI Providers", "Storage & Media"].map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      <Card className="max-w-3xl p-6">
        {tab === "General" && (
          <div className="space-y-5">
            <Input
              label="Application name"
              value={form.appName}
              onChange={(e) => setForm({ ...form, appName: e.target.value })}
            />
            <Select
              label="Default language"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              options={["English", "Français"]}
            />
            <Select
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              options={["Europe/Paris", "UTC", "Africa/Dakar"]}
            />
            <Toggle
              label="Maintenance mode (simulated)"
              checked={form.maintenance}
              onChange={(v) => setForm({ ...form, maintenance: v })}
            />
          </div>
        )}
        {tab === "Features" && (
          <div className="space-y-4">
            <Toggle
              label="AI feature visibility"
              checked={form.aiFeatures}
              onChange={(v) => setForm({ ...form, aiFeatures: v })}
            />
            <Toggle
              label="Multimedia feature visibility"
              checked={form.multimedia}
              onChange={(v) => setForm({ ...form, multimedia: v })}
            />
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              These toggles do not enforce backend permissions or configure
              external services.
            </p>
          </div>
        )}
        {tab === "AI Providers" && (
          <div className="space-y-3">
            {[
              "Gemini",
              "Hugging Face",
              "Speech transcription",
              "Image generation",
            ].map((p, i) => (
              <div
                key={p}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <div className="font-semibold">{p}</div>
                  <div className="text-xs text-slate-500">
                    Credentials must use secure backend environment variables.
                  </div>
                </div>
                <Badge tone={i < 2 ? "green" : "amber"}>
                  {i < 2 ? "Configured placeholder" : "Not configured"}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {tab === "Storage & Media" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Storage usage" value="86.4 MB" />
            <StatCard label="Stored items" value="30" />
            <StatCard label="Processing queue" value="3" />
            <StatCard label="Provider" value="Mock storage" />
          </div>
        )}
        <div className="mt-7 flex gap-2 border-t pt-5">
          <Button onClick={() => actions.updateSettings(form)}>
            <Save size={16} /> Save changes
          </Button>
          <Button variant="secondary" onClick={() => setForm(store.settings)}>
            Cancel
          </Button>
        </div>
      </Card>
    </>
  )
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-lg border p-4 text-sm font-medium">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-violet-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  )
}

export function ProfilePage() {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: "Amina Diallo",
    username: "amina.admin",
    email: "admin@mindlog.ai",
    language: "English",
  })
  return (
    <>
      <PageHeader
        title="Admin Profile"
        description="Manage your administrator profile and preferences."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-violet-100 text-2xl font-bold text-violet-700">
            AD
          </span>
          <h2 className="mt-4 text-xl font-bold">{form.name}</h2>
          <p className="text-sm text-slate-500">Super Admin</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">Last login</dt>
              <dd>Today, 08:42</dd>
            </div>
            <div>
              <dt className="text-slate-400">Language</dt>
              <dd>{form.language}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <div className="flex justify-between">
            <h2 className="font-bold">Profile information</h2>
            <Button variant="secondary" onClick={() => setEditing(!editing)}>
              <Pencil size={15} /> {editing ? "Cancel" : "Edit profile"}
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              disabled={!editing}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Username"
              disabled={!editing}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <Input
              label="Email"
              disabled={!editing}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Select
              label="Language"
              disabled={!editing}
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              options={["English", "Français"]}
            />
          </div>
          {editing && (
            <Button className="mt-5" onClick={() => setEditing(false)}>
              Save profile
            </Button>
          )}
          <div className="mt-8 border-t pt-6">
            <h2 className="font-bold">Change password</h2>
            <p className="mt-1 text-sm text-slate-500">
              No password values are displayed or stored by this demo.
            </p>
            <Button className="mt-4" variant="secondary">
              <LockKeyhole size={16} /> Open password form
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <div className="text-6xl font-bold text-violet-200">404</div>
        <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The requested administrative record does not exist.
        </p>
        <Link to="/admin/dashboard">
          <Button className="mt-5">Return to dashboard</Button>
        </Link>
      </div>
    </div>
  )
}

export function AdminIndex() {
  return <Navigate to="/admin/dashboard" replace />
}
