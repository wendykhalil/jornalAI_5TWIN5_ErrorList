import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Flame,
  Target,
  CheckCircle2,
  Send,
} from "lucide-react"
import { useStore } from "../../store/AppStore"
import { goalsService } from "../../services/goalsService"
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Loading,
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  Stat,
  Textarea,
} from "../../components/ui"

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, "0")

// Local date as YYYY-MM-DD (toISOString would shift the day because of UTC)
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayStr = () => fmtDate(new Date())

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return fmtDate(new Date(y, m - 1, d + n))
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

const formatDisplay = (dateStr) =>
  dateStr
    ? new Date(`${dateStr}T00:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—"

const STATUS_LABELS = {
  "not-started": "Pas commencé",
  "in-progress": "En cours",
  completed: "Terminé",
}

const FREQUENCY_LABELS = {
  daily: "Quotidienne",
  weekly: "Hebdomadaire",
}

// Derived state used for the filters: an unfinished goal past its end date is late
function goalState(goal) {
  if (goal.status === "completed") return "completed"
  if (goal.end_date && daysUntil(goal.end_date) < 0) return "overdue"
  return "active"
}

const STATE_BADGE = {
  completed: ["Terminé", "bg-emerald-50 text-emerald-700"],
  overdue: ["En retard", "bg-red-50 text-red-700"],
  active: ["En cours", "bg-violet-50 text-violet-700"],
}

function ProgressBar({ value, color = "bg-violet-600" }) {
  return (
    <div className="h-2 rounded bg-slate-100">
      <div
        className={`h-full rounded ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// Streak = consecutive completed days ending today (or yesterday if not done yet)
function computeStreak(doneDates) {
  let cursor = todayStr()
  if (!doneDates.has(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (doneDates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

// Monday -> Sunday dates of the current week
function currentWeek() {
  const now = new Date()
  const mondayOffset = (now.getDay() + 6) % 7
  const monday = fmtDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset),
  )
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

function habitStats(checks) {
  const doneDates = new Set(
    checks.filter((c) => c.completed).map((c) => c.date),
  )
  const today = todayStr()
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
  const doneLast7 = last7.filter((d) => doneDates.has(d)).length
  return {
    doneDates,
    streak: computeStreak(doneDates),
    rate: Math.round((doneLast7 / 7) * 100),
    doneToday: doneDates.has(today),
  }
}

/* -------------------------------------------------------------------------- */
/* Goal form (create / edit)                                                  */
/* -------------------------------------------------------------------------- */

function GoalForm({ mode }) {
  const { notify } = useStore()
  const nav = useNavigate()
  const { id } = useParams()
  const editing = mode === "edit"
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return
    let active = true
    goalsService
      .getGoal(id)
      .then((g) => active && setCurrent(g))
      .catch((e) => notify(e.message, "error"))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [editing, id])

  const submit = async (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    let status = f.get("status")
    let progress = Number(f.get("progress"))

    // Keep status and progress consistent
    if (progress >= 100) status = "completed"
    if (status === "completed") progress = 100
    if (status === "not-started" && progress > 0) status = "in-progress"

    const payload = {
      title: f.get("title").trim(),
      description: f.get("description"),
      start_date: f.get("start_date"),
      end_date: f.get("end_date") || null,
      status,
      progress,
    }

    setSaving(true)
    try {
      const saved = editing
        ? await goalsService.updateGoal(id, payload)
        : await goalsService.createGoal(payload)
      notify("Objectif enregistré")
      nav(`/goals/${saved.id}`)
    } catch (err) {
      notify(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />
  if (editing && !current) return <Empty title="Objectif introuvable" />

  return (
    <>
      <PageHeader title={editing ? "Modifier l’objectif" : "Nouvel objectif"} />
      <Card className="mx-auto max-w-3xl p-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Input
            className="sm:col-span-2"
            label="Titre"
            name="title"
            defaultValue={current?.title}
            maxLength={255}
            required
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              name="description"
              defaultValue={current?.description}
            />
          </div>
          <Input
            label="Date de début"
            name="start_date"
            type="date"
            defaultValue={current?.start_date || todayStr()}
            required
          />
          <Input
            label="Date de fin (facultative)"
            name="end_date"
            type="date"
            defaultValue={current?.end_date || ""}
          />
          <Select
            label="Statut"
            name="status"
            defaultValue={current?.status || "not-started"}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Progression (%)"
            name="progress"
            type="number"
            min="0"
            max="100"
            defaultValue={current?.progress ?? 0}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
            <Link to={editing ? `/goals/${id}` : "/goals"}>
              <Button type="button" variant="secondary">
                Annuler
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Goal detail                                                                */
/* -------------------------------------------------------------------------- */

function GoalDetail() {
  const { notify } = useStore()
  const nav = useNavigate()
  const { id } = useParams()
  const [goal, setGoal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    goalsService
      .getGoal(id)
      .then((g) => active && setGoal(g))
      .catch(() => active && setGoal(null))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  const patch = async (data, message) => {
    setBusy(true)
    try {
      setGoal(await goalsService.updateGoal(id, data))
      notify(message)
    } catch (err) {
      notify(err.message, "error")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm("Supprimer cet objectif ?")) return
    try {
      await goalsService.deleteGoal(id)
      notify("Objectif supprimé")
      nav("/goals")
    } catch (err) {
      notify(err.message, "error")
    }
  }

  if (loading) return <Loading />
  if (!goal)
    return (
      <Empty
        title="Objectif introuvable"
        action={
          <Link to="/goals">
            <Button variant="secondary">Retour aux objectifs</Button>
          </Link>
        }
      />
    )

  const state = goalState(goal)
  const [stateLabel, stateClass] = STATE_BADGE[state]
  const bump = (delta) => {
    const progress = Math.min(100, Math.max(0, goal.progress + delta))
    patch(
      {
        progress,
        status:
          progress >= 100
            ? "completed"
            : progress > 0
              ? "in-progress"
              : goal.status === "completed"
                ? "in-progress"
                : goal.status,
      },
      "Progression mise à jour",
    )
  }

  return (
    <>
      <PageHeader
        title={goal.title}
        subtitle={goal.description}
        actions={
          <>
            <Link to={`/goals/${id}/edit`}>
              <Button variant="secondary">
                <Edit3 size={16} /> Modifier
              </Button>
            </Link>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} /> Supprimer
            </Button>
            {goal.status !== "completed" && (
              <Button
                disabled={busy}
                onClick={() =>
                  patch({ status: "completed", progress: 100 }, "Objectif terminé")
                }
              >
                <CheckCircle2 size={16} /> Marquer terminé
              </Button>
            )}
          </>
        }
      />
      <Card className="p-6">
        <div className="flex flex-wrap gap-2">
          <Badge className={stateClass}>{stateLabel}</Badge>
          <Badge>{STATUS_LABELS[goal.status]}</Badge>
        </div>
        <div className="mt-6 h-3 rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <b>{goal.progress}% réalisé</b>
          <span className="text-slate-500">
            {formatDisplay(goal.start_date)} → {formatDisplay(goal.end_date)}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {[-10, 10, 25].map((delta) => (
            <Button
              key={delta}
              variant="secondary"
              disabled={busy}
              onClick={() => bump(delta)}
            >
              {delta > 0 ? `+${delta}%` : `${delta}%`}
            </Button>
          ))}
        </div>
        {goal.end_date && state === "active" && (
          <p className="mt-5 text-sm text-slate-500">
            {daysUntil(goal.end_date) === 0
              ? "L’échéance est aujourd’hui."
              : `Il reste ${daysUntil(goal.end_date)} jour(s) avant l’échéance.`}
          </p>
        )}
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Goals list                                                                 */
/* -------------------------------------------------------------------------- */

function GoalList() {
  const { notify } = useStore()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    let active = true
    goalsService
      .listGoals()
      .then((items) => active && setGoals(items))
      .catch((e) => notify(e.message, "error"))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const count = (state) => goals.filter((g) => goalState(g) === state).length
  const list = goals.filter((g) => filter === "all" || goalState(g) === filter)

  return (
    <>
      <PageHeader
        title="Objectifs & habitudes"
        subtitle="Gardez une vue claire sur ce que vous construisez."
        actions={
          <>
            <Link to="/habits">
              <Button variant="secondary">Voir les habitudes</Button>
            </Link>
            <Link to="/goals/insights">
              <Button variant="ai">AI Insights</Button>
            </Link>
            <Link to="/goals/new">
              <Button>
                <Plus size={16} /> Nouvel objectif
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={goals.length} icon={Target} />
        <Stat label="Actifs" value={count("active")} icon={Target} />
        <Stat label="Terminés" value={count("completed")} icon={CheckCircle2} />
        <Stat label="En retard" value={count("overdue")} icon={Flame} />
      </div>
      <div className="my-5 flex flex-wrap gap-2">
        {[
          ["all", "Tous"],
          ["active", "Actifs"],
          ["completed", "Terminés"],
          ["overdue", "En retard"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "primary" : "secondary"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty
          title="Aucun objectif"
          text="Créez votre premier objectif pour suivre votre progression."
          action={
            <Link to="/goals/new">
              <Button>
                <Plus size={16} /> Nouvel objectif
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const [label, cls] = STATE_BADGE[goalState(g)]
            return (
              <Link to={`/goals/${g.id}`} key={g.id}>
                <Card className="p-5 hover:border-violet-300">
                  <div className="flex justify-between gap-2">
                    <Badge>{STATUS_LABELS[g.status]}</Badge>
                    <Badge className={cls}>{label}</Badge>
                  </div>
                  <h2 className="mt-4 text-lg font-extrabold">{g.title}</h2>
                  {g.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {g.description}
                    </p>
                  )}
                  <div className="mt-5">
                    <ProgressBar value={g.progress} />
                  </div>
                  <p className="mt-2 text-xs font-bold">
                    {g.progress}%
                    {g.end_date ? ` · avant le ${formatDisplay(g.end_date)}` : ""}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Habits                                                                     */
/* -------------------------------------------------------------------------- */

// Loads habits and, for each one, its history of daily validations
function useHabits() {
  const { notify } = useStore()
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const list = await goalsService.listHabits()
      const withChecks = await Promise.all(
        list.map(async (h) => ({
          ...h,
          checks: await goalsService.listChecks(h.id).catch(() => []),
        })),
      )
      setHabits(withChecks)
    } catch (err) {
      notify(err.message, "error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { habits, loading, reload }
}

function HabitsView() {
  const { notify } = useStore()
  const { habits, loading, reload } = useHabits()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [frequency, setFrequency] = useState("daily")
  const [saving, setSaving] = useState(false)
  const week = useMemo(currentWeek, [])
  const today = todayStr()
  const dayLetters = ["L", "M", "M", "J", "V", "S", "D"]

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await goalsService.createHabit({ name: name.trim(), frequency })
      notify("Habitude ajoutée")
      setOpen(false)
      setName("")
      setFrequency("daily")
      await reload()
    } catch (err) {
      notify(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const toggleToday = async (habit, done) => {
    try {
      await goalsService.checkHabit(habit.id, today, !done)
      await reload()
    } catch (err) {
      notify(err.message, "error")
    }
  }

  const remove = async (habit) => {
    if (!window.confirm(`Supprimer l’habitude « ${habit.name} » ?`)) return
    try {
      await goalsService.deleteHabit(habit.id)
      notify("Habitude supprimée")
      await reload()
    } catch (err) {
      notify(err.message, "error")
    }
  }

  return (
    <>
      <PageHeader
        title="Mes habitudes"
        subtitle="De petites actions répétées, de grands changements."
        actions={
          <>
            <Link to="/goals">
              <Button variant="secondary">Voir les objectifs</Button>
            </Link>
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Ajouter une habitude
            </Button>
          </>
        }
      />
      {loading ? (
        <Loading />
      ) : habits.length === 0 ? (
        <Empty
          title="Aucune habitude"
          text="Ajoutez une habitude pour la valider chaque jour."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {habits.map((h) => {
            const stats = habitStats(h.checks)
            return (
              <Card key={h.id} className="p-5">
                <div className="flex justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <Flame size={20} />
                  </span>
                  <button
                    onClick={() => toggleToday(h, stats.doneToday)}
                    className={`rounded-xl px-3 text-xs font-bold ${
                      stats.doneToday
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {stats.doneToday ? "Fait aujourd’hui" : "À faire"}
                  </button>
                </div>
                <h2 className="mt-4 font-extrabold">{h.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {FREQUENCY_LABELS[h.frequency]} · Série de {stats.streak}{" "}
                  jour(s)
                </p>
                <div className="mt-4">
                  <ProgressBar value={stats.rate} color="bg-amber-400" />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {stats.rate}% sur les 7 derniers jours
                </p>
                <div className="mt-4 grid grid-cols-7 gap-1">
                  {week.map((date, i) => {
                    const done = stats.doneDates.has(date)
                    return (
                      <div
                        key={date}
                        title={date}
                        className={`grid aspect-square place-items-center rounded-md text-[10px] font-bold ${
                          done
                            ? "bg-violet-600 text-white"
                            : date === today
                              ? "bg-violet-100 text-violet-700"
                              : date > today
                                ? "bg-slate-50 text-slate-300"
                                : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {dayLetters[i]}
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => remove(h)}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              </Card>
            )
          })}
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouvelle habitude"
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={saving || !name.trim()}>
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Input
            label="Nom de l’habitude"
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Lire 20 minutes"
            autoFocus
          />
          <Select
            label="Fréquence"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* AI: insights + RAG coach (served by the backend, Ollama)                   */
/* -------------------------------------------------------------------------- */

const SOURCE_LABELS = { goal: "Objectif", habit: "Habitude", journal: "Journal" }

const STARTERS = [
  "Où en suis-je sur mes objectifs ?",
  "Quelle habitude dois-je prioriser ?",
  "Comment rester motivé(e) cette semaine ?",
]

function CoachChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, sending])

  const send = async (text) => {
    const question = text.trim()
    if (!question || sending) return

    const history = messages
      .filter((m) => !m.error)
      .map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, { role: "user", content: question }])
    setInput("")
    setSending(true)

    try {
      const res = await goalsService.coach(question, history)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources },
      ])
    } catch (err) {
      const content = /ollama/i.test(err.message)
        ? "Le coach IA est indisponible : vérifiez qu’Ollama est lancé, puis réessayez."
        : err.message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content, error: true },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="max-h-96 min-h-40 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-slate-500">
              Posez une question sur vos objectifs, vos habitudes ou votre
              journal. Le coach répond à partir de vos propres données.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <Button key={q} variant="secondary" onClick={() => send(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                m.role === "user"
                  ? "bg-violet-600 text-white"
                  : m.error
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.sources?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sources.map((src) => (
                    <Badge
                      key={`${src.type}-${src.id}`}
                      className="bg-white text-slate-600"
                    >
                      {SOURCE_LABELS[src.type] || src.type} · {src.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
              Le coach réfléchit...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Posez votre question au coach..."
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
        <Button disabled={sending || !input.trim()} aria-label="Envoyer">
          <Send size={16} />
        </Button>
      </form>
    </Card>
  )
}

function InsightsView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await goalsService.insights())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageHeader
        title="Coach objectifs & habitudes"
        subtitle="Suggestions et coach IA, calculés à partir de vos objectifs, de vos habitudes et de votre journal."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            <Sparkles size={16} /> Actualiser
          </Button>
        }
      />
      {loading ? (
        <Loading label="L’IA analyse vos objectifs..." />
      ) : error ? (
        <Empty title="Suggestions indisponibles" text={error} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge
              className={
                data.source === "ai"
                  ? "bg-cyan-50 text-cyan-700"
                  : "bg-slate-100 text-slate-600"
              }
            >
              {data.source === "ai"
                ? "Rédigé par l’IA"
                : "Calculé avec des règles simples"}
            </Badge>
            {data.warning && (
              <span className="text-xs text-slate-500">
                IA indisponible ({data.warning}) : suggestions calculées sans
                IA.
              </span>
            )}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {data.insights.map((text, i) => (
              <Card key={i} className="p-6">
                <Sparkles className="text-cyan-500" />
                <Badge className="mt-5 bg-cyan-50 text-cyan-700">
                  Suggestion, pas une prédiction
                </Badge>
                <p className="mt-3 font-semibold leading-6">{text}</p>
              </Card>
            ))}
          </div>
        </>
      )}
      <div className="mt-8">
        <SectionTitle
          title="Coach IA"
          subtitle="Une question sur vos objectifs, vos habitudes ou votre journal ?"
        />
        <CoachChat />
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Entry point used by the router                                             */
/* -------------------------------------------------------------------------- */

export function GoalsPage({ mode = "goals" }) {
  if (mode === "new" || mode === "edit") return <GoalForm mode={mode} />
  if (mode === "detail") return <GoalDetail />
  if (mode === "habits") return <HabitsView />
  if (mode === "insights") return <InsightsView />
  return <GoalList />
}

export default GoalsPage
