
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  RefreshCw,
  Trash2,
  Eye,
  Search,
  Heart,
  FileText,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Image as ImageIcon,
  Video,
  UserRound,
  FilterX,
  Clock3,
  ShieldCheck,
  LayoutGrid,
  List,
  LoaderCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"

import adminJournalService from "./adminJournalService"
import { Badge, Button, Card, PageHeader } from "./ui.jsx"

const PAGE_SIZE = 10

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString()
}

function shortDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString()
}

function getEntries(data) {
  if (Array.isArray(data)) return data
  return Array.isArray(data?.results) ? data.results : []
}

function authorName(entry) {
  const author = entry?.author
  if (!author) return "Unknown author"

  const fullName = [
    author.first_name,
    author.last_name,
  ].filter(Boolean).join(" ")

  return fullName || author.username || "Unknown author"
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

function attachmentsOf(entry) {
  return Array.isArray(entry?.attachments)
    ? entry.attachments
    : []
}

function mediaUrl(media) {
  return media?.file_url || media?.url || media?.file || ""
}

function StatTile({ icon: Icon, label, value, subtitle }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-50" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
            {value ?? "—"}
          </p>
          {subtitle && (
            <p className="mt-2 text-xs text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-violet-100 p-3 text-violet-600">
          <Icon size={20} />
        </div>
      </div>
    </Card>
  )
}

function Author({ entry }) {
  const name = authorName(entry)
  const author = entry?.author

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {name}
        </p>
        <p className="truncate text-xs text-slate-400">
          {author?.username
            ? `@${author.username}`
            : "Author unavailable"}
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ draft }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        draft
          ? "bg-amber-50 text-amber-700"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          draft ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      {draft ? "Draft" : "Published"}
    </span>
  )
}

function MediaPreview({ attachments, compact = false }) {
  if (!attachments.length) {
    return compact ? (
      <span className="text-xs text-slate-400">No media</span>
    ) : null
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {attachments.slice(0, 3).map((media) => {
            const url = mediaUrl(media)
            return (
              <div
                key={media.id}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-violet-50 text-violet-500"
              >
                {media.media_type === "image" && url ? (
                  <img
                    src={url}
                    alt={media.title || "Attachment"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : media.media_type === "video" ? (
                  <Video size={15} />
                ) : (
                  <ImageIcon size={15} />
                )}
              </div>
            )
          })}
        </div>
        <span className="text-xs font-medium text-slate-500">
          {attachments.length}
        </span>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attachments.map((media) => {
        const url = mediaUrl(media)

        return (
          <div
            key={media.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            {media.media_type === "video" ? (
              url ? (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-slate-950 object-contain"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-slate-100">
                  <Video className="text-slate-400" />
                </div>
              )
            ) : url ? (
              <a href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt={media.title || "Journal image"}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition hover:opacity-90"
                />
              </a>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-100">
                <ImageIcon className="text-slate-400" />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {media.title || "Attachment"}
                </p>
                <p className="text-xs capitalize text-slate-400">
                  {media.media_type}
                </p>
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Open attachment"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Pagination({ page, totalPages, total, onChange, disabled }) {
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => {
      const start = Math.max(
        1,
        Math.min(page - 2, totalPages - 4)
      )
      return start + index
    }
  )

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        <span className="font-semibold text-slate-800">
          {total}
        </span>{" "}
        entries · Page {page} of {totalPages}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>

        {pages.map((number) => (
          <button
            type="button"
            key={number}
            disabled={disabled}
            onClick={() => onChange(number)}
            className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${
              page === number
                ? "bg-violet-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {number}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}

export default function AdminJournalPage() {
  const [stats, setStats] = useState(null)
  const [entries, setEntries] = useState([])
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [mood, setMood] = useState("")
  const [draft, setDraft] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isPaginated, setIsPaginated] = useState(true)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [viewMode, setViewMode] = useState("table")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 350)

    return () => clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const [statsData, listData] = await Promise.all([
        adminJournalService.getStats(),
        adminJournalService.getEntries({
          search,
          mood,
          draft,
          page,
        }),
      ])

      const items = getEntries(listData)
      const paginated = !Array.isArray(listData)

      setStats(statsData)
      setEntries(items)
      setIsPaginated(paginated)
      setTotal(listData?.count ?? items.length)
    } catch (err) {
      setError(err.message || "Unable to load journals.")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [search, mood, draft, page, refreshKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  )

  const visibleEntries = useMemo(() => {
    if (isPaginated) return entries

    return entries.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    )
  }, [entries, isPaginated, page])

  async function openDetails(entry) {
    setDetailsLoading(true)
    setError("")

    try {
      const fullEntry = await adminJournalService.getEntry(entry.id)
      setSelected(fullEntry)
    } catch (err) {
      setError(err.message || "Unable to load entry.")
    } finally {
      setDetailsLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return

    setDeleting(true)
    setError("")

    try {
      await adminJournalService.deleteEntry(deleteTarget.id)
      setDeleteTarget(null)
      setSelected(null)

      if (visibleEntries.length === 1 && page > 1) {
        setPage((previous) => previous - 1)
      } else {
        setRefreshKey((value) => value + 1)
      }
    } catch (err) {
      setError(err.message || "Unable to delete entry.")
    } finally {
      setDeleting(false)
    }
  }

  function resetFilters() {
    setSearchInput("")
    setSearch("")
    setMood("")
    setDraft("")
    setPage(1)
  }

  const moodDistribution = stats?.mood_distribution || []
  const maxMood = Math.max(
    1,
    ...moodDistribution.map((item) => item.count)
  )

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Journal Management"
        description="Explore entries, review uploaded media and manage journal content."
        action={
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          icon={BookOpen}
          label="Total entries"
          value={stats?.total_entries}
          subtitle="All journal records"
        />
        <StatTile
          icon={FileText}
          label="Published"
          value={stats?.published_entries}
          subtitle="Visible entries"
        />
        <StatTile
          icon={Clock3}
          label="Drafts"
          value={stats?.draft_entries}
          subtitle="Unpublished entries"
        />
        <StatTile
          icon={Heart}
          label="Favorites"
          value={stats?.favorite_entries}
          subtitle="Saved favorites"
        />
        <StatTile
          icon={Users}
          label="Authors"
          value={stats?.users_with_entries}
          subtitle="Users with entries"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Mood overview
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Distribution across all journal entries
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
              <Heart size={19} />
            </div>
          </div>

          <div className="space-y-5">
            {moodDistribution.map((item) => {
              const percentage = Math.round(
                (item.count / maxMood) * 100
              )

              return (
                <div key={String(item.mood)}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {item.mood || "Unknown"}
                    </span>
                    <span className="font-bold text-violet-600">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {!moodDistribution.length && (
              <p className="py-8 text-center text-sm text-slate-400">
                No mood statistics available.
              </p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Content administration
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review journal entries, inspect attachments,
              and manage records through the protected Django API.
            </p>
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Data source
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              Django REST Framework
            </p>
            <p className="mt-1 text-xs text-slate-500">
              JWT-protected administrator endpoints
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Journal entries
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Search, filter and review user journals
              </p>
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                className={`rounded-lg p-2 ${
                  viewMode === "table"
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-slate-400"
                }`}
              >
                <List size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`rounded-lg p-2 ${
                  viewMode === "grid"
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-slate-400"
                }`}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search
                size={18}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by title, content or author..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <select
              value={mood}
              onChange={(event) => {
                setMood(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            >
              <option value="">All moods</option>
              {moodDistribution.map((item) => (
                <option
                  key={String(item.mood)}
                  value={item.mood || ""}
                >
                  {item.mood || "Unknown"}
                </option>
              ))}
            </select>

            <select
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            >
              <option value="">All statuses</option>
              <option value="false">Published</option>
              <option value="true">Drafts</option>
            </select>
          </div>

          {(searchInput || mood || draft) && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              <FilterX size={14} />
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-violet-600" />
            Loading journal entries...
          </div>
        ) : !visibleEntries.length ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 rounded-2xl bg-violet-50 p-4 text-violet-500">
              <BookOpen size={28} />
            </div>
            <p className="font-semibold text-slate-800">
              No journal entries found
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try adjusting your search or filters.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {[
                    "Journal",
                    "Author",
                    "Mood",
                    "Media",
                    "Created",
                    "Status",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleEntries.map((entry) => {
                  const attachments = attachmentsOf(entry)

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-violet-50/30"
                    >
                      <td className="min-w-56 px-5 py-4">
                        <p className="max-w-60 truncate font-bold text-slate-900">
                          {entry.title || "Untitled"}
                        </p>
                        <p className="mt-1 max-w-60 truncate text-xs text-slate-400">
                          {entry.content || "No content"}
                        </p>
                      </td>

                      <td className="min-w-44 px-5 py-4">
                        <Author entry={entry} />
                      </td>

                      <td className="px-5 py-4">
                        <Badge tone="violet">
                          {entry.mood || "Unknown"}
                        </Badge>
                      </td>

                      <td className="px-5 py-4">
                        <MediaPreview attachments={attachments} compact />
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {shortDate(entry.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge draft={entry.draft} />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={detailsLoading}
                            onClick={() => openDetails(entry)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                          >
                            <Eye size={15} />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(entry)}
                            className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                            aria-label="Delete journal entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleEntries.map((entry) => {
              const attachments = attachmentsOf(entry)
              const cover = attachments.find(
                (item) => item.media_type === "image" && mediaUrl(item)
              )

              return (
                <div
                  key={entry.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-violet-200 hover:shadow-md"
                >
                  <div className="flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-violet-50 to-fuchsia-50">
                    {cover ? (
                      <img
                        src={mediaUrl(cover)}
                        alt={cover.title || "Journal cover"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen size={36} className="text-violet-300" />
                    )}
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-slate-900">
                          {entry.title || "Untitled"}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {entry.content || "No content"}
                        </p>
                      </div>
                      <StatusBadge draft={entry.draft} />
                    </div>

                    <Author entry={entry} />

                    <div className="flex items-center justify-between">
                      <Badge tone="violet">
                        {entry.mood || "Unknown"}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {shortDate(entry.created_at)}
                      </span>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 pt-4">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => openDetails(entry)}
                      >
                        <Eye size={15} />
                        View entry
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDeleteTarget(entry)}
                        aria-label="Delete entry"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          disabled={loading}
          onChange={setPage}
        />
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Journal entry details"
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="violet">Journal entry</Badge>
                  <StatusBadge draft={selected.draft} />
                </div>
                <h2 className="break-words text-2xl font-extrabold text-slate-950">
                  {selected.title || "Untitled entry"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close details"
              >
                <X size={21} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto p-6">
              <div className="grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Published by
                  </p>
                  <Author entry={selected} />
                  {selected.author?.email && (
                    <p className="mt-2 break-all text-xs text-slate-500">
                      {selected.author.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays size={16} className="text-violet-500" />
                    {formatDate(selected.created_at)}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Heart size={16} className="text-violet-500" />
                    {selected.mood || "Unknown mood"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Entry ID: {selected.id}
                  </p>
                </div>
              </div>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
                  Journal content
                </h3>
                <div className="whitespace-pre-wrap break-words rounded-2xl border border-slate-100 bg-white p-5 text-sm leading-8 text-slate-700">
                  {selected.content || "No content."}
                </div>
              </section>

              {Array.isArray(selected.tags) && selected.tags.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-bold text-slate-700">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <ImageIcon size={18} className="text-violet-600" />
                  <h3 className="font-bold text-slate-900">
                    Photos & videos
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {attachmentsOf(selected).length}
                  </span>
                </div>

                {attachmentsOf(selected).length ? (
                  <MediaPreview attachments={attachmentsOf(selected)} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <ImageIcon
                      size={26}
                      className="mx-auto mb-3 text-slate-300"
                    />
                    <p className="text-sm text-slate-400">
                      No media attachments available.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteTarget(selected)
                  setSelected(null)
                }}
              >
                <Trash2 size={16} />
                Delete entry
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Trash2 size={25} />
            </div>

            <h2 className="text-xl font-extrabold text-slate-950">
              Delete journal entry?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              You are about to permanently delete{" "}
              <strong className="text-slate-800">
                {deleteTarget.title || "this entry"}
              </strong>
              . This action cannot be undone.
            </p>

            <div className="mt-7 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {deleting ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
