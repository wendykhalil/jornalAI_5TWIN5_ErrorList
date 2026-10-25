import { useMemo, useState, useEffect, useRef } from "react"
import { mediaPhotoService } from "../../services/mediaPhotoService"
import { Link, useNavigate, useParams } from "react-router"
import {
  Plus,
  Search,
  Heart,
  Trash2,
  Edit3,
  ArrowLeft,
  Sparkles,
  Smile,
  CalendarDays,
  Mic,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  RotateCcw,
  Target,
  Flame,
  Play,
  Users,
  Download,
  Pin,
  Save,
  MessageCircle,
  X,
  AlertCircle,
  Images,
  FolderOpen,
  Camera,
  ArrowUpRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useStore } from "../../store/AppStore"
import { journalService } from "../../services/journalService"
import { moodService } from "../../services/moodService"
import { journalVisionService } from "../../services/journalVisionService"
import { journalWhisperService } from "../../services/journalWhisperService"
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
// Calm editorial design system: flat surfaces, precise borders, no heavy gradients.
const actionPrimary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
const actionSecondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
const actionSubtle = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
const actionDanger = "inline-flex items-center justify-center gap-1 rounded-lg border border-transparent bg-white/95 p-2 text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
const moodColors = {
  Heureux: "#22c55e",
  Calme: "#22d3ee",
  Motivé: "#6c63ff",
  Reconnaissant: "#f59e0b",
  Neutre: "#94a3b8",
  Fatigué: "#64748b",
  Stressé: "#f97316",
  Triste: "#3b82f6",
  Anxieux: "#ef4444",
}
function JournalPhotos({ ids = [] }) {
  const [attachments, setAttachments] = useState([])
  const key = JSON.stringify(ids)
  useEffect(() => {
    let active = true
    if (!ids.length) { setAttachments([]); return }
    mediaPhotoService.getAttachments()
      .then((items) => { if (active) setAttachments(items.filter((m) => ids.some((id) => String(id) === String(m.id)))) })
      .catch(() => { if (active) setAttachments([]) })
    return () => { active = false }
  }, [key])
  if (!attachments.length) return null
  return <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {attachments.map((file) => <div key={file.id} className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      {file.media_type === "video"
        ? <video src={file.file_url || file.url || file.file} controls preload="metadata" className="aspect-square w-full bg-black object-contain" />
        : <img src={file.file_url || file.url || file.file} alt={file.title} className="aspect-square w-full object-cover" />}
      {file.description && <p className="p-2 text-xs text-slate-600">{file.description}</p>}
    </div>)}
  </div>
}

function JournalVisionPanel({ images = [], busyId, error, result, onAnalyze }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const idsKey = JSON.stringify(images)

  useEffect(() => {
    let active = true
    if (!images.length) { setPhotos([]); return }
    setLoading(true)
    setLoadError("")
    mediaPhotoService.getAttachments()
      .then((all) => {
        if (active) setPhotos(all.filter((m) =>
          images.some((id) => String(id) === String(m.id)) && m.media_type === "image"
        ))
      })
      .catch((err) => { if (active) setLoadError(err.message || "Photos indisponibles") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [idsKey])

  if (!images.length) return null
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <Sparkles size={19} className="text-violet-600" />
        <h3 className="text-lg font-bold text-slate-900">Choisir une photo</h3>
      </div>
      <p className="mt-2 text-base leading-7 text-slate-600">Choisissez une photo. L'analyse est facultative et ne modifie pas votre journal.</p>
      {loading && <p className="mt-3 text-sm">Chargement des photos...</p>}
      {loadError && <p role="alert" className="mt-3 text-sm text-red-600">{loadError}</p>}
      {!loading && !loadError && photos.length === 0 && <p className="mt-3 text-sm text-slate-600">Aucune image compatible attachée à cette entrée.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {photos.map((photo) => (
          <div key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <img src={photo.file_url || photo.url || photo.file} alt={photo.title || "Photo du journal"} className="aspect-square w-full rounded-lg object-cover" />
            <p className="mt-2 truncate text-sm font-semibold text-slate-700">{photo.title || "Photo"}</p>
            <Button variant="ai" className="mt-2 w-full" disabled={Boolean(busyId)} onClick={() => onAnalyze(photo.id)}>
              <Sparkles size={15} /> {String(busyId) === String(photo.id) ? "Analyse en cours..." : "Analyser cette photo"}
            </Button>
          </div>
        ))}
      </div>
      {busyId && <p role="status" className="mt-3 text-sm text-violet-700">Llama 3.2 Vision analyse votre photo. Cela peut prendre un moment...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {result && !busyId && (
        <div className="mt-4 max-h-[560px] space-y-4 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/50 p-5 text-base leading-8">
          <p><strong>Description :</strong> {result.description}</p>
          <div>
            <strong>Suggestion pour votre journal :</strong>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-violet-100 bg-violet-50/50 p-4">{result.journal_suggestion}</p>
          </div>
          <p className="text-xs text-slate-500">Texte proposé par l'IA : vérifiez-le avant de l'utiliser. Aucune modification automatique.</p>
        </div>
      )}
    </div>
  )
}

function JournalDictation({ onTranscript, disabled = false }) {
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop()
  }

  const start = async () => {
    setError("")
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Enregistrement non disponible. Utilisez localhost ou HTTPS et un navigateur compatible.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onerror = () => { setError("Erreur pendant l'enregistrement."); setRecording(false) }
      recorder.onstop = async () => {
        setRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        const type = recorder.mimeType || "audio/webm"
        const extension = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm"
        const blob = new Blob(chunksRef.current, { type })
        if (!blob.size) { setError("Enregistrement vide."); return }
        setBusy(true)
        try {
          const result = await journalWhisperService.transcribe(new File([blob], `recording.${extension}`, { type }))
          if (!result?.text) throw new Error("Aucun texte transcrit.")
          onTranscript(result.text)
        } catch (err) { setError(err.message || "Transcription impossible.") }
        finally { setBusy(false) }
      }
      recorder.start()
      setRecording(true)
    } catch (err) { setError(err.message || "Accès au microphone refusé.") }
  }

  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-bold text-slate-900">Dictée vocale</p>
        <p className="text-xs text-slate-500">Parlez librement, puis vérifiez la transcription avant d'enregistrer.</p></div>
      <button type="button" disabled={disabled || busy} onClick={recording ? stop : start}
        className={`${actionPrimary} ${recording ? "!bg-rose-600 hover:!bg-rose-700" : ""}`}>
        <Mic size={16}/>{recording ? "Arrêter" : busy ? "Transcription..." : "Dicter mon texte"}
      </button>
    </div>
    {recording && <p role="status" className="mt-2 text-xs font-medium text-rose-700">● Enregistrement en cours…</p>}
    {busy && <p role="status" className="mt-2 text-xs text-violet-700">Transcription de votre audio en cours…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </div>
}

const countJournalWords = (text) => (text.trim().match(/\S+/g) || []).length

function EntryForm({ item }) {
  const { createJournal, updateJournal, notify } = useStore()
  const nav = useNavigate()
  const [form, setForm] = useState(() => item || {
    title: "", content: "", date: new Date().toLocaleDateString("en-CA"),
    mood: "Calme", tags: [], favorite: false, draft: false,
  })
  const [tagText, setTagText] = useState(() => (item?.tags || []).join(", "))
  const [selectedIds, setSelectedIds] = useState(() => item?.images || [])
  const [availablePhotos, setAvailablePhotos] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [filePreviews, setFilePreviews] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [ai, setAi] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!showLibrary) return
    let active = true
    setMediaLoading(true)
    mediaPhotoService.getAttachments().then((photos) => {
      if (active) setAvailablePhotos(Array.isArray(photos) ? photos : photos.results || [])
    }).catch((err) => {
      if (active) setError(err.message || "Impossible de charger la bibliothèque.")
    }).finally(() => { if (active) setMediaLoading(false) })
    return () => { active = false }
  }, [showLibrary])

  useEffect(() => {
    const previews = newFiles.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setFilePreviews(previews)
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url))
  }, [newFiles])

  const validate = (draft) => {
    const errors = {}
    const title = form.title.trim()
    const tags = tagText.split(",").map((x) => x.trim()).filter(Boolean)
    if (title.length < 3 || title.length > 255) errors.title = "Le titre doit contenir entre 3 et 255 caractères."
    if (!draft && countJournalWords(form.content) < 5) errors.content = "Votre histoire doit contenir au moins 5 mots pour être publiée (brouillon autorisé)."
    if (!form.date || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(Date.parse(form.date))) errors.date = "Choisissez une date valide."
    else if (form.date > new Date().toLocaleDateString("en-CA")) errors.date = "La date ne peut pas être dans le futur."
    if (!form.mood || form.mood.length > 50) errors.mood = "Choisissez une humeur valide."
    if (tags.length > 10) errors.tags = "Maximum 10 tags."
    else if (tags.some((tag) => tag.length > 30)) errors.tags = "Chaque tag doit contenir au maximum 30 caractères."
    else if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length) errors.tags = "Évitez les tags en double."
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const clearFieldError = (name) => setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  const FieldError = ({ name }) => fieldErrors[name] ? <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600"><AlertCircle size={13}/>{fieldErrors[name]}</p> : null

  const save = async (draft = false) => {
    if (!validate(draft)) {
      setError("Corrigez les champs indiqués avant d’enregistrer.")
      return
    }
    setSaving(true)
    setError("")
    try {
      // Ensure every selected attachment is still available to this account.
      const beforeUpload = selectedIds.length ? await mediaPhotoService.getAttachments() : []
      const permittedIds = new Set((Array.isArray(beforeUpload) ? beforeUpload : beforeUpload.results || []).map((m) => String(m.id)))
      const missing = selectedIds.filter((id) => !permittedIds.has(String(id)))
      if (missing.length) {
        throw new Error("Certains médias sélectionnés ne sont plus accessibles. Retirez-les puis réessayez : " + missing.join(", "))
      }
      const uploaded = []
      for (const file of newFiles) {
        const photo = await mediaPhotoService.uploadAttachment(file)
        uploaded.push(photo.id)
      }
      // Confirm each uploaded UUID is visible through the authenticated media API.
      if (uploaded.length) {
        const visible = await mediaPhotoService.getAttachments()
        const visibleIds = new Set((Array.isArray(visible) ? visible : visible.results || []).map((m) => String(m.id)))
        if (uploaded.some((id) => !visibleIds.has(String(id)))) {
          throw new Error("Média envoyé mais introuvable dans votre bibliothèque. Vérifiez que les deux API utilisent la même base et le même utilisateur.")
        }
      }
      const payload = {
        title: form.title.trim(), content: form.content.trim(), date: form.date,
        mood: form.mood, favorite: form.favorite, draft,
        tags: tagText.split(",").map((x) => x.trim()).filter(Boolean),
        images: [...new Set([...selectedIds, ...uploaded])],
      }
      const saved = item
        ? await updateJournal(item.id, payload)
        : await createJournal(payload)
      notify(draft ? "Brouillon enregistré" : "Entrée enregistrée")
      nav(`/journal/${saved.id}`)
    } catch (err) {
      setError(err.message || "Impossible d’enregistrer l’entrée.")
      notify("Échec de l’enregistrement", "error")
    } finally { setSaving(false) }
  }

  return <>
    <div className="mb-7 rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-violet-50/60 to-indigo-50/60 p-7 shadow-sm">
      <Link to="/journal" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-violet-700"><ArrowLeft size={16} /> Mon journal</Link>
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-sm"><Edit3 size={20} /></span><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Espace d’écriture</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">{item ? "Modifier mon entrée" : "Écrire une nouvelle entrée"}</h1></div></div>
      <p className="mt-3 text-sm text-slate-500">Un moment pour vous. Écrivez librement, à votre rythme.</p>
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <Card className="space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between"><label className="text-sm font-semibold text-slate-800">Titre <span className="text-rose-500">*</span></label><span className="text-xs text-slate-400">{form.title.length}/255</span></div>
          <input type="text" maxLength={255} placeholder="Donnez un titre à cette journée" value={form.title}
            aria-invalid={Boolean(fieldErrors.title)} onChange={(e) => { setForm({ ...form, title: e.target.value }); clearFieldError("title") }}
            className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4 focus:ring-violet-100 ${fieldErrors.title ? "border-rose-400" : "border-slate-200 focus:border-violet-400"}`} />
          <FieldError name="title" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><label className="text-sm font-semibold text-slate-800">Votre histoire <span className="text-rose-500">*</span></label><span className="text-xs text-slate-400">{countJournalWords(form.content)} / 5 mots minimum</span></div>
          <textarea rows={11} placeholder="Qu’avez-vous envie de retenir ?" value={form.content}
            aria-invalid={Boolean(fieldErrors.content)} onChange={(e) => { setForm({ ...form, content: e.target.value }); clearFieldError("content") }}
            className={`w-full resize-y rounded-2xl border bg-white px-4 py-4 text-sm leading-7 outline-none transition focus:ring-4 focus:ring-violet-100 ${fieldErrors.content ? "border-rose-400" : "border-slate-200 focus:border-violet-400"}`} />
          <FieldError name="content" />
          <p className="text-xs text-slate-400">Minimum 5 mots pour publier. Vous pouvez enregistrer un brouillon à tout moment.</p>
        </div>
        <JournalDictation disabled={saving} onTranscript={(text) => setForm((prev) => ({ ...prev, content: [prev.content.trim(), text.trim()].filter(Boolean).join("\n\n") }))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Input label="Date" type="date" max={new Date().toLocaleDateString("en-CA")} value={form.date}
            onChange={(e) => { setForm({ ...form, date: e.target.value }); clearFieldError("date") }} /><FieldError name="date" /></div>
          <div><Select label="Humeur" value={form.mood}
            onChange={(e) => { setForm({ ...form, mood: e.target.value }); clearFieldError("mood") }}>
            {Object.keys(moodColors).map((x) => <option key={x}>{x}</option>)}
          </Select><FieldError name="mood" /></div>
          <div><Input label="Tags (séparés par des virgules)" value={tagText}
            onChange={(e) => { setTagText(e.target.value); clearFieldError("tags") }} /><FieldError name="tags" /></div>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"><Images size={21}/></span>
            <div><h3 className="font-bold text-slate-900">Souvenirs de cette entrée</h3><p className="mt-1 text-xs leading-5 text-slate-500">Ajoutez des photos ou vidéos uniquement à cette entrée. Votre bibliothèque n’apparaît plus automatiquement.</p></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className={`${actionPrimary} cursor-pointer`}>
              <Camera size={18}/> Importer des photos <ArrowUpRight size={15} className="opacity-60"/>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple disabled={saving} className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]
                  if (files.some((f) => !validTypes.includes(f.type) || f.size > (f.type.startsWith("video/") ? 100 : 10) * 1024 * 1024)) {
                    setError("Formats : JPG, PNG, WEBP, GIF, MP4, WEBM. Maximum 10 Mo/image ou 100 Mo/vidéo.")
                    e.target.value = ""; return
                  }
                  setError(""); setNewFiles((prev) => [...prev, ...files]); e.target.value = ""
                }} />
            </label>
            <button type="button" disabled={saving} onClick={() => setShowLibrary(true)}
              className={actionSecondary}>
              <FolderOpen size={18}/> Choisir dans la bibliothèque
            </button>
          </div>
          {(filePreviews.length > 0 || selectedIds.length > 0) && <div className="mt-5">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Fichiers attachés ({filePreviews.length + selectedIds.length})</p>
              <button type="button" disabled={saving} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50" onClick={() => { setNewFiles([]); setSelectedIds([]) }}>Tout retirer</button></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filePreviews.map(({ file, url }, index) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {file.type.startsWith("video/") ? <video src={url} className="aspect-square w-full bg-slate-900 object-cover" muted /> : <img src={url} alt={file.name} className="aspect-square w-full object-cover" />}
                <button type="button" aria-label={`Retirer ${file.name}`} disabled={saving} onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))} className={`absolute right-2 top-2 ${actionDanger}`}><X size={15}/></button>
                <p className="truncate px-2 py-2 text-xs text-slate-600" title={file.name}>{file.name}</p>
              </div>)}
              {selectedIds.map((id) => { const photo = availablePhotos.find((p) => String(p.id) === String(id)); return <div key={id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {photo ? (photo.media_type === "video" ? <video src={photo.file_url || photo.url || photo.file} muted className="aspect-square w-full bg-slate-900 object-cover" /> : <img src={photo.file_url || photo.url || photo.file} alt={photo.title || "Souvenir"} className="aspect-square w-full object-cover" />) : <div className="grid aspect-square place-items-center bg-violet-50 text-violet-400"><ImageIcon size={28}/></div>}
                <button type="button" aria-label="Retirer le média" disabled={saving} onClick={() => setSelectedIds((prev) => prev.filter((x) => String(x) !== String(id)))} className={`absolute right-2 top-2 ${actionDanger}`}><X size={15}/></button>
                <p className="truncate px-2 py-2 text-xs text-slate-600">{photo?.title || "Photo existante"}</p>
              </div> })}
            </div>
          </div>}
          {showLibrary && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Bibliothèque de médias">
            <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="text-lg font-bold text-slate-900">Ma bibliothèque</h3><p className="text-xs text-slate-500">Choisissez uniquement les souvenirs à associer à cette entrée.</p></div>
                <button type="button" aria-label="Fermer" onClick={() => setShowLibrary(false)} className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"><X size={21}/></button></div>
              <div className="overflow-y-auto p-5">{mediaLoading ? <p className="py-12 text-center text-slate-500">Chargement de votre bibliothèque…</p> : availablePhotos.length === 0 ? <p className="py-12 text-center text-slate-500">Aucun média dans votre bibliothèque.</p> :
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{availablePhotos.map((photo) => { const selected = selectedIds.some((id) => String(id) === String(photo.id)); return <button key={photo.id} type="button" onClick={() => setSelectedIds((prev) => selected ? prev.filter((id) => String(id) !== String(photo.id)) : [...prev, photo.id])}
                  className={`group relative overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-400"}`}>
                  {photo.media_type === "video" ? <video src={photo.file_url || photo.url || photo.file} muted className="aspect-square w-full bg-slate-900 object-cover" /> : <img src={photo.file_url || photo.url || photo.file} alt={photo.title || "Photo"} className="aspect-square w-full object-cover" />}
                  {selected && <span className="absolute right-2 top-2 rounded-lg bg-slate-900 p-1.5 text-white shadow"><CheckCircle2 size={17}/></span>}
                  <p className="truncate p-2 text-xs font-medium text-slate-700">{photo.title || "Souvenir"}</p>
                </button> })}</div>}</div>
              <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-xs text-slate-500">{selectedIds.length} sélectionné(s)</p><button type="button" onClick={() => setShowLibrary(false)} className={actionPrimary}>Terminer</button></div>
            </div>
          </div>}
        </section>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <button type="button" disabled={saving} onClick={() => save(false)} className={actionPrimary}><CheckCircle2 size={17}/>{saving ? "Enregistrement..." : "Publier l’entrée"} <ArrowUpRight size={15} className="opacity-60"/></button>
          <button type="button" disabled={saving} onClick={() => save(true)} className={actionSecondary}><Save size={17}/> Garder en brouillon</button>
          <button type="button" disabled={saving} onClick={() => nav("/journal")} className={actionSubtle}>Annuler</button>
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle title="Assistant d’écriture IA" subtitle="Améliorez votre texte sans modifier votre brouillon automatiquement." />
          <Button variant="ai" className="w-full" disabled={aiBusy || !form.content.trim()}
            onClick={async () => {
              setAiBusy(true); setAiError(""); setAi(null)
              try {
                const data = await journalService.improveText(form.content)
                if (!data?.improved_text) throw new Error("Réponse IA invalide")
                setAi({ improved: data.improved_text, original: form.content })
              } catch (err) { setAiError(err.message || "Erreur de l’assistant IA") }
              finally { setAiBusy(false) }
            }}><Sparkles size={16} /> {aiBusy ? "Amélioration en cours..." : "Améliorer mon texte"}</Button>
          {aiError && <p role="alert" className="mt-3 text-sm text-red-600">{aiError}</p>}
          {ai && <div className="mt-4 space-y-3 text-sm">
            <p className="font-bold">Proposition de l’IA :</p>
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-violet-50 p-3">{ai.improved}</p>
            {form.content !== ai.original && <p className="text-amber-700">Votre texte a changé depuis cette suggestion. Vérifiez avant d’appliquer.</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setForm((prev) => ({ ...prev, content: ai.improved })); setAi(null) }}>Appliquer</Button>
              <Button variant="ghost" onClick={() => setAi(null)}>Ignorer</Button>
            </div>
          </div>}
        </Card>

      </div>
    </div>
  </>
}

export function JournalPage({ mode = "list" }) {
  const { journals, journalsLoading, getJournal, updateJournal, deleteJournal, notify } = useStore()
  const nav = useNavigate()
  const { id } = useParams()

  const [showChat, setShowChat] = useState(false)
  const [chatQuestion, setChatQuestion] = useState("")
  const [chatMessages, setChatMessages] = useState([])
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState("")
  const askJournal = async () => {
    const question = chatQuestion.trim()
    if (!question || chatBusy) return
    setChatBusy(true); setChatError("")
    try {
      const response = await journalService.askJournal(question)
      if (!response?.answer) throw new Error("Réponse IA invalide")
      setChatMessages((prev) => [...prev, { question, answer: response.answer, sources: response.sources || [] }])
      setChatQuestion("")
    } catch (err) { setChatError(err.message || "Impossible d’interroger votre journal") }
    finally { setChatBusy(false) }
  }
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState("")
  const [analyticsRevision, setAnalyticsRevision] = useState(0)

  // Real AI analysis for the currently selected journal entry
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [photoAnalysis, setPhotoAnalysis] = useState(null)
  const [photoBusyId, setPhotoBusyId] = useState(null)
  const [photoError, setPhotoError] = useState("")
  const [assistantTab, setAssistantTab] = useState("text")

  const analyzePhoto = async (mediaId) => {
    if (!id || photoBusyId) return
    setPhotoBusyId(String(mediaId))
    setPhotoError("")
    setPhotoAnalysis(null)
    try {
      const data = await journalVisionService.analyzePhoto(id, mediaId)
      if (!data?.description || !data?.journal_suggestion) throw new Error("Réponse IA invalide.")
      setPhotoAnalysis(data)
    } catch (err) {
      setPhotoError(err.message || "Impossible d'analyser cette photo.")
    } finally {
      setPhotoBusyId(null)
    }
  }

  useEffect(() => {
    if (mode !== "list" || !showAnalytics) return
    let active = true
    setAnalyticsLoading(true)
    setAnalyticsError("")
    journalService.getAnalytics()
      .then((data) => { if (active) setAnalytics(data) })
      .catch((err) => { if (active) setAnalyticsError(err.message || "Erreur analytics") })
      .finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [mode, showAnalytics, analyticsRevision])

  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [sort, setSort] = useState("-date")
  const [mood, setMood] = useState("")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [results, setResults] = useState([])
  const [count, setCount] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState("")
  const [revision, setRevision] = useState(0)
  const [exportBusy, setExportBusy] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    if (mode !== "list") return
    let active = true
    setListLoading(true)
    setListError("")
    const filters = { page, page_size: pageSize, search: debouncedQ, ordering: sort,
      mood, date_from: dateFrom, date_to: dateTo }
    if (status === "favorite") filters.favorite = true
    if (status === "pinned") filters.pinned = true
    if (status === "draft") filters.draft = true
    if (status === "published") filters.draft = false
    journalService.getEntries(filters)
      .then((response) => {
        if (!active) return
        if (Array.isArray(response)) {
          setResults(response.slice((page - 1) * pageSize, page * pageSize))
          setCount(response.length)
        } else {
          setResults(response.results || [])
          setCount(response.count || 0)
        }
      })
      .catch((err) => { if (active) setListError(err.message || "Erreur de chargement") })
      .finally(() => { if (active) setListLoading(false) })
    return () => { active = false }
  }, [mode, page, debouncedQ, sort, mood, status, dateFrom, dateTo, revision])

  useEffect(() => {
    if ((mode !== "detail" && mode !== "edit") || !id) return
    let active = true
    setDetail(null)
    setDetailLoading(true)
    setError("")
    getJournal(id)
      .then((entry) => { if (active) setDetail(entry) })
      .catch((err) => { if (active) setError(err.message || "Entrée introuvable") })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [id, mode])

  useEffect(() => {
    setAiAnalysis(null)
    setAiError("")
    setAiLoading(false)
    setPhotoAnalysis(null)
    setPhotoError("")
    setPhotoBusyId(null)
  }, [id])

  const analyzeJournal = async () => {
    if (!id || aiLoading) return
    setAiLoading(true)
    setAiError("")
    setAiAnalysis(null)
    try {
      const response = await journalService.analyzeEntry(id)
      if (!response?.analysis) throw new Error("Réponse IA invalide.")
      setAiAnalysis(response.analysis)
    } catch (err) {
      setAiError(err.message || "Impossible d'analyser cette entrée.")
    } finally {
      setAiLoading(false)
    }
  }

  const item = detail || journals.find((x) => String(x.id) === String(id))
  const resetPage = () => setPage(1)
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  const toggleFavorite = async (entry) => {
    try {
      await updateJournal(entry.id, { favorite: !entry.favorite })
      setResults((prev) => prev.map((x) => x.id === entry.id ? { ...x, favorite: !entry.favorite } : x))
      if (status === "favorite") setRevision((n) => n + 1)
      setAnalyticsRevision((n) => n + 1)
    } catch (err) {
      notify(err.message || "Impossible de modifier le favori", "error")
    }
  }

  const togglePinned = async (entry) => {
    try {
      const updated = await journalService.togglePin(entry.id)
      const pinned = Boolean(updated.pinned)
      setResults((prev) => prev.map((x) => String(x.id) === String(entry.id) ? { ...x, pinned } : x))
      setDetail((prev) => prev && String(prev.id) === String(entry.id) ? { ...prev, pinned } : prev)
      setRevision((n) => n + 1)
      notify(pinned ? "Entrée épinglée" : "Entrée désépinglée")
    } catch (err) {
      notify(err.message || "Impossible de modifier l'épinglage", "error")
    }
  }

  const exportJournalPdf = async (entry) => {
    if (exportBusy) return
    setExportBusy(true)
    try {
      await journalService.exportEntryPdf(entry.id)
      notify("PDF téléchargé")
    } catch (err) {
      notify(err.message || "Export PDF impossible", "error")
    } finally {
      setExportBusy(false)
    }
  }

  const removeEntry = async () => {
    if (!item || busy) return
    setBusy(true)
    setError("")
    try {
      await deleteJournal(item.id)
      notify("Entrée supprimée")
      setConfirm(false)
      nav("/journal")
    } catch (err) {
      setError(err.message || "Impossible de supprimer l’entrée")
      notify("Échec de la suppression", "error")
    } finally { setBusy(false) }
  }

  if (mode === "new") return <EntryForm />
  if (mode === "edit") {
    if (detailLoading) return <p>Chargement de l’entrée...</p>
    if (error) return <p role="alert" className="text-red-600">{error}</p>
    if (!item) return <Empty title="Entrée introuvable" />
    return <EntryForm key={item.id} item={item} />
  }
  if (mode === "detail") {
    if (detailLoading) return <p>Chargement de l’entrée...</p>
    if (error && !item) return <p role="alert" className="text-red-600">{error}</p>
    if (!item) return <Empty title="Entrée introuvable" />
    return (
      <>
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link to="/journal" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700"><ArrowLeft size={15} /> Toutes mes entrées</Link>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">MindLog / Journal personnel</span>
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <article className="min-w-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_18px_60px_-35px_rgba(15,23,42,0.32)]">
              <header className="relative isolate overflow-hidden bg-[#18172f] px-7 pb-10 pt-9 text-white md:px-11 md:pb-12 md:pt-11">
                <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-violet-500/25 blur-3xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
                <div className="relative flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-violet-100"><span className="size-2 rounded-full" style={{backgroundColor: moodColors[item.mood] || '#a78bfa'}} />{item.mood}</span>
                  {item.draft && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200">Brouillon</span>}
                  <span className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-slate-300"><CalendarDays size={14} />{item.date}</span>
                </div>
                <p className="relative mt-9 text-[11px] font-bold uppercase tracking-[0.28em] text-violet-300">Une page de mon histoire</p>
                <h1 className="relative mt-3 max-w-2xl break-words text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{item.title}</h1>
                {(item.tags || []).length > 0 && <div className="relative mt-6 flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200">#{tag}</span>)}</div>}
              </header>
              <div className="px-7 py-9 md:px-11 md:py-11">
                <div className="mb-6 flex items-center gap-3"><span className="h-px w-9 bg-violet-400"/><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600">Mon récit</span></div>
                <div className="whitespace-pre-wrap break-words text-[19px] leading-[1.95] text-slate-700 md:text-[21px]">
                  {item.content || <span className="italic text-slate-400">Cette entrée ne contient pas encore de texte.</span>}
                </div>
                {(item.images || []).length > 0 && <section className="mt-9 border-t border-slate-100 pt-7">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Souvenirs associés</h2><p className="mt-1 text-xs text-slate-500">Photos et vidéos de cette journée</p></div><button type="button" onClick={() => setAssistantTab('photo')} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"><Sparkles size={14}/> Analyser avec l'IA</button></div>
                  <JournalPhotos ids={item.images || []} />
                </section>}
                <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
                  <span className="text-xs text-slate-400">Un espace pour garder ce qui compte.</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => togglePinned(item)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"><Pin size={16} className={item.pinned ? "fill-violet-600 text-violet-600" : ""}/>{item.pinned ? "Désépingler" : "Épingler"}</button>
                    <button type="button" disabled={exportBusy} onClick={() => exportJournalPdf(item)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"><Download size={16}/>{exportBusy ? "Export en cours..." : "Télécharger le PDF"}</button>
                    <Link to={`/journal/${item.id}/edit`}><Button variant="secondary"><Edit3 size={15}/> Modifier</Button></Link>
                    <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 size={15}/> Supprimer</Button>
                  </div>
                </footer>
                {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              </div>
            </article>
            <aside className="min-w-0 space-y-5 xl:sticky xl:top-6">
              <section className="overflow-hidden rounded-[28px] border border-violet-200/70 bg-white shadow-[0_15px_45px_-28px_rgba(109,40,217,0.35)]">
                <div className="bg-gradient-to-br from-violet-100 via-white to-fuchsia-50 px-6 pb-5 pt-6">
                  <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20"><Sparkles size={22}/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Votre compagnon d'écriture</p><h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">MindLog AI</h2></div></div>
                  <p className="mt-4 text-base leading-7 text-slate-600">Explorez vos pensées et vos souvenirs grâce à une analyse intelligente, à votre rythme.</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Fonctions de l'assistant IA">
                    <button type="button" role="tab" aria-selected={assistantTab === 'text'} onClick={() => setAssistantTab('text')} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3.5 text-sm font-bold transition ${assistantTab === 'text' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Edit3 size={14}/> Mon texte</button>
                    <button type="button" role="tab" aria-selected={assistantTab === 'photo'} onClick={() => setAssistantTab('photo')} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3.5 text-sm font-bold transition ${assistantTab === 'photo' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><ImageIcon size={14}/> Mes photos</button>
                  </div>
                  {assistantTab === 'text' ? <div className="mt-5 space-y-4" role="tabpanel">
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><p className="text-lg font-bold text-slate-900">Comprendre mes émotions</p><p className="mt-2 text-base leading-7 text-slate-600">Découvrez les émotions, les thèmes et une question pour réfléchir à votre récit.</p></div>
                    <Button variant="ai" className="w-full" disabled={aiLoading || !item.content?.trim()} onClick={analyzeJournal}><Sparkles size={16}/>{aiLoading ? 'Analyse en cours...' : aiAnalysis ? "Relancer l'analyse" : 'Lancer mon analyse'}</Button>
                    {aiLoading && <p role="status" className="text-xs text-violet-700">Llama 3.2 analyse votre texte...</p>}
                    {aiError && <p role="alert" className="text-sm text-red-600">{aiError}</p>}
                    {aiAnalysis && !aiLoading && <div className="max-h-[620px] space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-base leading-8">
                      <div><p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Émotion dominante</p><p className="mt-1 text-xl font-extrabold text-slate-900">{aiAnalysis.primary_emotion}</p></div>
                      <div><p className="text-xs font-bold text-slate-700">Émotions secondaires</p><div className="mt-2 flex flex-wrap gap-1">{(aiAnalysis.secondary_emotions || []).length ? aiAnalysis.secondary_emotions.map((emotion,index)=><Badge key={`${emotion}-${index}`} className="bg-white text-violet-800">{emotion}</Badge>):<span className="text-slate-500">Aucune identifiée</span>}</div></div>
                      <div><p className="text-xs font-bold text-slate-700">Résumé</p><p className="mt-1 text-slate-600">{aiAnalysis.summary}</p></div>
                      <div><p className="text-xs font-bold text-slate-700">Observation</p><p className="mt-1 text-slate-600">{aiAnalysis.insight}</p></div>
                      <div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-violet-700">Pour aller plus loin</p><p className="mt-1 text-slate-700">{aiAnalysis.reflection_question}</p></div>
                    </div>}
                  </div> : <div className="mt-4" role="tabpanel"><JournalVisionPanel images={item.images || []} busyId={photoBusyId} error={photoError} result={photoAnalysis} onAnalyze={analyzePhoto}/></div>}
                  <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">Analyse locale avec Llama 3.2. Les résultats sont des suggestions, pas un diagnostic.</p>
                </div>
              </section>
            </aside>
          </div>
        </div>
        <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title="Supprimer cette entrée?" actions={<>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Annuler</Button>
          <Button variant="danger" disabled={busy} onClick={removeEntry}>{busy ? "Suppression..." : "Confirmer"}</Button>
        </>}>
          Cette action supprimera définitivement « {item.title} » de votre journal.
        </Modal>
      </>
    )
  }

  return (
    <>
      <div className="mb-7 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-violet-50/70 to-indigo-50/70 p-7 shadow-sm md:p-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-violet-700"><Sparkles size={13} /> Votre espace personnel</div><h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Mon journal<span className="text-violet-600">.</span></h1><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Un espace calme pour raconter vos journées, suivre vos émotions et retrouver vos souvenirs.</p></div>
          <Link to="/journal/new"><Button><Plus size={17} /> Nouvelle entrée</Button></Link>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="ai" onClick={() => setShowChat((v) => !v)}>
          <MessageCircle size={16} /> {showChat ? "Fermer le chat IA" : "Discuter avec mon journal"}
        </Button>
        <Button variant="secondary" onClick={() => setShowAnalytics((value) => !value)}>
          {showAnalytics ? "Masquer les statistiques" : "Voir les statistiques du journal"}
        </Button>
        {showAnalytics && <Button variant="secondary" onClick={() => setAnalyticsRevision((n) => n + 1)}>
          Actualiser les statistiques
        </Button>}
      </div>
      {showChat && <Card className="mb-6 space-y-4 rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
        <SectionTitle title="Ask My Journal — Chat IA" subtitle="Posez des questions sur vos entrées enregistrées." />
        <div className="max-h-96 space-y-4 overflow-y-auto" aria-live="polite">
          {chatMessages.length === 0 && <p className="text-sm text-slate-500">Exemple : Qu’est-ce qui m’a rendu heureux récemment ?</p>}
          {chatMessages.map((msg, index) => <div key={index} className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <p><strong>Vous :</strong> {msg.question}</p>
            <p className="whitespace-pre-wrap"><strong>Assistant :</strong> {msg.answer}</p>
            {msg.sources.length > 0 && <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500">Entrées consultées :</span>
              {msg.sources.map((src) => <Link key={src.id} to={`/journal/${src.id}`} className="text-xs font-semibold text-violet-600 underline">{src.title} ({src.date})</Link>)}
            </div>}
          </div>)}
        </div>
        <Textarea label="Votre question" rows={2} value={chatQuestion} onChange={(e) => setChatQuestion(e.target.value)} />
        {chatError && <p role="alert" className="text-sm text-red-600">{chatError}</p>}
        <Button variant="ai" disabled={chatBusy || !chatQuestion.trim()} onClick={askJournal}>
          <Sparkles size={16} /> {chatBusy ? "Recherche en cours..." : "Envoyer"}
        </Button>
        <p className="text-xs text-slate-500">Les réponses sont générées par l’IA et peuvent comporter des erreurs. Les sources affichées sont les entrées consultées, pas des citations vérifiées.</p>
      </Card>}
      {showAnalytics && (
        <div className="mb-6 space-y-5">
          {analyticsLoading && <p className="text-sm text-slate-500">Chargement des statistiques...</p>}
          {analyticsError && <p role="alert" className="text-sm text-red-600">{analyticsError}</p>}
          {analytics && !analyticsLoading && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Total des entrées" value={analytics.total_entries} icon={CalendarDays} />
                <Stat label="Série d'écriture (jours)" value={analytics.current_streak} icon={Flame} />
                <Stat label="Mots écrits" value={analytics.total_words} icon={Edit3} />
                <Stat label="Ce mois-ci" value={analytics.entries_this_month} icon={CalendarDays} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Publiées" value={analytics.published_entries} />
                <Stat label="Brouillons" value={analytics.draft_entries} />
                <Stat label="Favoris" value={analytics.favorite_entries} />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="p-5">
                  <SectionTitle title="Activité des 30 derniers jours" />
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.daily_activity || []}>
                        <XAxis dataKey="date" tickFormatter={(date) => date.slice(5)} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="entries" name="Entrées" fill="#6c63ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle title="Répartition des humeurs" />
                  {(analytics.mood_distribution || []).length ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.mood_distribution} dataKey="count" nameKey="mood" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                            {analytics.mood_distribution.map((entry, index) => (
                              <Cell key={entry.mood} fill={moodColors[entry.mood] || Object.values(moodColors)[index % Object.keys(moodColors).length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <p className="text-sm text-slate-500">Aucune humeur enregistrée.</p>}
                </Card>
              </div>
              <Card className="p-5">
                <SectionTitle title="Activité mensuelle" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.monthly_activity || []}>
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="entries" name="Entrées" fill="#22d3ee" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <p className="text-xs text-slate-500">Statistiques calculées depuis vos entrées enregistrées. La série utilise la date de l'entrée.</p>
            </>
          )}
        </div>
      )}
      <Card className="mb-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input value={q} onChange={(e) => { setQ(e.target.value); resetPage() }}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:ring-4 focus:ring-violet-100"
            placeholder="Recherche dynamique : titre, contenu, tags..." aria-label="Rechercher" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={sort} onChange={(e) => { setSort(e.target.value); resetPage() }}>
            <option value="-date">Plus récent</option>
            <option value="date">Plus ancien</option>
            <option value="title">Titre A–Z</option>
            <option value="-title">Titre Z–A</option>
          </Select>
          <Select value={mood} onChange={(e) => { setMood(e.target.value); resetPage() }}>
            <option value="">Toutes les humeurs</option>
            {Object.keys(moodColors).map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); resetPage() }}>
            <option value="all">Toutes les entrées</option>
            <option value="favorite">Favoris</option>
            <option value="pinned">Épinglées</option>
            <option value="draft">Brouillons</option>
            <option value="published">Publiées</option>
          </Select>
          <Button variant="secondary" onClick={() => {
            setQ(""); setDebouncedQ(""); setSort("-date"); setMood(""); setStatus("all");
            setDateFrom(""); setDateTo(""); setPage(1)
          }}>Réinitialiser les filtres</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Date de début" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage() }} />
          <Input label="Date de fin" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage() }} />
        </div>
      </Card>
      {listError && <p className="mb-4 text-sm text-red-600" role="alert">{listError}</p>}
      <p className="mb-4 text-sm font-medium text-slate-500">{count} entrée(s) trouvée(s) {listLoading ? "· Recherche en cours..." : ""}</p>
      {listLoading ? <p>Chargement du journal...</p> : results.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((x) => <Card key={x.id} className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg">
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Badge className="bg-violet-50 text-violet-700"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: moodColors[x.mood] || "#8b5cf6" }} />{x.mood}</Badge>
                {x.draft && <Badge>Brouillon</Badge>}
                {x.pinned && <Badge>Épinglée</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" aria-label={x.pinned ? "Désépingler" : "Épingler"} onClick={() => togglePinned(x)}><Pin size={18} className={x.pinned ? "fill-violet-600 text-violet-600" : "text-slate-300"}/></button>
                <button type="button" aria-label={x.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => toggleFavorite(x)}><Heart size={18} className={x.favorite ? "fill-rose-500 text-rose-500" : "text-slate-300"}/></button>
              </div>
            </div>
            <Link to={`/journal/${x.id}`}>
              <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900 transition group-hover:text-violet-600">{x.title}</h2>
              <p className="mt-3 line-clamp-3 min-h-18 text-sm leading-6 text-slate-500">{x.content}</p>
            </Link>
            <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <CalendarDays size={14} />{x.date}
              <div className="ml-auto flex gap-1">{(x.tags || []).slice(0, 2).map((t) => <span key={t}>#{t}</span>)}</div>
            </div>
          </Card>)}
        </div>
      ) : <Empty title="Aucune entrée trouvée" />}
      {count > pageSize && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1 || listLoading} onClick={() => setPage((n) => n - 1)}>Précédent</Button>
          <span className="text-sm text-slate-600">Page {page} / {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages || listLoading} onClick={() => setPage((n) => n + 1)}>Suivant</Button>
        </div>
      )}
    </>
  )
}

function localDateInput(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function toApiDateTime(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number)
  const now = new Date()
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), 0, 0).toISOString()
}

function formatMoodDate(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
}

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—"
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/5`
}

function moodQuery(period, moodType, dateFrom, dateTo) {
  const params = {}
  if (moodType) params.mood = moodType
  if (period && period !== "all" && period !== "custom") params.period = period
  if (period === "custom") {
    params.period = "custom"
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
  }
  return params
}

function listItems(response) {
  if (Array.isArray(response)) return { items: response, count: response.length }
  return { items: response?.results || [], count: response?.count || 0 }
}

function MoodFilters({ moodType, setMoodType, period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select label="Humeur" value={moodType} onChange={(e) => setMoodType(e.target.value)}>
        <option value="">Toutes les humeurs</option>
        {Object.keys(moodColors).map((x) => <option key={x} value={x}>{x}</option>)}
      </Select>
      <Select label="Période" value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="all">Toutes les dates</option>
        <option value="today">Aujourd’hui</option>
        <option value="week">Cette semaine</option>
        <option value="month">Ce mois</option>
        <option value="custom">Période personnalisée</option>
      </Select>
      {period === "custom" && (
        <>
          <Input label="Du" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="Au" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </>
      )}
    </div>
  )
}

function MoodForm({ initial, busy, error, title, subtitle, submitLabel, onSubmit }) {
  const [form, setForm] = useState(initial)
  const [localError, setLocalError] = useState("")
  const submit = (e) => {
    e.preventDefault()
    setLocalError("")
    if (form.date > localDateInput()) {
      setLocalError("La date ne peut pas être dans le futur.")
      return
    }
    onSubmit({
      mood: form.mood,
      intensity: Number(form.intensity),
      note: form.note.trim(),
      date: toApiDateTime(form.date),
    })
  }
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mx-auto max-w-3xl p-6">
        <form onSubmit={submit}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {Object.keys(moodColors).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setForm({ ...form, mood: x })}
                className={`rounded-2xl border p-4 text-center text-sm font-bold ${
                  form.mood === x
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-200"
                }`}
              >
                <Smile className="mx-auto mb-2" style={{ color: moodColors[x] }} />
                {x}
              </button>
            ))}
          </div>
          <div className="mt-7">
            <label className="text-sm font-bold">Intensité : {form.intensity}/5</label>
            <input
              type="range"
              min="1"
              max="5"
              value={form.intensity}
              onChange={(e) => setForm({ ...form, intensity: +e.target.value })}
              className="mt-3 w-full accent-violet-600"
            />
          </div>
          <Textarea
            label="Une note (facultatif)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <Input
            className="mt-4"
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          {(localError || error) && (
            <p className="mt-4 text-sm text-red-600" role="alert">{localError || error}</p>
          )}
          <Button className="mt-6" disabled={busy}>
            {busy ? "Enregistrement..." : submitLabel}
          </Button>
        </form>
      </Card>
    </>
  )
}

function MoodDeleteModal({ item, busy, onClose, onConfirm }) {
  return (
    <Modal
      open={Boolean(item)}
      onClose={() => !busy && onClose()}
      title="Supprimer cette humeur ?"
      actions={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Annuler</Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Suppression..." : "Confirmer"}
          </Button>
        </>
      }
    >
      {item
        ? `Cette action supprimera définitivement « ${item.mood} » du ${formatMoodDate(item.date)}.`
        : null}
    </Modal>
  )
}

export function MoodPage({ mode = "dashboard" }) {
  const { notify } = useStore()
  const nav = useNavigate()
  const { id } = useParams()
  const [moodType, setMoodType] = useState("")
  const [period, setPeriod] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState("")
  const [stats, setStats] = useState(null)
  const [monthStats, setMonthStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState("")
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [summaryDays, setSummaryDays] = useState(7)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState("")
  const filters = useMemo(
    () => moodQuery(period, moodType, dateFrom, dateTo),
    [period, moodType, dateFrom, dateTo],
  )
  const recentRange = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 13)
    return { date_from: localDateInput(start), date_to: localDateInput(end) }
  }, [])

  useEffect(() => {
    if (mode !== "history") return
    let active = true
    setListLoading(true)
    setListError("")
    moodService.getMoods({ ...filters, page_size: 100, ordering: "-date" })
      .then((response) => {
        if (!active) return
        const parsed = listItems(response)
        setItems(parsed.items)
        setTotal(parsed.count)
      })
      .catch((err) => { if (active) setListError(err.message || "Impossible de charger l’historique.") })
      .finally(() => { if (active) setListLoading(false) })
    return () => { active = false }
  }, [mode, filters, revision])

  useEffect(() => {
    if (mode !== "dashboard" && mode !== "insights") return
    let active = true
    setStatsLoading(true)
    setStatsError("")
    const request = mode === "insights"
      ? moodService.getStats(filters).then((data) => ({ stats: data, month: null }))
      : Promise.all([
          moodService.getStats(recentRange),
          moodService.getStats({ period: "month" }),
        ]).then(([recent, month]) => ({ stats: recent, month }))
    request
      .then((data) => {
        if (!active) return
        setStats(data.stats)
        setMonthStats(data.month)
      })
      .catch((err) => { if (active) setStatsError(err.message || "Impossible de charger les tendances.") })
      .finally(() => { if (active) setStatsLoading(false) })
    return () => { active = false }
  }, [mode, filters, recentRange, revision])

  useEffect(() => {
    if ((mode !== "detail" && mode !== "edit") || !id) return
    let active = true
    setDetail(null)
    setDetailLoading(true)
    setError("")
    moodService.getMood(id)
      .then((entry) => { if (active) setDetail(entry) })
      .catch((err) => { if (active) setError(err.message || "Humeur introuvable.") })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [id, mode])

  const save = async (payload) => {
    setBusy(true)
    setError("")
    try {
      if (mode === "edit" && detail) {
        await moodService.updateMood(detail.id, payload)
        notify("Humeur modifiée")
        nav(`/mood/${detail.id}`)
      } else {
        await moodService.createMood(payload)
        notify("Humeur enregistrée")
        nav("/mood")
      }
    } catch (err) {
      setError(err.message || "Enregistrement impossible.")
    } finally {
      setBusy(false)
    }
  }

  const generateSummary = async () => {
    setSummaryLoading(true)
    setSummaryError("")
    setSummary(null)
    try {
      setSummary(await moodService.summarizeMoods(summaryDays))
    } catch (err) {
      setSummaryError(err.message || "Impossible de générer la synthèse.")
    } finally {
      setSummaryLoading(false)
    }
  }

  const remove = async () => {
    if (!confirm || busy) return
    setBusy(true)
    try {
      await moodService.deleteMood(confirm.id)
      notify("Humeur supprimée")
      setConfirm(null)
      if (mode === "detail") nav("/mood/history")
      else setRevision((value) => value + 1)
    } catch (err) {
      notify(err.message || "Échec de la suppression", "error")
    } finally {
      setBusy(false)
    }
  }

  if (mode === "new") {
    return (
      <MoodForm
        initial={{ mood: "Calme", intensity: 3, note: "", date: localDateInput() }}
        busy={busy}
        error={error}
        title="Comment vous sentez-vous ?"
        subtitle="Il n’y a pas de bonne ou de mauvaise réponse."
        submitLabel="Enregistrer mon humeur"
        onSubmit={save}
      />
    )
  }

  if (mode === "edit") {
    if (detailLoading) return <Loading label="Chargement de l’humeur..." />
    if (error) return <p role="alert" className="text-red-600">{error}</p>
    if (!detail) return <Empty title="Humeur introuvable" text="Cet enregistrement n’existe pas ou ne vous appartient pas." />
    return (
      <MoodForm
        key={detail.id}
        initial={{
          mood: detail.mood,
          intensity: detail.intensity,
          note: detail.note || "",
          date: localDateInput(detail.date),
        }}
        busy={busy}
        error={error}
        title="Modifier cette humeur"
        subtitle="Ajustez l’émotion, l’intensité ou la note."
        submitLabel="Enregistrer les modifications"
        onSubmit={save}
      />
    )
  }

  if (mode === "detail") {
    if (detailLoading) return <Loading label="Chargement de l’humeur..." />
    if (error && !detail) return <p role="alert" className="text-red-600">{error}</p>
    if (!detail) return <Empty title="Humeur introuvable" text="Cet enregistrement n’existe pas ou ne vous appartient pas." />
    return (
      <>
        <Card className="mx-auto max-w-xl p-8 text-center">
          <Smile className="mx-auto" size={50} style={{ color: moodColors[detail.mood] || "#6c63ff" }} />
          <h1 className="mt-4 text-3xl font-extrabold">{detail.mood}</h1>
          <p className="mt-2 text-slate-500">{formatMoodDate(detail.date)} · Intensité {detail.intensity}/5</p>
          <p className="mt-6 rounded-xl bg-slate-50 p-4">{detail.note || "Aucune note."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to={`/mood/${detail.id}/edit`}><Button variant="secondary"><Edit3 size={16} /> Modifier</Button></Link>
            <Button variant="danger" onClick={() => setConfirm(detail)}><Trash2 size={16} /> Supprimer</Button>
            <Link to="/mood/history" className="inline-flex items-center font-bold text-violet-600">Retour à l’historique</Link>
          </div>
        </Card>
        <MoodDeleteModal item={confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={remove} />
      </>
    )
  }

  const chart = (stats?.intensity_over_time || []).map((point) => ({
    day: new Date(point.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: point.intensity,
    mood: point.mood,
  }))
  const distribution = stats?.distribution || []

  if (mode === "insights") {
    const observations = []
    if (stats && stats.count === 0) {
      observations.push("Aucune humeur ne correspond à cette période.")
    } else if (stats) {
      observations.push(`Vous avez enregistré ${stats.count} humeur${stats.count > 1 ? "s" : ""} sur cette période.`)
      if (stats.average_intensity !== null) {
        observations.push(`L’intensité moyenne est de ${formatAverage(stats.average_intensity)}.`)
      }
      if (distribution[0]) {
        observations.push(`L’humeur la plus fréquente est « ${distribution[0].mood} » (${distribution[0].count}).`)
      }
    }
    return (
      <>
        <PageHeader
          title="Tendances de vos émotions"
          subtitle="Des observations informatives sur les données que vous avez enregistrées."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Ces tendances sont informatives et ne constituent ni un avis médical ni un diagnostic psychologique.
        </div>
        <div className="mt-5">
          <MoodFilters
            moodType={moodType} setMoodType={setMoodType}
            period={period} setPeriod={setPeriod}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
          />
        </div>
        {statsLoading && <Loading label="Chargement des tendances..." />}
        {statsError && <p role="alert" className="mb-4 text-sm text-red-600">{statsError}</p>}
        {!statsLoading && !statsError && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle title="Humeurs fréquentes" />
              {distribution.length ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={distribution} dataKey="count" nameKey="mood" innerRadius={55} outerRadius={85}>
                        {distribution.map((entry) => (
                          <Cell key={entry.mood} fill={moodColors[entry.mood] || "#6c63ff"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-500">Aucune humeur enregistrée.</p>}
            </Card>
            <Card className="p-5">
              <SectionTitle title="Évolution de l’intensité" />
              {chart.length ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={chart}>
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Area dataKey="value" stroke="#6C63FF" fill="#ede9fe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-500">Aucune intensité à afficher.</p>}
            </Card>
            <Card className="p-5 lg:col-span-2">
              <SectionTitle
                title="Synthèse descriptive"
                subtitle="Les chiffres sont calculés par l’application. Le texte n’apparaît que s’il a été rédigé par le modèle local."
              />
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <Select
                  label="Période"
                  value={String(summaryDays)}
                  onChange={(e) => {
                    setSummaryDays(Number(e.target.value))
                    setSummary(null)
                    setSummaryError("")
                  }}
                >
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </Select>
                <Button variant="ai" disabled={summaryLoading} onClick={generateSummary}>
                  <Sparkles size={16} /> {summaryLoading ? "Rédaction..." : "Générer la synthèse"}
                </Button>
              </div>
              {summaryLoading && <Loading label="Le modèle local rédige la synthèse..." />}
              {summaryError && <p role="alert" className="text-sm text-red-600">{summaryError}</p>}
              {summary && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-extrabold text-slate-950">Statistiques calculées</p>
                    <p className="mt-2">{summary.statistics.count} enregistrement{summary.statistics.count > 1 ? "s" : ""} · intensité moyenne {formatAverage(summary.statistics.average_intensity)}</p>
                    <p className="mt-1">
                      {summary.statistics.most_frequent?.length
                        ? `Humeurs les plus fréquentes : ${summary.statistics.most_frequent.map((item) => `${item.mood} (${item.count})`).join(", ")}.`
                        : "Aucune humeur sur cette période."}
                    </p>
                    {summary.statistics.variation ? (
                      <p className="mt-1">
                        Intensité moyenne : {summary.statistics.variation.first_average}/5 le {summary.statistics.variation.first_day}, puis {summary.statistics.variation.last_average}/5 le {summary.statistics.variation.last_day}.
                      </p>
                    ) : (
                      <p className="mt-1">Pas assez de jours différents pour décrire une évolution.</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-950">
                    <p className="font-extrabold">Texte du modèle</p>
                    {summary.summary_status === "generated" && summary.summary ? (
                      <p className="mt-2 leading-6">{summary.summary}</p>
                    ) : (
                      <p className="mt-2 leading-6">{summary.message || "Aucune synthèse n’a été rédigée."}</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
            <Card className="p-5 lg:col-span-2">
              <SectionTitle title="Observations" />
              <ul className="space-y-3 text-sm text-slate-600">
                {observations.map((line) => (
                  <li key={line} className="rounded-xl bg-slate-50 p-4">{line}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </>
    )
  }

  if (mode === "history") {
    return (
      <>
        <PageHeader
          title="Historique des humeurs"
          actions={
            <Link to="/mood/new">
              <Button><Plus /> Nouveau check-in</Button>
            </Link>
          }
        />
        <MoodFilters
          moodType={moodType} setMoodType={setMoodType}
          period={period} setPeriod={setPeriod}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
        />
        {listLoading && <Loading label="Chargement de l’historique..." />}
        {listError && <p role="alert" className="mb-4 text-sm text-red-600">{listError}</p>}
        {!listLoading && !listError && items.length === 0 && (
          <Empty
            title="Aucune humeur"
            text="Aucun enregistrement ne correspond à ces filtres."
            action={<Link to="/mood/new"><Button><Plus /> Enregistrer mon humeur</Button></Link>}
          />
        )}
        <div className="space-y-3">
          {items.map((entry) => (
            <Card key={entry.id} className="flex items-center gap-4 p-4">
              <Smile style={{ color: moodColors[entry.mood] || "#6c63ff" }} />
              <Link to={`/mood/${entry.id}`} className="flex-1">
                <b>{entry.mood}</b>
                <p className="text-sm text-slate-500">{entry.note || "Aucune note."}</p>
              </Link>
              <Badge>{entry.intensity}/5</Badge>
              <span className="text-xs text-slate-400">{formatMoodDate(entry.date)}</span>
              <Link to={`/mood/${entry.id}/edit`} aria-label="Modifier"><Edit3 size={17} className="text-slate-400" /></Link>
              <button type="button" onClick={() => setConfirm(entry)} aria-label="Supprimer">
                <Trash2 size={17} className="text-slate-400" />
              </button>
            </Card>
          ))}
        </div>
        {!listLoading && total > items.length && (
          <p className="mt-4 text-sm text-slate-500">Affichage des {items.length} humeurs les plus récentes sur {total}.</p>
        )}
        <MoodDeleteModal item={confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={remove} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Mon humeur"
        subtitle="Observez vos émotions avec douceur, sans jugement."
        actions={
          <>
            <Link to="/mood/history"><Button variant="secondary">Historique</Button></Link>
            <Link to="/mood/insights"><Button variant="secondary">Insights</Button></Link>
            <Link to="/mood/new"><Button><Plus /> Enregistrer</Button></Link>
          </>
        }
      />
      {statsLoading && <Loading label="Chargement de vos humeurs..." />}
      {statsError && <p role="alert" className="mb-4 text-sm text-red-600">{statsError}</p>}
      {!statsLoading && !statsError && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Humeur actuelle" value={stats?.latest?.mood || "—"} icon={Smile} />
            <Stat label="Moyenne mensuelle" value={formatAverage(monthStats?.average_intensity)} icon={Heart} />
            <Stat label="Check-ins" value={monthStats?.count ?? 0} icon={CalendarDays} />
          </div>
          <Card className="mt-5 p-5">
            <SectionTitle title="Les 14 derniers jours" />
            {chart.length ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={chart}>
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Area dataKey="value" stroke="#6C63FF" fill="#ede9fe" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty
                title="Pas encore d’humeur"
                text="Vos prochains enregistrements apparaîtront ici."
                action={<Link to="/mood/new"><Button><Plus /> Enregistrer mon humeur</Button></Link>}
              />
            )}
          </Card>
        </>
      )}
    </>
  )
}

export function MediaPage({ mode = "library" }) {
  const { media, setMedia, notify, uploadMedia } = useStore(),
    nav = useNavigate(),
    { id } = useParams()
  const [q, setQ] = useState(""),
    [progress, setProgress] = useState(0),
    [isUploading, setIsUploading] = useState(false),
    [prompt, setPrompt] = useState(
      "Une plage tunisienne paisible au coucher du soleil",
    ),
    [generated, setGenerated] = useState(false)
  if (mode === "upload")
    return (
      <>
        <PageHeader
          title="Ajouter un média"
          subtitle="Les médias sont enregistrés et disponibles dans votre bibliothèque."
        />
        <Card className="mx-auto max-w-3xl p-6">
          <label className="grid min-h-52 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center hover:border-violet-400">
            <div>
              <Upload className="mx-auto mb-3 text-violet-600" />
              <b>Déposez vos fichiers ou cliquez pour parcourir</b>
              <p className="mt-1 text-sm text-slate-500">
                Images, audio, vidéo ou documents
              </p>
            </div>
            <input
              type="file"
              className="hidden"
              id="file-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  document.querySelector("#media-title").value = file.name
                    .replace(/\.[^/.]+$/, "")
                }
              }}
            />
          </label>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Titre" id="media-title" placeholder="Nom du média" />
            <Select id="media-type" label="Type">
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Vidéo</option>
              <option value="document">Document</option>
            </Select>
            <Textarea id="media-description" label="Description" className="sm:col-span-2" />
          </div>
          {progress > 0 && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Téléversement : {progress}%
              </p>
            </div>
          )}
          <Button
            className="mt-5"
            onClick={async () => {
              const fileInput = document.querySelector("#file-input")
              const file = fileInput?.files?.[0]
              
              if (!file) {
                notify("Sélectionnez un fichier", "error")
                return
              }
              
              const title = document.querySelector("#media-title").value || file.name
              const mediaType = document.querySelector("#media-type").value
              const description = document.querySelector("#media-description").value
              
              try {
                setIsUploading(true)
                setProgress(0)
                
                const uploadedMedia = await uploadMedia(
                  file,
                  title,
                  mediaType,
                  description
                )
                
                setProgress(100)
                notify("Média enregistré avec succès")
                
                setTimeout(() => {
                  nav("/media")
                  setProgress(0)
                  setIsUploading(false)
                }, 500)
              } catch (error) {
                setProgress(0)
                setIsUploading(false)
                notify(error.message || "Erreur lors du téléversement", "error")
              }
            }}
            disabled={isUploading}
          >
            Enregistrer
          </Button>
        </Card>
      </>
    )
  if (mode === "ai")
    return (
      <>
        <PageHeader
          title="Générateur d’image IA"
          subtitle="Atelier de simulation — aucun service de génération externe n’est connecté."
        />
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="p-5">
            <Textarea
              label="Décrivez votre image"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <Select className="mt-4" label="Style">
              <option>Photographie douce</option>
              <option>Illustration éditoriale</option>
              <option>Aquarelle</option>
            </Select>
            <Select className="mt-4" label="Format">
              <option>Paysage 16:9</option>
              <option>Carré 1:1</option>
              <option>Portrait 4:5</option>
            </Select>
            <Button
              className="mt-5 w-full"
              onClick={() => setTimeout(() => setGenerated(true), 700)}
            >
              <Sparkles /> Générer une simulation
            </Button>
          </Card>
          <Card className="grid min-h-96 place-items-center overflow-hidden">
            {generated ? (
              <div className="w-full">
                <img
                  src={media.find((x) => x.url)?.url}
                  className="h-96 w-full object-cover"
                  alt="Résultat simulé"
                />
                <div className="flex justify-between p-4">
                  <span className="text-sm text-slate-500">
                    Résultat de démonstration
                  </span>
                  <Button
                    onClick={() => notify("Résultat ajouté à la bibliothèque")}
                  >
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="mx-auto mb-3" size={40} />
                <p>Votre résultat simulé apparaîtra ici</p>
              </div>
            )}
          </Card>
        </div>
      </>
    )
  if (mode === "people")
    return (
      <>
        <PageHeader
          title="Personnes dans mes photos"
          subtitle="Groupes prédéfinis pour la démo — aucune reconnaissance faciale réelle n’est exécutée."
        />
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          La reconnaissance faciale nécessite un consentement explicite, une
          infrastructure sécurisée et des garanties de confidentialité adaptées.
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Lina", "Youssef", "Meriem", "Personnes non identifiées"].map(
            (x, i) => (
              <Card key={x} className="p-4">
                <img
                  src={media.filter((m) => m.url)[i]?.url || media[0].url}
                  className="aspect-square w-full rounded-xl object-cover"
                  alt="Groupe de photos"
                />
                <h2 className="mt-3 font-extrabold">{x}</h2>
                <p className="text-sm text-slate-500">
                  {3 + i} photos suggérées
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() =>
                      notify("Groupe ouvert en mode révision simulée")
                    }
                  >
                    Examiner
                  </Button>
                  {i < 3 && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        notify("Renommage enregistré pour la démonstration")
                      }
                    >
                      Renommer
                    </Button>
                  )}
                </div>
              </Card>
            ),
          )}
        </div>
      </>
    )
  if (mode === "transcription")
    return (
      <>
        <PageHeader
          title="Transcription audio"
          subtitle="Service simulé en attente de l’intégration backend."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <SectionTitle title="Enregistrement" />
            <Select label="Fichier audio">
              {media
                .filter((x) => x.type === "audio")
                .map((x) => (
                  <option key={x.id}>{x.title}</option>
                ))}
            </Select>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-950 p-4 text-white">
              <Button className="rounded-full! p-3!">
                <Play size={17} />
              </Button>
              <div className="h-1.5 flex-1 rounded bg-white/20">
                <div className="h-full w-1/3 bg-cyan-300" />
              </div>
              <span className="text-xs">0:34</span>
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <Textarea
              label="Transcription simulée"
              rows={12}
              defaultValue="Ce matin, j’ai réfléchi aux priorités de la semaine. Je veux terminer la présentation, prendre du temps pour lire et appeler ma famille."
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {["priorités", "présentation", "lecture", "famille"].map((x) => (
                <Badge key={x}>{x}</Badge>
              ))}
            </div>
            <Button
              className="mt-5"
              onClick={() => notify("Transcription enregistrée")}
            >
              <Save size={16} /> Enregistrer
            </Button>
          </Card>
        </div>
      </>
    )
  if (mode === "detail") {
    const x = media.find((m) => m.id === id)
    return x ? (
      <Card className="mx-auto max-w-4xl overflow-hidden">
        {x.url ? (
          <img
            src={x.url}
            className="max-h-32rem w-full object-cover"
            alt={x.title}
            onError={(e) => {
              // If image fails to load and URL is relative, try with absolute path
              if (x.url && x.url.startsWith('/')) {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                e.target.src = `${API_BASE_URL}${x.url}`
              }
            }}
          />
        ) : (
          <div className="grid h-72 place-items-center bg-slate-100">
            <Mic size={60} className="text-slate-300" />
          </div>
        )}
        <div className="p-6">
          <Badge>{x.type}</Badge>
          <h1 className="mt-3 text-2xl font-extrabold">{x.title}</h1>
          <p className="mt-2 text-slate-500">{x.description}</p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                notify("Édition des métadonnées ouverte en mode démo")
              }
            >
              Modifier les métadonnées
            </Button>
            {x.url && (
              <Button
                variant="secondary"
                onClick={() => window.open(x.url, "_blank", "noopener")}
              >
                <Download size={16} /> Télécharger
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                setMedia(media.filter((m) => m.id !== id))
                nav("/media")
              }}
            >
              Supprimer
            </Button>
          </div>
        </div>
      </Card>
    ) : (
      <Empty />
    )
  }
  const list = media.filter((x) =>
    x.title.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        title="Bibliothèque multimédia"
        subtitle="Photos, sons et fichiers qui racontent votre histoire."
        actions={
          <>
            <Link to="/media/ai-image">
              <Button variant="ai">
                <Sparkles /> Image IA
              </Button>
            </Link>
            <Link to="/media/upload">
              <Button>
                <Upload /> Ajouter
              </Button>
            </Link>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          className="min-w-64 flex-1"
          placeholder="Rechercher..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Link to="/media/people">
          <Button variant="secondary">
            <Users /> Personnes
          </Button>
        </Link>
        <Link to="/media/transcription">
          <Button variant="secondary">
            <Mic /> Transcription
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {list.map((x) => (
          <Link to={`/media/${x.id}`} key={x.id}>
            <Card className="overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
              {x.url ? (
                <img
                  src={x.url}
                  alt={x.title}
                  className="aspect-4/3 w-full object-cover"
                  onError={(e) => {
                    // If image fails to load and URL is relative, try with absolute path
                    if (x.url && x.url.startsWith('/')) {
                      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
                      e.target.src = `${API_BASE_URL}${x.url}`
                    }
                  }}
                />
              ) : (
                <div className="grid aspect-4/3 place-items-center bg-slate-100">
                  <Mic className="text-slate-400" />
                </div>
              )}
              <div className="p-4">
                <b className="line-clamp-1">{x.title}</b>
                <p className="mt-1 text-xs text-slate-400">
                  {x.type} · {x.date}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
export function GoalsPage({ mode = "goals" }) {
  const { goals, setGoals, habits, setHabits, notify } = useStore(),
    nav = useNavigate(),
    { id } = useParams()
  const item = goals.find((x) => x.id === id),
    [filter, setFilter] = useState("all")
  if (mode === "new" || mode === "edit") {
    const current = mode === "edit" ? item : null
    const submit = (e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget),
        data = {
          id: current?.id || crypto.randomUUID(),
          title: f.get("title"),
          description: f.get("description"),
          category: f.get("category"),
          startDate: f.get("startDate"),
          targetDate: f.get("targetDate"),
          status: f.get("status"),
          progress: +f.get("progress"),
        }
      setGoals(
        current
          ? goals.map((x) => (x.id === current.id ? data : x))
          : [data, ...goals],
      )
      notify("Objectif enregistré")
      nav(`/goals/${data.id}`)
    }
    return (
      <>
        <PageHeader
          title={current ? "Modifier l’objectif" : "Nouvel objectif"}
        />
        <Card className="mx-auto max-w-3xl p-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Input
              className="sm:col-span-2"
              label="Titre"
              name="title"
              defaultValue={current?.title}
              required
            />
            <Textarea
              label="Description"
              name="description"
              defaultValue={current?.description}
            />
            <Select
              label="Catégorie"
              name="category"
              defaultValue={current?.category}
            >
              <option>Études</option>
              <option>Personnel</option>
              <option>Santé</option>
              <option>Carrière</option>
            </Select>
            <Input
              label="Date de début"
              name="startDate"
              type="date"
              defaultValue={current?.startDate || "2026-02-18"}
            />
            <Input
              label="Date cible"
              name="targetDate"
              type="date"
              defaultValue={current?.targetDate}
            />
            <Select label="Statut" name="status" defaultValue={current?.status}>
              <option value="active">Actif</option>
              <option value="completed">Terminé</option>
              <option value="overdue">En retard</option>
            </Select>
            <Input
              label="Progression %"
              name="progress"
              type="number"
              min="0"
              max="100"
              defaultValue={current?.progress || 0}
            />
            <Button className="sm:col-span-2">Enregistrer</Button>
          </form>
        </Card>
      </>
    )
  }
  if (mode === "detail") {
    if (!item) return <Empty />
    return (
      <>
        <PageHeader
          title={item.title}
          subtitle={item.description}
          actions={
            <>
              <Link to={`/goals/${id}/edit`}>
                <Button variant="secondary">Modifier</Button>
              </Link>
              <Button
                onClick={() =>
                  setGoals(
                    goals.map((x) =>
                      x.id === id
                        ? { ...x, status: "completed", progress: 100 }
                        : x,
                    ),
                  )
                }
              >
                Marquer terminé
              </Button>
            </>
          }
        />
        <Card className="p-6">
          <Badge>{item.category}</Badge>
          <div className="mt-6 h-3 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-violet-600"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <b>{item.progress}% réalisé</b>
            <span className="text-slate-500">Échéance {item.targetDate}</span>
          </div>
          <SectionTitle
            title="Historique de progression"
            subtitle="Mises à jour simulées"
          />
          <div className="mt-4 space-y-3">
            {[20, 40, item.progress].map((x, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" />
                <span className="text-sm">Progression mise à jour à {x}%</span>
              </div>
            ))}
          </div>
        </Card>
      </>
    )
  }
  if (mode === "habits") {
    return (
      <>
        <PageHeader
          title="Mes habitudes"
          subtitle="De petites actions répétées, de grands changements."
          actions={
            <Button
              onClick={() => {
                const name = window.prompt("Nom de la nouvelle habitude")
                if (!name?.trim()) return
                setHabits([
                  {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    frequency: "Quotidien",
                    streak: 0,
                    rate: 0,
                    completed: false,
                    description: "Nouvelle habitude personnelle.",
                  },
                  ...habits,
                ])
                notify("Habitude ajoutée")
              }}
            >
              <Plus /> Ajouter une habitude
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {habits.map((h) => (
            <Card key={h.id} className="p-5">
              <div className="flex justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                  <Flame />
                </span>
                <button
                  onClick={() =>
                    setHabits(
                      habits.map((x) =>
                        x.id === h.id ? { ...x, completed: !x.completed } : x,
                      ),
                    )
                  }
                  className={`rounded-xl px-3 text-xs font-bold ${
                    h.completed
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {h.completed ? "Fait aujourd’hui" : "À faire"}
                </button>
              </div>
              <h2 className="mt-4 font-extrabold">{h.name}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {h.frequency} · Série de {h.streak} jours
              </p>
              <div className="mt-4 h-2 rounded bg-slate-100">
                <div
                  className="h-full rounded bg-amber-400"
                  style={{ width: `${h.rate}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {h.rate}% cette semaine
              </p>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <div
                    key={i}
                    className={`grid aspect-square place-items-center rounded-md text-[10px] font-bold ${
                      i < 5
                        ? "bg-violet-100 text-violet-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </>
    )
  }
  if (mode === "insights")
    return (
      <>
        <PageHeader
          title="Coach objectifs & habitudes"
          subtitle="Suggestions simulées basées sur vos données de démonstration."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            "Vous avez complété 78% de vos habitudes cette semaine.",
            "Votre objectif d’études progresse régulièrement.",
            "Planifier une session courte demain pourrait maintenir votre élan.",
          ].map((x, i) => (
            <Card key={x} className="p-6">
              <Sparkles className="text-cyan-500" />
              <Badge className="mt-5 bg-cyan-50 text-cyan-700">
                Suggestion, pas une prédiction
              </Badge>
              <p className="mt-3 font-semibold leading-6">{x}</p>
            </Card>
          ))}
        </div>
      </>
    )
  const list = goals.filter((x) => filter === "all" || x.status === filter)
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
                <Plus /> Nouvel objectif
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={goals.length} />
        <Stat
          label="Actifs"
          value={goals.filter((x) => x.status === "active").length}
        />
        <Stat
          label="Terminés"
          value={goals.filter((x) => x.status === "completed").length}
        />
        <Stat
          label="En retard"
          value={goals.filter((x) => x.status === "overdue").length}
        />
      </div>
      <div className="my-5 flex gap-2">
        {[
          ["all", "Tous"],
          ["active", "Actifs"],
          ["completed", "Terminés"],
          ["overdue", "En retard"],
        ].map(([v, l]) => (
          <Button
            key={v}
            variant={filter === v ? "primary" : "secondary"}
            onClick={() => setFilter(v)}
          >
            {l}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((x) => (
          <Link to={`/goals/${x.id}`} key={x.id}>
            <Card className="p-5 hover:border-violet-300">
              <div className="flex justify-between">
                <Badge>{x.category}</Badge>
                <Badge
                  className={
                    x.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : x.status === "overdue"
                        ? "bg-red-50 text-red-700"
                        : "bg-violet-50 text-violet-700"
                  }
                >
                  {x.status}
                </Badge>
              </div>
              <h2 className="mt-4 text-lg font-extrabold">{x.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{x.description}</p>
              <div className="mt-5 h-2 rounded bg-slate-100">
                <div
                  className="h-full rounded bg-violet-600"
                  style={{ width: `${x.progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-bold">
                {x.progress}% · avant le {x.targetDate}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
