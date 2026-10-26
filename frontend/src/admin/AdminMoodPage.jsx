import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { HeartPulse } from "lucide-react"

import adminMoodService from "./adminMoodService"
import {
  Button,
  Card,
  DataTable,
  ExportButton,
  PageHeader,
  SearchField,
  StatCard,
} from "./ui.jsx"

const MOODS = [
  "Heureux",
  "Calme",
  "Motivé",
  "Reconnaissant",
  "Neutre",
  "Fatigué",
  "Stressé",
  "Triste",
  "Anxieux",
]

function formatIntensity(value) {
  if (value === null || value === undefined) return "—"
  return `${Number(value).toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  })}/5`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
}

function shortDay(value) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

export default function AdminMoodPage() {
  const [stats, setStats] = useState(null)
  const [page, setPage] = useState(null)
  const [query, setQuery] = useState("")
  const [mood, setMood] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    Promise.all([
      adminMoodService.getStats(),
      adminMoodService.getCheckins({
        search: query.trim(),
        mood,
        page: pageNumber,
        page_size: 20,
      }),
    ])
      .then(([nextStats, nextPage]) => {
        if (!active) return
        setStats(nextStats)
        setPage(nextPage)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || "Impossible de charger les humeurs.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, mood, pageNumber])

  const rows = Array.isArray(page?.results) ? page.results : []
  const chart = (stats?.daily || []).map((point) => ({
    ...point,
    label: shortDay(point.date),
  }))
  const chartHasData = chart.some((point) => point.count > 0)
  const dominant = stats?.dominant_mood
    ? `${stats.dominant_mood} (${stats.dominant_count})`
    : "—"

  const columns = [
    { key: "date", label: "Date", render: (row) => formatDate(row.date) },
    { key: "username", label: "Utilisateur" },
    { key: "mood", label: "Humeur" },
    {
      key: "intensity",
      label: "Intensité",
      render: (row) => `${row.intensity}/5`,
    },
    {
      key: "has_note",
      label: "Note",
      render: (row) => (row.has_note ? "Présente" : "Aucune"),
    },
  ]

  return (
    <>
      <PageHeader
        title="Activité des humeurs"
        description="Chiffres calculés à partir des check-ins enregistrés. Le texte des notes n'est pas affiché."
        action={
          <ExportButton rows={rows} filename="mindlog-humeurs.csv" />
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Check-ins"
          value={loading && !stats ? "…" : stats?.total ?? 0}
          icon={HeartPulse}
        />
        <StatCard
          label="Cette semaine"
          value={loading && !stats ? "…" : stats?.this_week ?? 0}
          change={
            stats
              ? `${stats.previous_week} la semaine précédente`
              : undefined
          }
          icon={HeartPulse}
        />
        <StatCard
          label="Ce mois"
          value={loading && !stats ? "…" : stats?.this_month ?? 0}
          icon={HeartPulse}
        />
        <StatCard
          label="Humeur la plus fréquente"
          value={loading && !stats ? "…" : dominant}
          icon={HeartPulse}
        />
        <StatCard
          label="Intensité moyenne"
          value={loading && !stats ? "…" : formatIntensity(stats?.average_intensity)}
          icon={HeartPulse}
        />
        <StatCard
          label="Utilisateurs concernés"
          value={loading && !stats ? "…" : stats?.users_with_checkins ?? 0}
          icon={HeartPulse}
        />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-bold">Check-ins, 14 derniers jours</h2>
        <p className="mt-1 text-sm text-slate-500">
          Chaque barre est le nombre de check-ins enregistrés ce jour-là.
        </p>
        {loading && !stats ? (
          <p className="py-16 text-center text-sm text-slate-500">Chargement…</p>
        ) : !chartHasData ? (
          <p className="py-16 text-center text-sm text-slate-500">
            Aucun check-in sur les 14 derniers jours.
          </p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "count" ? [value, "Check-ins"] : [value, name]
                  }
                />
                <Bar dataKey="count" fill="#0F766E" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_16rem]">
          <SearchField
            value={query}
            onChange={(event) => {
              setPageNumber(1)
              setQuery(event.target.value)
            }}
            placeholder="Rechercher un utilisateur…"
          />
          <label className="block text-sm font-medium text-slate-700">
            <span className="mb-1.5 block">Humeur</span>
            <select
              value={mood}
              onChange={(event) => {
                setPageNumber(1)
                setMood(event.target.value)
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            >
              <option value="">Toutes les humeurs</option>
              {MOODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && !page ? (
          <p className="px-4 py-14 text-center text-sm text-slate-500">Chargement…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            empty="Aucun check-in ne correspond à ces filtres."
          />
        )}
        {page?.count > 0 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-slate-500">
            <span>{page.count} check-in{page.count > 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!page.previous || loading}
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                disabled={!page.next || loading}
                onClick={() => setPageNumber((current) => current + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
