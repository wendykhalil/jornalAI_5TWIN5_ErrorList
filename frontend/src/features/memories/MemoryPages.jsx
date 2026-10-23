import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import {
  Plus,
  Search,
  Grid2X2,
  List,
  MapPin,
  CalendarDays,
  Heart,
  Trash2,
  Edit3,
  ArrowLeft,
  Sparkles,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Tag,
  Play,
  Check,
  X,
  RefreshCw,
  WandSparkles,
  SlidersHorizontal,
} from "lucide-react"
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { categories, categoryColors } from "../../data/mockData"
import { memoryService } from "../../services/memoryService"
import { useStore } from "../../store/AppStore"
import { useAutoSave, loadFromLocalStorage, clearFromLocalStorage } from "../../hooks/useAutoSave"
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

const importanceLabels = {
  low: "Simple",
  medium: "Marquant",
  high: "Important",
  "very-high": "Très important",
}
const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
]
const fmt = (d) => {
  // Defensive date formatting: handle missing, null, empty, or invalid dates
  if (!d || d === "" || d === null) {
    return "Date inconnue"
  }
  
  try {
    const dateObj = new Date(`${d}T12:00:00`)
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return "Date inconnue"
    }
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dateObj)
  } catch (error) {
    // If any error occurs during formatting, return fallback
    return "Date inconnue"
  }
}

function MemoryCard({ memory, view = "grid", onDelete }) {
  return (
    <Card
      className={`group overflow-hidden transition hover:-translate-y-1 hover:shadow-lg ${
        view === "list" ? "sm:flex" : ""
      }`}
    >
      <Link
        to={`/memories/${memory.id}`}
        className={view === "list" ? "sm:w-64 sm:shrink-0" : ""}
      >
        {memory.cover ? (
          <img
            src={memory.cover}
            alt=""
            className={`w-full object-cover ${
              view === "list" ? "h-full min-h-48" : "aspect-16/10]"
            }`}
            onError={(e) => {
              // If image fails to load and URL is relative, try with absolute path
              if (memory.cover && memory.cover.startsWith('/')) {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                e.target.src = `${API_BASE_URL}${memory.cover}`
              }
            }}
          />
        ) : (
          <div
            className={`grid place-items-center bg-slate-100 text-slate-300 ${
              view === "list" ? "h-full min-h-48" : "aspect-16/10]"
            }`}
          >
            <ImageIcon size={38} />
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge className={categoryColors[memory.category]}>
            {memory.category}
          </Badge>
          <div className="flex gap-1">
            <Heart
              size={17}
              className={
                memory.favorite
                  ? "fill-rose-500 text-rose-500"
                  : "text-slate-300"
              }
            />
            {memory.importance.includes("high") && (
              <span className="text-xs font-bold text-amber-600">
                Important
              </span>
            )}
          </div>
        </div>
        <Link to={`/memories/${memory.id}`}>
          <h2 className="mt-4 text-lg font-extrabold group-hover:text-violet-600">
            {memory.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CalendarDays size={13} />
              {fmt(memory.eventDate)}
            </span>
            {memory.location && (
              <span className="flex items-center gap-1">
                <MapPin size={13} />
                {memory.location}
              </span>
            )}
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
            {memory.description}
          </p>
        </Link>
        <div className="mt-4 flex flex-wrap gap-1">
          {memory.tags.slice(0, 3).map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center border-t border-slate-100 pt-4 text-xs text-slate-400">
          <ImageIcon size={14} className="mr-1" />
          {memory.mediaIds.length} média
          {memory.mediaIds.length !== 1 ? "s" : ""}
          {memory.aiSummary && (
            <span className="ml-3 flex items-center gap-1 text-cyan-600">
              <Sparkles size={13} /> Résumé IA
            </span>
          )}
          <div className="ml-auto flex gap-1">
            <Link
              to={`/memories/${memory.id}/edit`}
              className="rounded-lg p-2 hover:bg-slate-100"
              aria-label="Modifier"
            >
              <Edit3 size={16} />
            </Link>
            <button
              onClick={() => onDelete(memory)}
              className="rounded-lg p-2 hover:bg-red-50 hover:text-red-600"
              aria-label="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function MemoriesList() {
  const { memories, deleteMemory, notify } = useStore()
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("Toutes"),
    [importance, setImportance] = useState("Toutes"),
    [sort, setSort] = useState("new"),
    [view, setView] = useState("grid"),
    [pending, setPending] = useState(null)
  const list = useMemo(
    () =>
      memories
        .filter(
          (m) =>
            (category === "Toutes" || m.category === category) &&
            (importance === "Toutes" || m.importance === importance) &&
            [m.title, m.description, m.location, ...m.tags]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "old"
              ? a.eventDate.localeCompare(b.eventDate)
              : b.eventDate.localeCompare(a.eventDate),
        ),
    [memories, q, category, importance, sort],
  )
  const remove = async () => {
    await deleteMemory(pending.id)
    notify(`« ${pending.title} » a été supprimé`)
    setPending(null)
  }
  return (
    <>
      <PageHeader
        title="Mes souvenirs"
        subtitle="Retrouvez et redécouvrez les moments importants de votre vie."
        actions={
          <>
            <Link to="/memories/timeline">
              <Button variant="secondary">Timeline</Button>
            </Link>
            <Link to="/memories/calendar">
              <Button variant="secondary">Calendrier</Button>
            </Link>
            <Link to="/memories/insights">
              <Button variant="ai">
                <Sparkles /> AI Insights
              </Button>
            </Link>
            <Link to="/memories/new">
              <Button>
                <Plus /> Nouveau souvenir
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total souvenirs" value={memories.length} />
        <Stat
          label="Souvenirs de ce mois"
          value={
            memories.filter((x) => x.eventDate.startsWith("2026-02")).length
          }
        />
        <Stat
          label="Souvenirs importants"
          value={memories.filter((x) => x.importance.includes("high")).length}
        />
        <Stat
          label="Catégories utilisées"
          value={new Set(memories.map((x) => x.category)).size}
        />
      </div>
      <Card className="my-6 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_170px_170px_auto]">
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:ring-4 focus:ring-violet-100"
              placeholder="Titre, lieu, description ou tag..."
            />
          </div>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>Toutes</option>
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <Select
            value={importance}
            onChange={(e) => setImportance(e.target.value)}
          >
            <option>Toutes</option>
            {Object.entries(importanceLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Plus récents</option>
            <option value="old">Plus anciens</option>
            <option value="title">Titre A–Z</option>
          </Select>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setView("grid")}
              className={`rounded-lg p-2 ${
                view === "grid"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-400"
              }`}
            >
              <Grid2X2 size={18} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-lg p-2 ${
                view === "list"
                  ? "bg-white text-violet-600 shadow-sm"
                  : "text-slate-400"
              }`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        {(q || category !== "Toutes" || importance !== "Toutes") && (
          <button
            onClick={() => {
              setQ("")
              setCategory("Toutes")
              setImportance("Toutes")
            }}
            className="mt-3 text-xs font-bold text-violet-600"
          >
            Effacer tous les filtres
          </button>
        )}
      </Card>
      {list.length ? (
        <div
          className={
            view === "grid"
              ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              : "space-y-4"
          }
        >
          {list.map((x) => (
            <MemoryCard
              key={x.id}
              memory={x}
              view={view}
              onDelete={setPending}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="Aucun souvenir trouvé"
          text="Ajustez les filtres ou créez un nouveau souvenir."
          action={
            <Link to="/memories/new">
              <Button>Nouveau souvenir</Button>
            </Link>
          }
        />
      )}
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Supprimer ce souvenir ?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={remove}>
              Confirmer la suppression
            </Button>
          </>
        }
      >
        Le souvenir « {pending?.title} » sera supprimé. Les médias associés
        resteront dans votre bibliothèque.
      </Modal>
    </>
  )
}

function MemoryForm({ edit = false }) {
  const { id } = useParams(),
    { memories, media, createMemory, updateMemory, notify, user } = useStore(),
    nav = useNavigate(),
    [params] = useSearchParams()
  const existing = memories.find((x) => x.id === id)
  const [form, setForm] = useState(
      () =>
        existing || {
          title: "",
          description: "",
          eventDate: params.get("date") || "2026-02-18",
          location: "",
          category: "Autres",
          importance: "medium",
          tags: [],
          mediaIds: [],
          cover: null,
          favorite: false,
          draft: false,
          aiSummary: "",
        },
    ),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [ai, setAi] = useState({
      status: "idle",
      error: null,
      category: null,
      categoryConfidence: null,
      categoryReasoning: null,
      tags: [],
      tagsConfidence: null,
      analysis: "",
    })
  
  // Auto-save hook
  const { draftId, saveStatus, clearAutoSave } = useAutoSave(form, {
    debounceMs: 1000,
    userId: user?.id,
    media,
    enabled: !edit, // Only auto-save when creating new memories
  })
  useEffect(() => {
    if (edit && existing) setForm(existing)
  }, [existing, edit])

  // Fetch memory from backend if not found in AppStore state (race condition fix)
  useEffect(() => {
    if (edit && id && !existing) {
      const loadMemory = async () => {
        try {
          const memory = await memoryService.getMemoryById(id, media)
          if (memory) {
            setForm(memory)
          }
        } catch (err) {
          console.error("Failed to load memory:", err)
          setError("Impossible de charger le souvenir. Réessayez.")
        }
      }
      loadMemory()
    }
  }, [edit, id, existing, media])
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const runAi = async (type) => {
    setAi((a) => ({ ...a, status: "loading", error: null }))
    try {
      const text = `${form.title} ${form.description}`
      if (type === "category") {
        const response = await memoryService.suggestMemoryCategory(text)
        // Extract suggested_category from response object
        setAi((a) => ({ 
          ...a, 
          status: "success", 
          category: response.suggested_category,
          categoryConfidence: response.confidence,
          categoryReasoning: response.reasoning,
        }))
      } else if (type === "tags") {
        const response = await memoryService.suggestMemoryTags(form.title, form.description)
        // Extract suggested_tags array from response object
        const tags = response.suggested_tags && response.suggested_tags.length 
          ? response.suggested_tags 
          : ["souvenir", "moment"]
        setAi((a) => ({
          ...a,
          status: "success",
          tags,
          tagsConfidence: response.confidence,
        }))
      } else if (type === "analysis") {
        // Mock analysis (not yet AI-powered)
        setTimeout(
          () =>
            setAi((a) => ({
              ...a,
              status: "success",
              analysis:
                "Ce souvenir met en avant une étape personnelle, des liens sociaux et un contexte marquant.",
            })),
          650,
        )
      }
    } catch (err) {
      setAi((a) => ({ 
        ...a, 
        status: "error",
        error: err.message || "Une erreur est survenue. Réessayez."
      }))
    }
  }
  const save = async (draft = false) => {
    // For published memories (draft=false), validate required fields
    if (!draft && (!form.title.trim() || !form.description.trim() || !form.eventDate)) {
      setError(
        "Le titre, la description et la date de l’événement sont obligatoires.",
      )
      return
    }
    
    // Update form with draft status before saving
    const formToSave = { ...form, draft }
    
    try {
      let item
      if (edit) {
        // Editing existing memory
        item = await updateMemory(id, formToSave)
      } else if (draftId) {
        // Publishing an auto-saved draft
        item = await updateMemory(draftId, formToSave)
      } else {
        // Creating new memory
        item = await createMemory(formToSave)
      }
      
      // Clear auto-save after successful save
      if (!draft) {
        clearAutoSave()
      }
      
      notify(draft ? "Brouillon enregistré" : "Souvenir enregistré avec succès")
      nav(`/memories/${item.id}`)
    } catch (err) {
      setError(err.message || "Une erreur est survenue. Réessayez.")
    }
  }
  const toggleMedia = (id) => {
    const mediaIds = form.mediaIds.includes(id)
      ? form.mediaIds.filter((x) => x !== id)
      : [...form.mediaIds, id]
    
    // Update cover to the first selected media's URL
    let coverUrl = null
    if (mediaIds.length > 0 && media.length > 0) {
      const firstMedia = media.find((m) => String(m.id) === String(mediaIds[0]))
      if (firstMedia && firstMedia.url) {
        coverUrl = firstMedia.url
      }
    }
    
    setForm((f) => ({
      ...f,
      mediaIds,
      cover: coverUrl,
    }))
  }
  if (edit && !existing) return <Loading />
  return (
    <>
      <PageHeader
        title={edit ? "Modifier le souvenir" : "Créer un nouveau souvenir"}
        subtitle="Préservez les détails qui rendent ce moment unique."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle
              title="Informations générales"
              subtitle="Décrivez le moment tel que vous souhaitez le retrouver."
            />
            <div className="space-y-5">
              <Input
                label="Titre du souvenir *"
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="Ex. Mon premier jour à ESPRIT"
              />
              <Textarea
                label="Description détaillée *"
                rows={7}
                value={form.description}
                onChange={(e) => change("description", e.target.value)}
                placeholder="Racontez ce qui s’est passé, avec qui et pourquoi cela compte..."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Date de l’événement *"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => change("eventDate", e.target.value)}
                />
                <Input
                  label="Lieu"
                  value={form.location}
                  onChange={(e) => change("location", e.target.value)}
                  placeholder="Ville ou endroit"
                />
                <Select
                  label="Catégorie"
                  value={form.category}
                  onChange={(e) => change("category", e.target.value)}
                >
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                <Select
                  label="Importance"
                  value={form.importance}
                  onChange={(e) => change("importance", e.target.value)}
                >
                  {Object.entries(importanceLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label="Tags et mots-clés (séparés par des virgules)"
                value={form.tags.join(", ")}
                onChange={(e) =>
                  change(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle
              title="Médias associés"
              subtitle="Sélectionnez des éléments existants sans les dupliquer."
              action={
                <Link to="/media/upload">
                  <Button variant="secondary">
                    <Plus /> Ajouter un média
                  </Button>
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {media.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMedia(m.id)}
                  className={`relative overflow-hidden rounded-xl border-2 text-left ${
                    form.mediaIds.includes(m.id)
                      ? "border-violet-500"
                      : "border-transparent"
                  }`}
                >
                  {m.url ? (
                    <img
                      src={m.url}
                      alt={m.title}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center bg-slate-100">
                      <Play />
                    </div>
                  )}
                  <span className="block truncate p-2 text-xs font-bold">
                    {m.title}
                  </span>
                  {form.mediaIds.includes(m.id) && (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-violet-600 text-white">
                      <Check size={14} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {saveStatus && saveStatus !== "idle" && (
            <p className={`rounded-xl p-3 text-sm ${
              saveStatus === "saving" ? "bg-blue-50 text-blue-700" :
              saveStatus === "saved" ? "bg-green-50 text-green-700" :
              saveStatus === "failed" ? "bg-red-50 text-red-700" : ""
            }`}>
              {saveStatus === "saving" && "Modifications en cours…"}
              {saveStatus === "saved" && "Brouillon enregistré"}
              {saveStatus === "failed" && "Échec de l'enregistrement — Réessayer"}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(false)}>Enregistrer le souvenir</Button>
            <Button variant="secondary" onClick={() => save(true)}>
              Enregistrer comme brouillon
            </Button>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Aperçu
            </Button>
            <Button variant="ghost" onClick={() => nav("/memories")}>
              Annuler
            </Button>
          </div>
        </div>
        <Card className="h-fit border-cyan-200 p-5 xl:sticky xl:top-28">
          <Badge className="bg-cyan-50 text-cyan-700">
            <Sparkles size={13} className="mr-1" /> Simulation de démonstration
          </Badge>
          <h2 className="mt-4 text-lg font-extrabold">Organiser avec l’IA</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Les suggestions restent inactives tant que vous ne les acceptez pas.
          </p>
          <div className="mt-5 grid gap-2">
            <Button
              variant="ai"
              onClick={() => runAi("category")}
              disabled={ai.status === "loading"}
            >
              Suggérer une catégorie
            </Button>
            <Button
              variant="ai"
              onClick={() => runAi("tags")}
              disabled={ai.status === "loading"}
            >
              Générer des tags
            </Button>
            <Button
              variant="ai"
              onClick={() => runAi("analysis")}
              disabled={ai.status === "loading"}
            >
              Analyser le souvenir
            </Button>
          </div>
          {ai.status === "loading" && (
            <Loading label="L’assistant réfléchit..." />
          )}
          {ai.status === "error" && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {ai.error || "Une erreur est survenue. Réessayez."}
            </p>
          )}
          {ai.category && (
            <Suggestion
              label="Catégorie suggérée"
              value={ai.category}
              onAccept={() => change("category", ai.category)}
              onDismiss={() => setAi({ ...ai, category: null, categoryConfidence: null, categoryReasoning: null })}
            />
          )}{" "}
          {!!ai.tags.length && (
            <Suggestion
              label="Tags suggérés"
              value={ai.tags.join(", ")}
              onAccept={() =>
                change("tags", [...new Set([...form.tags, ...ai.tags])])
              }
              onDismiss={() => setAi({ ...ai, tags: [], tagsConfidence: null })}
            />
          )}{" "}
          {ai.analysis && (
            <Suggestion
              label="Analyse suggérée"
              value={ai.analysis}
              onDismiss={() => setAi({ ...ai, analysis: "" })}
            />
          )}
        </Card>
      </div>
      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        title="Aperçu du souvenir"
        actions={
          <Button onClick={() => setPreview(false)}>Continuer l’édition</Button>
        }
      >
        <Badge className={categoryColors[form.category]}>{form.category}</Badge>
        <h3 className="mt-3 text-xl font-extrabold">
          {form.title || "Sans titre"}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {form.eventDate && fmt(form.eventDate)}{" "}
          {form.location && `· ${form.location}`}
        </p>
        <p className="mt-4 text-sm leading-6">
          {form.description || "Aucune description."}
        </p>
      </Modal>
    </>
  )
}
function Suggestion({ label, value, onAccept, onDismiss }) {
  return (
    <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
        {label}
      </p>
      <p className="mt-1 text-sm text-cyan-950">{value}</p>
      <div className="mt-3 flex gap-2">
        {onAccept && (
          <Button className="!px-3] !py-1.5]" onClick={onAccept}>
            <Check size={14} /> Accepter
          </Button>
        )}
        <Button variant="ghost" className="!px-3]!py-1.5" onClick={onDismiss}>
          <X size={14} /> Rejeter
        </Button>
      </div>
    </div>
  )
}

export function MemoryDetail() {
  const { id } = useParams(),
    { memories, media, deleteMemory, notify } = useStore(),
    nav = useNavigate(),
    [pending, setPending] = useState(false),
    [similar, setSimilar] = useState([]),
    [summary, setSummary] = useState(""),
    [summaryLoading, setSummaryLoading] = useState(false),
    [summaryError, setSummaryError] = useState("")
  
  const m = memories.find((x) => x.id === id)
  
  useEffect(() => {
    if (id) {
      memoryService.getSimilarMemories(id, memories)
        .then(setSimilar)
        .catch((error) => {
          console.error('[MemoryDetail] Error fetching similar memories:', error)
          setSimilar([]) // Treat errors as no results (prevent crashes)
        })
    }
  }, [id, memories])
  
  // Generate summary via real AI
  const generateSummary = async () => {
    if (!m) return
    
    setSummaryLoading(true)
    setSummaryError("")
    
    try {
      const result = await memoryService.generateMemorySummary(
        m.title,
        m.description,
        m.category,
        m.tags,
        m.location
      )
      setSummary(result.summary)
    } catch (error) {
      setSummaryError(error.message || "Erreur lors de la génération du résumé")
      console.error("Summary generation error:", error)
    } finally {
      setSummaryLoading(false)
    }
  }
  
  if (!m) return <Loading label="Chargement du souvenir..." />
  const linked = media.filter((x) => m.mediaIds.includes(x.id))
  const remove = async () => {
    await deleteMemory(id)
    notify("Souvenir supprimé")
    nav("/memories")
  }
  return (
    <>
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Link to="/memories">Souvenirs</Link>
        <span>/</span>
        <span className="truncate">{m.title}</span>
      </div>
      <PageHeader
        title={m.title}
        subtitle={`${fmt(m.eventDate)}${m.location ? ` · ${m.location}` : ""}`}
        actions={
          <>
            <Link to="/memories">
              <Button variant="ghost">
                <ArrowLeft /> Retour
              </Button>
            </Link>
            <Link to={`/memories/${id}/edit`}>
              <Button variant="secondary">
                <Edit3 /> Modifier
              </Button>
            </Link>
            <Button variant="danger" onClick={() => setPending(true)}>
              <Trash2 /> Supprimer
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            {m.cover && (
              <img
                src={m.cover}
                alt=""
                className="max-h-34rem] w-full object-cover"
                onError={(e) => {
                  // If image fails to load and URL is relative, try with absolute path
                  if (m.cover && m.cover.startsWith('/')) {
                    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                    e.target.src = `${API_BASE_URL}${m.cover}`
                  }
                }}
              />
            )}
            <div className="p-7">
              <div className="flex flex-wrap gap-2">
                <Badge className={categoryColors[m.category]}>
                  {m.category}
                </Badge>
                <Badge>{importanceLabels[m.importance]}</Badge>
                {m.favorite && (
                  <Badge className="bg-rose-50 text-rose-700">
                    <Heart className="mr-1" size={13} /> Favori
                  </Badge>
                )}
              </div>
              <p className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700">
                {m.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {m.tags.map((x) => (
                  <Badge key={x}>#{x}</Badge>
                ))}
              </div>
              <div className="mt-7 grid gap-3 border-t border-slate-100 pt-5 text-xs text-slate-400 sm:grid-cols-2">
                <span>Créé le {fmt(m.createdAt.slice(0, 10))}</span>
                <span>Mis à jour le {fmt(m.updatedAt.slice(0, 10))}</span>
                {m.relatedJournalEntryId && (
                  <Link
                    className="font-bold text-violet-600"
                    to={`/journal/${m.relatedJournalEntryId}`}
                  >
                    Voir l’entrée de journal associée
                  </Link>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle
              title="Médias associés"
              subtitle={`${linked.length} élément${
                linked.length !== 1 ? "s" : ""
              }`}
            />
            {linked.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {linked.map((x) => (
                  <Link to={`/media/${x.id}`} key={x.id}>
                    {x.url ? (
                      <img
                        src={x.url}
                        alt={x.title}
                        className="aspect-square w-full rounded-xl object-cover"
                        onError={(e) => {
                          // If image fails to load and URL is relative, try with absolute path
                          if (x.url && x.url.startsWith('/')) {
                            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                            e.target.src = `${API_BASE_URL}${x.url}`
                          }
                        }}
                      />
                    ) : (
                      <div className="grid aspect-square place-items-center rounded-xl bg-slate-100">
                        <Play />
                      </div>
                    )}
                    <p className="mt-2 text-xs font-bold">{x.title}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Aucun média associé"
                text="Vous pouvez ajouter des médias existants en modifiant ce souvenir."
                action={
                  <Link to={`/memories/${id}/edit`}>
                    <Button variant="secondary">Associer des médias</Button>
                  </Link>
                }
              />
            )}
          </Card>
          <div>
            <SectionTitle
              title="Souvenirs similaires"
              subtitle="Selon les catégories, lieux et tags partagés"
            />
            {similar.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {similar.map((x) => (
                  <MemoryCard key={x.id} memory={x} onDelete={() => {}} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Aucun souvenir similaire trouvé pour le moment.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Ajoutez d'autres souvenirs pour découvrir des liens entre vos expériences.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <Badge className="bg-cyan-50 text-cyan-700">
              <Sparkles size={13} className="mr-1" /> Résumé IA
            </Badge>
            <h2 className="mt-4 font-extrabold">Résumé du souvenir</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {summary || m.aiSummary || "Aucun résumé n’a encore été généré."}
            </p>
            <Button
              variant="ai"
              className="mt-4 w-full"
              onClick={generateSummary}
              disabled={summaryLoading}
            >
              <RefreshCw size={16} />
              {summaryLoading ? "Génération..." : summary || m.aiSummary ? "Régénérer" : "Générer"}
            </Button>
          </Card>
          <Card className="p-5">
            <h2 className="font-extrabold">Suggestions IA</h2>
            <p className="mt-2 text-sm text-slate-500">
              Catégorie suggérée : <b>{m.category}</b>
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {m.tags.slice(0, 3).map((x) => (
                <Badge className="bg-cyan-50 text-cyan-700" key={x}>
                  {x}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Résultats de démonstration modifiables dans le formulaire.
            </p>
          </Card>
        </div>
      </div>
      <Modal
        open={pending}
        onClose={() => setPending(false)}
        title="Supprimer ce souvenir ?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={remove}>
              Confirmer la suppression
            </Button>
          </>
        }
      >
        « {m.title} » sera supprimé, mais pas les médias associés.
      </Modal>
    </>
  )
}

export function Timeline() {
  const { memories } = useStore(),
    [order, setOrder] = useState("desc"),
    [year, setYear] = useState("Tous")
  const years = [...new Set(memories.map((x) => x.eventDate.slice(0, 4)))]
    .sort()
    .reverse()
  const list = memories
    .filter((x) => year === "Tous" || x.eventDate.startsWith(year))
    .sort((a, b) =>
      order === "desc"
        ? b.eventDate.localeCompare(a.eventDate)
        : a.eventDate.localeCompare(b.eventDate),
    )
  const groups = list.reduce((a, m) => {
    const d = new Date(`${m.eventDate}T12:00:00`),
      k = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    ;(a[k] ??= []).push(m)
    return a
  }, {})
  return (
    <>
      <PageHeader
        title="Timeline de votre histoire"
        subtitle="Revisitez les moments qui ont jalonné votre parcours."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              <option>Tous</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
            >
              {order === "desc" ? "Du plus récent" : "Du plus ancien"}
            </Button>
            <Link to="/memories">
              <Button variant="ghost">Vue générale</Button>
            </Link>
          </>
        }
      />
      <div className="mx-auto max-w-4xl">
        {Object.entries(groups).map(([group, items]) => (
          <section
            key={group}
            className="relative border-l-2 border-violet-100 pb-10 pl-7"
          >
            <span className="absolute -left-2 top-1 size-3.5 rounded-full border-4 border-white bg-violet-600" />
            <h2 className="mb-5 text-xl font-extrabold">{group}</h2>
            <div className="space-y-4">
              {items.map((m) => (
                <Link to={`/memories/${m.id}`} key={m.id}>
                  <Card className="mb-4 flex overflow-hidden hover:border-violet-300">
                    {m.cover && (
                      <img
                        src={m.cover}
                        className="hidden w-44 object-cover sm:block"
                        alt=""
                      />
                    )}
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={categoryColors[m.category]}>
                          {m.category}
                        </Badge>
                        <span className="text-xs font-bold text-slate-400">
                          {fmt(m.eventDate)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-extrabold">{m.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                        {m.description}
                      </p>
                      {m.location && (
                        <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin size={13} />
                          {m.location}
                        </p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

export function MemoryCalendar() {
  const { memories } = useStore(),
    [cursor, setCursor] = useState(new Date(2026, 1, 1)),
    [selected, setSelected] = useState("2026-02-14"),
    [category, setCategory] = useState("Toutes")
  const year = cursor.getFullYear(),
    month = cursor.getMonth(),
    days = new Date(year, month + 1, 0).getDate(),
    offset = (new Date(year, month, 1).getDay() + 6) % 7
  const filtered = memories.filter(
    (x) => category === "Toutes" || x.category === category,
  )
  const dateKey = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  const selectedItems = filtered.filter((x) => x.eventDate === selected)
  return (
    <>
      <PageHeader
        title="Calendrier des souvenirs"
        subtitle="Chaque marqueur correspond à un moment conservé."
        actions={
          <>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Toutes</option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Link to={`/memories/new?date=${selected}`}>
              <Button>
                <Plus /> Ajouter à cette date
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft />
            </Button>
            <h2 className="text-lg font-extrabold">
              {monthNames[month]} {year}
            </h2>
            <Button
              variant="ghost"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((x) => (
              <div key={x} className="py-3">
                {x}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
              const key = dateKey(d),
                items = filtered.filter((x) => x.eventDate === key)
              return (
                <button
                  key={d}
                  onClick={() => setSelected(key)}
                  className={`min-h-20 rounded-xl border p-2 text-left transition sm:min-h-28 ${
                    selected === key
                      ? "border-violet-500 bg-violet-50"
                      : "border-transparent hover:bg-slate-50"
                  } ${key === "2026-02-18" ? "ring-2 ring-cyan-300" : ""}`}
                >
                  <span className="text-xs font-bold">{d}</span>
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 2).map((x) => (
                      <div
                        key={x.id}
                        className="truncate rounded bg-white px-1.5 py-1 text-[10px] font-bold text-violet-700 shadow-sm"
                      >
                        {x.title}
                      </div>
                    ))}
                    {items.length > 2 && (
                      <span className="text-[10px] text-slate-400">
                        +{items.length - 2} autres
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
        <Card className="h-fit p-5">
          <SectionTitle
            title={selected ? fmt(selected) : "Choisissez une date"}
            subtitle={`${selectedItems.length} souvenir${
              selectedItems.length !== 1 ? "s" : ""
            }`}
          />
          {selectedItems.length ? (
            <div className="space-y-3">
              {selectedItems.map((x) => (
                <Link
                  to={`/memories/${x.id}`}
                  key={x.id}
                  className="block rounded-xl bg-slate-50 p-3 hover:bg-violet-50"
                >
                  <Badge className={categoryColors[x.category]}>
                    {x.category}
                  </Badge>
                  <p className="mt-2 font-extrabold">{x.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{x.location}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Aucun souvenir ce jour"
              text="Ajoutez un événement à cette date."
            />
          )}
        </Card>
      </div>
    </>
  )
}

export function MemoryInsights() {
  const { memories, notify } = useStore(),
    [period, setPeriod] = useState("year"),
    [start, setStart] = useState("2025-01-01"),
    [end, setEnd] = useState("2025-12-31"),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState(null),
    [saved, setSaved] = useState(() =>
      JSON.parse(localStorage.getItem("mindlog_summaries") || "[]"),
    )
  const range =
    period === "month"
      ? ["2026-02-01", "2026-02-28"]
      : period === "year"
        ? ["2025-01-01", "2025-12-31"]
        : [start, end]
  const items = memories.filter(
    (x) => x.eventDate >= range[0] && x.eventDate <= range[1],
  )
  const counts = Object.entries(
    items.reduce(
      (a, x) => ({ ...a, [x.category]: (a[x.category] || 0) + 1 }),
      {},
    ),
  ).map(([name, value]) => ({ name, value }))
  const tags = Object.entries(
    items
      .flatMap((x) => x.tags)
      .reduce((a, x) => ({ ...a, [x]: (a[x] || 0) + 1 }), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const generate = () => {
    if (range[0] > range[1]) {
      notify("La date de début doit précéder la date de fin.", "error")
      return
    }
    setLoading(true)
    setTimeout(() => {
      const top =
        counts.sort((a, b) => b.value - a.value)[0]?.name ||
        "moments personnels"
      const titles = items.slice(0, 3).map((x) => x.title)
      const text = items.length
        ? `Sur cette période, vous avez conservé ${items.length} souvenir${
            items.length > 1 ? "s" : ""
          }, principalement autour de ${top.toLowerCase()}. Vous avez notamment enregistré ${titles.join(", ")}. Ces moments reflètent les expériences que vous avez choisi de préserver.`
        : "Aucun souvenir ne correspond à cette période. Choisissez une autre plage pour générer un résumé fidèle."
      const out = {
        id: crypto.randomUUID(),
        text,
        start: range[0],
        end: range[1],
        memoryIds: items.map((x) => x.id),
        createdAt: new Date().toISOString(),
      }
      setResult(out)
      const next = [out, ...saved].slice(0, 5)
      setSaved(next)
      localStorage.setItem("mindlog_summaries", JSON.stringify(next))
      setLoading(false)
    }, 800)
  }
  return (
    <>
      <PageHeader
        title="AI Memory Insights"
        subtitle="Transformez vos souvenirs enregistrés en synthèses fidèles et explorables."
        actions={
          <Link to="/memories/search">
            <Button variant="secondary">
              <Search /> Recherche intelligente
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Souvenirs enregistrés" value={memories.length} />
        <Stat
          label="Souvenirs importants"
          value={memories.filter((x) => x.importance.includes("high")).length}
        />
        <Stat
          label="Catégorie fréquente"
          value={counts.sort((a, b) => b.value - a.value)[0]?.name || "—"}
        />
        <Stat
          label="Période analysée"
          value={
            period === "month"
              ? "1 mois"
              : period === "year"
                ? "1 an"
                : "Personnalisée"
          }
        />
      </div>
      <Card className="mt-6 p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Select
            label="Type de résumé"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="month">Résumé mensuel</option>
            <option value="year">Résumé annuel</option>
            <option value="custom">Période personnalisée</option>
          </Select>
          {period === "custom" && (
            <>
              <Input
                label="Date de début"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <Input
                label="Date de fin"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </>
          )}
          <Button className="self-end" onClick={generate} disabled={loading}>
            <WandSparkles />
            {loading ? "Génération..." : "Générer mon résumé"}
          </Button>
        </div>
        {loading && <Loading label="Analyse des souvenirs sélectionnés..." />}
        {result && (
          <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
            <Badge className="bg-white text-cyan-700">Sortie IA simulée</Badge>
            <p className="mt-4 text-base leading-8 text-cyan-950">
              {result.text}
            </p>
            <p className="mt-3 text-xs text-cyan-700">
              Période : {fmt(result.start)} — {fmt(result.end)} ·{" "}
              {result.memoryIds.length} souvenir(s) utilisé(s)
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {items.map((x) => (
                <Link key={x.id} to={`/memories/${x.id}`}>
                  <Badge className="bg-white text-cyan-800">{x.title}</Badge>
                </Link>
              ))}
            </div>
            <Button variant="ai" className="mt-4" onClick={generate}>
              <RefreshCw /> Régénérer
            </Button>
          </div>
        )}
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Répartition par catégorie" />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={counts}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#6C63FF" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Tags les plus utilisés" />
          <div className="flex flex-wrap gap-2">
            {tags.map(([tag, count]) => (
              <Badge key={tag} className="bg-violet-50 text-violet-700">
                #{tag} · {count}
              </Badge>
            ))}
          </div>
          <SectionTitle
            title="À revisiter"
            subtitle="Souvenirs importants de la période"
          />
          <div className="space-y-2">
            {items
              .filter((x) => x.importance.includes("high"))
              .slice(0, 4)
              .map((x) => (
                <Link
                  key={x.id}
                  to={`/memories/${x.id}`}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <Clock3 className="text-violet-500" />
                  <div>
                    <b className="text-sm">{x.title}</b>
                    <p className="text-xs text-slate-400">{fmt(x.eventDate)}</p>
                  </div>
                </Link>
              ))}
          </div>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <SectionTitle
          title="Résumés sauvegardés"
          subtitle="Conservés localement dans cette démonstration"
        />
        {saved.length ? (
          <div className="space-y-3">
            {saved.map((x) => (
              <div key={x.id} className="rounded-xl bg-slate-50 p-4">
                <p className="line-clamp-2 text-sm">{x.text}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {fmt(x.start)} — {fmt(x.end)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Aucun résumé sauvegardé" />
        )}
      </Card>
    </>
  )
}

export function MemorySearch() {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null),
    [category, setCategory] = useState("Toutes")
  const examples = [
    "Mes souvenirs de vacances en été",
    "Les moments importants de mes études",
    "Les souvenirs liés à mes amis",
    "Les événements à Sousse",
  ]
  const search = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await memoryService.intelligentSearch(query)
      setResults(response.results || [])
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }
  const shown = results.filter(
    (x) => category === "Toutes" || x.category === category,
  )
  return (
    <>
      <PageHeader
        title="Recherche intelligente"
        subtitle="Recherche IA par compréhension du contexte, expansion de termes et scoring de pertinence."
      />
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Sparkles
              className="absolute left-3 top-3 text-cyan-500"
              size={19}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:ring-4 focus:ring-cyan-100"
              placeholder="Décrivez le souvenir que vous recherchez..."
            />
          </div>
          <Button onClick={search} disabled={!query || loading}>
            <Search />
            {loading ? "Recherche..." : "Rechercher"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((x) => (
            <button
              key={x}
              onClick={() => setQuery(x)}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700"
            >
              {x}
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </Card>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-bold">
          {results.length
            ? `${shown.length} résultat(s)`
            : "Lancez une recherche pour explorer vos souvenirs"}
        </p>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>Toutes</option>
          {categories.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
      </div>
      {loading ? (
        <Loading />
      ) : shown.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {shown.map((x) => (
            <div key={x.id} className="relative">
              <MemoryCard memory={x} onDelete={() => {}} />
              {x.relevance_score !== undefined && (
                <Badge className="absolute right-3 top-3 bg-white text-violet-700 shadow">
                  Pertinence {Math.round(x.relevance_score * 100)}%
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : results.length === 0 && query ? (
        <div className="mt-5">
          <Empty
            title="Aucun résultat ne correspond à cette recherche"
            text="Essayez un autre terme, un lieu ou une catégorie différente."
          />
        </div>
      ) : null}
    </>
  )
}

export { MemoryForm }
