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
  BookOpen,
  ChevronRight,
  SlidersHorizontal,
  ChevronDown,
  Clock3,
} from "lucide-react"
import {
  AreaChart,
  Area,
  CartesianGrid,
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
  const [selectedPhotoId, setSelectedPhotoId] = useState(null)
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
  const selectedPhoto = photos.find((p) => String(p.id) === String(selectedPhotoId)) || photos[0]
  const activePhotoId = selectedPhoto?.id
  return (
    <section className="mt-5 space-y-5" aria-label="Analyse visuelle du journal">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e4efff] text-blue-700"><Images size={21}/></span>
        <div><h3 className="text-lg font-semibold tracking-tight text-slate-900">Explorer mes photos</h3><p className="mt-1 text-sm leading-6 text-slate-500">Choisissez un souvenir à analyser. Votre journal reste inchangé.</p></div>
      </div>
      {loading && <p role="status" className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Chargement des photos...</p>}
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p>}
      {!loading && !loadError && photos.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucune image compatible attachée à cette entrée.</p>}
      {selectedPhoto && <>
        <div className="overflow-hidden rounded-[22px] border border-[#d8e7f8] bg-[#f8fbff]">
          <div className="flex h-56 items-center justify-center bg-[#edf5ff] sm:h-64">
            <img src={selectedPhoto.file_url || selectedPhoto.url || selectedPhoto.file} alt={selectedPhoto.title || 'Photo sélectionnée'} className="h-full w-full object-contain"/>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3"><p className="min-w-0 truncate text-sm font-semibold text-slate-800">{selectedPhoto.title || 'Mon souvenir'}</p><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500">{photos.length} photo{photos.length > 1 ? 's' : ''}</span></div>
        </div>
        {photos.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Sélectionner une photo">
          {photos.map((photo) => <button key={photo.id} type="button" onClick={() => setSelectedPhotoId(photo.id)} aria-label={`Choisir ${photo.title || 'cette photo'}`} aria-pressed={String(activePhotoId) === String(photo.id)} className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition hover:scale-[1.04] ${String(activePhotoId) === String(photo.id) ? 'border-blue-600 ring-2 ring-blue-100' : 'border-transparent hover:border-slate-300'}`}><img src={photo.file_url || photo.url || photo.file} alt="" className="size-full object-cover"/></button>)}
        </div>}
        <button type="button" disabled={Boolean(busyId)} onClick={() => onAnalyze(activePhotoId)} className="group flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#173c70] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_-14px_rgba(20,25,40,.7)] transition hover:-translate-y-0.5 hover:bg-[#23569a] disabled:cursor-wait disabled:opacity-60"><Sparkles size={17}/>{busyId ? 'Analyse en cours...' : 'Analyser cette photo'}{!busyId && <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>}</button>
      </>}
      {busyId && <div role="status" className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><span className="size-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700"/>Llama 3.2 Vision examine votre photo. Cela peut prendre un moment...</div>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {result && !busyId && <div className="space-y-4 rounded-[22px] border border-[#d8e8fc] bg-[#f6faff] p-5" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Sparkles size={16}/> Résultat de l'analyse</div>
        <div><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{result.description}</p></div>
        <div className="rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-blue-700">Suggestion d'écriture</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{result.journal_suggestion}</p></div>
        <p className="text-xs leading-5 text-slate-500">Suggestion générée par IA, à vérifier. Aucun changement automatique.</p>
      </div>}
    </section>
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
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
        <div className="w-full">
          <nav className="mb-7 flex flex-wrap items-center justify-between gap-4" aria-label="Navigation du journal">
            <Link to="/journal" className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"><span className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white transition group-hover:-translate-x-1"><ArrowLeft size={16}/></span> Retour à ma bibliothèque</Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">MON JOURNAL <span className="mx-2 text-slate-300">/</span> LECTURE</span>
          </nav>
          <div className="grid items-start gap-5 2xl:gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(390px,460px)]">
            <article className="min-w-0 overflow-hidden rounded-[26px] border border-[#dce7f5] bg-[#ffffff] shadow-[0_16px_55px_-40px_rgba(35,33,25,.32)]">
              <header className="relative overflow-hidden border-b border-[#e1ebf7] bg-[#edf5ff] px-6 pb-8 pt-8 md:px-9 md:pb-10 md:pt-10 xl:px-11">
                <div className="absolute right-0 top-0 h-full w-2 bg-[#4b9ce5]" aria-hidden="true"/>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4778ae]"><BookOpen size={15}/> Journal personnel</span>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={15}/>{item.date}</span>
                </div>
                <h1 className="mt-7 break-words font-serif text-[40px] font-medium leading-[1.12] tracking-[-0.045em] text-[#142b49] md:text-[54px] xl:text-[60px]">{item.title}</h1>
                <div className="mt-7 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#d6e5f7] bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700"><span className="size-2 rounded-full" style={{backgroundColor:moodColors[item.mood] || '#a78bfa'}}/>{item.mood || 'Sans humeur'}</span>
                  {item.draft && <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">Brouillon</span>}
                  {item.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-[#e1efff] px-3 py-1.5 text-xs font-semibold text-[#315d8d]"><Pin size={12}/> Épinglée</span>}
                  {(item.tags || []).map((tag) => <span key={tag} className="rounded-full border border-[#d6e5f7] px-3 py-1.5 text-xs text-slate-500">#{tag}</span>)}
                </div>
              </header>
              <div className="px-6 py-8 md:px-9 md:py-10 xl:px-11">
                <div className="mb-7 flex items-center gap-3"><span className="h-px w-10 bg-[#68a8ed]"/><span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#3674b5]">Le récit</span></div>
                <div className="whitespace-pre-wrap break-words font-serif text-[18px] leading-[1.9] text-[#314765] md:text-[20px]">
                  {item.content || <span className="italic text-slate-400">Cette entrée ne contient pas encore de texte.</span>}
                </div>
                {(item.images || []).length > 0 && <section className="mt-11 border-t border-[#e1ebf7] pt-9">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl font-medium text-[#152d4c]">Les images de ce jour</h2><p className="mt-1 text-xs text-slate-500">Les photos que vous avez choisies pour cette histoire</p></div><button type="button" onClick={() => setAssistantTab('photo')} title="Analyser les photos avec l’IA" aria-label="Analyser les photos avec l’IA" className="grid size-10 place-items-center rounded-xl border border-[#cfe1f7] bg-[#eef6ff] text-[#3575b9] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#dceeff]"><Sparkles size={18}/></button></div>
                  <JournalPhotos ids={item.images || []} />
                </section>}
                <footer className="mt-12 border-t border-[#e1ebf7] pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#648cb9]">Votre histoire, vos souvenirs</p>
                      <p className="mt-1 text-sm text-slate-500">Gardez cette page, partagez-la ou retrouvez-la plus tard.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-[#dce7f5] bg-white/90 p-1.5 shadow-[0_6px_20px_-14px_rgba(35,33,25,.28)]" role="group" aria-label="Actions sur cette entrée">
                      <button type="button" disabled={exportBusy} onClick={() => exportJournalPdf(item)} title="Télécharger le PDF" aria-label={exportBusy ? 'Export PDF en cours' : 'Télécharger le PDF'} className="group relative grid size-10 place-items-center rounded-xl bg-[#17477e] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#245e9d] hover:shadow-md disabled:cursor-wait disabled:opacity-50"><Download size={18} strokeWidth={1.9}/></button>
                      <span className="mx-0.5 h-6 w-px bg-[#dce7f5]" aria-hidden="true"/>
                      <Link to={`/journal/${item.id}/edit`} title="Modifier cette histoire" aria-label="Modifier cette histoire" className="grid size-10 place-items-center rounded-xl text-[#6b7280] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#eaf3ff] hover:text-[#3b4654]"><Edit3 size={18} strokeWidth={1.9}/></Link>
                      <button type="button" onClick={() => togglePinned(item)} title={item.pinned ? 'Désépingler cette histoire' : 'Épingler cette histoire'} aria-label={item.pinned ? 'Désépingler cette histoire' : 'Épingler cette histoire'} aria-pressed={Boolean(item.pinned)} className={`grid size-10 place-items-center rounded-xl transition-all duration-200 hover:-translate-y-0.5 ${item.pinned ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-[#6b7280] hover:bg-[#eaf3ff] hover:text-[#3979b7]'}`}><Pin size={18} strokeWidth={1.9} className={item.pinned ? 'fill-blue-600/20' : ''}/></button>
                      <span className="mx-0.5 h-6 w-px bg-[#dce7f5]" aria-hidden="true"/>
                      <button type="button" onClick={() => setConfirm(true)} title="Supprimer cette histoire" aria-label="Supprimer cette histoire" className="grid size-10 place-items-center rounded-xl text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={18} strokeWidth={1.9}/></button>
                    </div>
                  </div>
                  {exportBusy && <p className="mt-3 text-right text-xs text-slate-500" role="status">Préparation de votre PDF…</p>}
                </footer>
                {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              </div>
            </article>
            <aside className="min-w-0 space-y-5 lg:sticky lg:top-6">
              <section className="overflow-hidden rounded-[26px] border border-[#dce8f8] bg-white shadow-[0_16px_48px_-34px_rgba(54,45,84,.34)]">
                <div className="border-b border-[#dfeaf9] bg-gradient-to-br from-[#f4f9ff] via-white to-[#e9f3ff] px-6 pb-6 pt-6">
                  <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles size={22}/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Votre compagnon d'écriture</p><h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">MindLog AI</h2></div></div>
                  <p className="mt-4 text-base leading-7 text-slate-600">Explorez vos pensées et vos souvenirs grâce à une analyse intelligente, à votre rythme.</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Fonctions de l'assistant IA">
                    <button type="button" role="tab" aria-selected={assistantTab === 'text'} onClick={() => setAssistantTab('text')} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3.5 text-sm font-bold transition ${assistantTab === 'text' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Edit3 size={14}/> Mon texte</button>
                    <button type="button" role="tab" aria-selected={assistantTab === 'photo'} onClick={() => setAssistantTab('photo')} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3.5 text-sm font-bold transition ${assistantTab === 'photo' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><ImageIcon size={14}/> Mes photos</button>
                  </div>
                  {assistantTab === 'text' ? <div className="mt-5 space-y-4" role="tabpanel">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-lg font-bold text-slate-900">Comprendre mes émotions</p><p className="mt-2 text-base leading-7 text-slate-600">Découvrez les émotions, les thèmes et une question pour réfléchir à votre récit.</p></div>
                    <button type="button" disabled={aiLoading || !item.content?.trim()} onClick={analyzeJournal} className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-[#17477e] px-4 py-3.5 text-left text-sm font-semibold text-white shadow-[0_12px_24px_-18px_rgba(35,45,60,.75)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2562a5] disabled:cursor-not-allowed disabled:opacity-50"><span className="flex items-center gap-2.5"><Sparkles size={17}/>{aiLoading ? 'Analyse en cours...' : aiAnalysis ? "Relancer l’analyse" : 'Analyser mon récit'}</span><ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></button>
                    {aiLoading && <p role="status" className="text-xs text-blue-700">Llama 3.2 analyse votre texte...</p>}
                    {aiError && <p role="alert" className="text-sm text-red-600">{aiError}</p>}
                    {aiAnalysis && !aiLoading && <div className="max-h-[620px] space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-base leading-8">
                      <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Émotion dominante</p><p className="mt-1 text-xl font-extrabold text-slate-900">{aiAnalysis.primary_emotion}</p></div>
                      <div><p className="text-xs font-bold text-slate-700">Émotions secondaires</p><div className="mt-2 flex flex-wrap gap-1">{(aiAnalysis.secondary_emotions || []).length ? aiAnalysis.secondary_emotions.map((emotion,index)=><Badge key={`${emotion}-${index}`} className="bg-white text-blue-800">{emotion}</Badge>):<span className="text-slate-500">Aucune identifiée</span>}</div></div>
                      <div><p className="text-xs font-bold text-slate-700">Résumé</p><p className="mt-1 text-slate-600">{aiAnalysis.summary}</p></div>
                      <div><p className="text-xs font-bold text-slate-700">Observation</p><p className="mt-1 text-slate-600">{aiAnalysis.insight}</p></div>
                      <div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-blue-700">Pour aller plus loin</p><p className="mt-1 text-slate-700">{aiAnalysis.reflection_question}</p></div>
                    </div>}
                  </div> : <div className="mt-3" role="tabpanel"><JournalVisionPanel images={item.images || []} busyId={photoBusyId} error={photoError} result={photoAnalysis} onAnalyze={analyzePhoto}/></div>}
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
      <section className="relative mb-8 overflow-hidden rounded-[28px] border border-[#d8e7f8] bg-[#edf5ff]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 size-96 rounded-full border-[55px] border-[#dcecff]/60"/>
        <div className="relative grid gap-7 px-7 pb-9 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-11 md:pb-11 md:pt-12">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#4b82ba]"><BookOpen size={15}/> MON CARNET PERSONNEL</p>
            <h1 className="font-serif text-[46px] font-medium leading-none tracking-[-0.055em] text-[#152d4c] md:text-[70px]">Mes histoires<span className="text-[#3d89d8]">.</span></h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#5a7495]">Un endroit pour déposer vos pensées, retrouver vos souvenirs et mesurer le chemin parcouru.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-[#5b7b9e]"><span className="inline-flex items-center gap-2 rounded-full border border-[#cfe0f5] bg-white/80 px-4 py-2"><BookOpen size={15}/><strong className="text-slate-800">{count}</strong> {count > 1 ? 'histoires' : 'histoire'} conservée{count > 1 ? 's' : ''}</span><span className="hidden h-1 w-1 rounded-full bg-[#8cb7e3] sm:block"/><span>Chaque page compte.</span></div>
          </div>
          <Link to="/journal/new" className="inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded-xl bg-[#173c70] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-[#39475c]"><Plus size={18}/> Nouvelle histoire <ArrowUpRight size={16}/></Link>
        </div>
        <div className="relative flex flex-wrap gap-2 border-t border-[#d8e7f8] bg-white/55 px-7 py-4 md:px-11">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#d5e5f8] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#e7f2ff]" aria-expanded={showChat} onClick={() => setShowChat((v) => !v)}><MessageCircle size={16}/>{showChat ? 'Fermer la discussion' : 'Discuter avec mon journal'}</button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#d5e5f8] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#e7f2ff]" aria-expanded={showAnalytics} onClick={() => setShowAnalytics((v) => !v)}><BarChart size={16}/>{showAnalytics ? 'Masquer les statistiques' : 'Voir mes statistiques'}</button>
          {showAnalytics && <button type="button" className={actionSubtle} onClick={() => setAnalyticsRevision((n) => n + 1)}><RotateCcw size={15}/> Actualiser</button>}
        </div>
      </section>
      {showChat && <Card className="mb-6 space-y-4 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <SectionTitle title="Ask My Journal — Chat IA" subtitle="Posez des questions sur vos entrées enregistrées." />
        <div className="max-h-96 space-y-4 overflow-y-auto" aria-live="polite">
          {chatMessages.length === 0 && <p className="text-sm text-slate-500">Exemple : Qu’est-ce qui m’a rendu heureux récemment ?</p>}
          {chatMessages.map((msg, index) => <div key={index} className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <p><strong>Vous :</strong> {msg.question}</p>
            <p className="whitespace-pre-wrap"><strong>Assistant :</strong> {msg.answer}</p>
            {msg.sources.length > 0 && <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500">Entrées consultées :</span>
              {msg.sources.map((src) => <Link key={src.id} to={`/journal/${src.id}`} className="text-xs font-semibold text-blue-600 underline">{src.title} ({src.date})</Link>)}
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
      <section className="mb-6 overflow-hidden rounded-[22px] border border-[#dbe7f5] bg-white shadow-[0_8px_30px_-24px_rgba(35,40,50,.25)]" aria-label="Recherche et filtres du journal">
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8ca9ca]" size={18}/>
            <input value={q} onChange={(e) => {setQ(e.target.value); resetPage()}} className="h-12 w-full rounded-xl border border-[#dce8f7] bg-[#f6faff] pl-11 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6fa7e5] focus:bg-white focus:ring-2 focus:ring-[#e3f0ff]" placeholder="Rechercher dans mes histoires..." aria-label="Rechercher dans mes entrées" />
            {q && <button type="button" onClick={() => {setQ(''); setDebouncedQ(''); resetPage()}} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Effacer la recherche"><X size={15}/></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[155px] flex-1 sm:flex-none">
              <label htmlFor="journal-sort" className="sr-only">Trier les histoires</label>
              <select id="journal-sort" value={sort} onChange={(e) => {setSort(e.target.value); resetPage()}} className="h-11 w-full appearance-none rounded-xl border border-[#dbe7f5] bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-[#8cb9e9] focus:ring-2 focus:ring-blue-100">
                <option value="-date">Plus récentes</option><option value="date">Plus anciennes</option><option value="title">Titre A–Z</option><option value="-title">Titre Z–A</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            </div>
            <button type="button" onClick={() => setShowAdvancedFilters((v) => !v)} aria-expanded={showAdvancedFilters} aria-controls="journal-advanced-filters" className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${showAdvancedFilters || mood || dateFrom || dateTo ? 'border-[#80ade1] bg-[#e8f3ff] text-[#245b95]' : 'border-[#dbe7f5] bg-white text-slate-700 hover:border-[#8cb9e9] hover:bg-[#f4f9ff]'}`}><SlidersHorizontal size={16}/> Filtres{(mood || dateFrom || dateTo) && <span className="grid size-5 place-items-center rounded-full bg-[#b58b56] text-[11px] text-white">{[mood,dateFrom,dateTo].filter(Boolean).length}</span>}<ChevronDown size={14} className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}/></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#e6eef9] px-4 py-3">
          <span className="mr-1 hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6988ab] sm:inline">Afficher</span>
          {[{value:'all',label:'Toutes'},{value:'favorite',label:'Favoris',icon:Heart},{value:'pinned',label:'Épinglées',icon:Pin},{value:'draft',label:'Brouillons'},{value:'published',label:'Publiées'}].map((filter) => <button key={filter.value} type="button" aria-pressed={status === filter.value} onClick={() => {setStatus(filter.value); resetPage()}} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${status === filter.value ? 'bg-[#17477e] text-white shadow-sm' : 'bg-[#f1f6fc] text-[#5e7899] hover:bg-[#e1efff] hover:text-slate-900'}`}>{filter.icon && <filter.icon size={13}/>} {filter.label}</button>)}
          {(q || sort !== '-date' || mood || status !== 'all' || dateFrom || dateTo) && <button type="button" onClick={() => {setQ('');setDebouncedQ('');setSort('-date');setMood('');setStatus('all');setDateFrom('');setDateTo('');setPage(1)}} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#3676b6] transition hover:bg-blue-50"><RotateCcw size={13}/> Réinitialiser</button>}
        </div>
        {showAdvancedFilters && <div id="journal-advanced-filters" className="border-t border-[#dce9f8] bg-[#f7fbff] px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5279a3]">Affiner la recherche</p><button type="button" onClick={() => setShowAdvancedFilters(false)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-[#dce9f8]" aria-label="Fermer les filtres avancés"><X size={16}/></button></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label htmlFor="journal-mood-filter" className="mb-1.5 block text-xs font-medium text-slate-600">Humeur</label><select id="journal-mood-filter" value={mood} onChange={(e) => {setMood(e.target.value); resetPage()}} className="h-11 w-full rounded-xl border border-[#dbe7f5] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#6fa7e5]"><option value="">Toutes les humeurs</option>{Object.keys(moodColors).map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label htmlFor="journal-date-from" className="mb-1.5 block text-xs font-medium text-slate-600">Du</label><input id="journal-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => {setDateFrom(e.target.value); resetPage()}} className="h-11 w-full rounded-xl border border-[#dbe7f5] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#6fa7e5]"/></div>
            <div><label htmlFor="journal-date-to" className="mb-1.5 block text-xs font-medium text-slate-600">Au</label><input id="journal-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => {setDateTo(e.target.value); resetPage()}} className="h-11 w-full rounded-xl border border-[#dbe7f5] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#6fa7e5]"/></div>
          </div>
        </div>}
      </section>
      {listError && <p className="mb-4 text-sm text-red-600" role="alert">{listError}</p>}
      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{count} résultat{count > 1 ? 's' : ''}{listLoading ? ' · Recherche en cours...' : ''}</p><span className="text-xs text-slate-400">Page {page} sur {totalPages}</span></div>
      {listLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500" role="status">Chargement de vos souvenirs...</div> : results.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((x) => <article key={x.id} className="group relative flex min-h-[290px] flex-col overflow-hidden rounded-[22px] border border-[#d9e7f7] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#a5c8ed] hover:shadow-[0_20px_45px_-28px_rgba(38,43,55,.35)]">
            <div className="flex flex-1 flex-col p-6 md:p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#f0f6ff] px-3 py-1.5 text-[11px] font-semibold text-slate-700"><span className="size-2 rounded-full" style={{backgroundColor:moodColors[x.mood] || '#94a3b8'}}/>{x.mood || 'Sans humeur'}</span>
                <div className="flex gap-1">
                  <button type="button" className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700" title={x.pinned ? 'Désépingler' : 'Épingler'} aria-label={x.pinned ? 'Désépingler' : 'Épingler'} onClick={() => togglePinned(x)}><Pin size={16} className={x.pinned ? 'fill-blue-600 text-blue-600' : ''}/></button>
                  <button type="button" className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title={x.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-label={x.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => toggleFavorite(x)}><Heart size={17} className={x.favorite ? 'fill-rose-500 text-rose-500' : ''}/></button>
                </div>
              </div>
              <Link to={`/journal/${x.id}`} className="mt-6 block flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3d89d8]">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#628bb7]"><CalendarDays size={13}/>{x.date}{x.draft && <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-blue-700">Brouillon</span>}</div>
                <h2 className="line-clamp-2 break-words font-serif text-[30px] font-medium leading-tight tracking-[-0.04em] text-[#173c70] transition group-hover:text-[#286fb7]">{x.title || 'Sans titre'}</h2>
                <p className="mt-4 line-clamp-3 whitespace-pre-line break-words text-[14px] leading-[1.85] text-slate-500">{x.content || 'Une page à compléter...'}</p>
              </Link>
              <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#e4edf8] pt-4">
                <div className="flex min-w-0 flex-wrap gap-1.5">{(x.tags || []).slice(0,2).map((t) => <span key={t} className="max-w-28 truncate rounded-md bg-[#edf5ff] px-2 py-1 text-[11px] text-[#577da6]">#{t}</span>)}</div>
                <Link to={`/journal/${x.id}`} className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#275e9b] transition group-hover:gap-3">Ouvrir <ArrowUpRight size={16}/></Link>
              </div>
            </div>
          </article>)}
        </div>
      ) : <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><BookOpen className="mx-auto mb-4 text-slate-300" size={38}/><h2 className="text-xl font-semibold text-slate-900">Aucune page trouvée</h2><p className="mt-2 text-sm text-slate-500">Essayez d'autres filtres ou commencez une nouvelle histoire.</p><Link to="/journal/new" className={`${actionPrimary} mt-6`}><Plus size={16}/> Nouvelle entrée</Link></div>}
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

function dominantMood(stats) {
  const top = stats?.distribution?.[0]
  if (!top || !stats?.count) return null
  return top
}

function intensityShift(points) {
  if (!Array.isArray(points) || points.length < 2) return null
  const first = Number(points[0].intensity)
  const last = Number(points[points.length - 1].intensity)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null
  const delta = last - first
  if (delta === 0) return { value: "Stable", hint: "Même intensité qu'au premier point affiché" }
  if (delta > 0) return { value: `+${delta}`, hint: "Plus élevée qu'au premier point affiché" }
  return { value: String(delta), hint: "Plus basse qu'au premier point affiché" }
}

function MoodMetric({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-50 text-stone-600" aria-hidden="true">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-stone-950">
        {tone ? <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone }} aria-hidden="true" /> : null}
        <span className="min-w-0 truncate">{value}</span>
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p> : null}
    </div>
  )
}

function MoodIntensityMeter({ value }) {
  const level = Number(value) || 0
  return (
    <div className="flex items-center gap-1.5" aria-label={`Intensité ${level} sur 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={`h-1.5 w-6 rounded-full ${step <= level ? "bg-teal-800" : "bg-stone-200"}`}
        />
      ))}
    </div>
  )
}

function MoodChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload || {}
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-stone-800">{label}</p>
      <p className="text-stone-600">{point.mood || "Intensité"} · {payload[0].value}/5</p>
    </div>
  )
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
    <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-stone-700">Filtrer les check-ins</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  )
}

function formatFileSize(size) {
  if (size < 1024) return `${size} o`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`
}

function MoodOcrImport({ onUse }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [phase, setPhase] = useState("idle")
  const [draft, setDraft] = useState("")
  const [message, setMessage] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      setPreview("")
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const choose = (event) => {
    const next = event.target.files && event.target.files[0]
    event.target.value = ""
    setConfirmed(false)
    setDraft("")
    setMessage("")
    if (!next) {
      setFile(null)
      setPhase("idle")
      return
    }
    const name = next.name.toLowerCase()
    const allowedName = [".png", ".jpg", ".jpeg", ".webp", ".pdf"].some((ext) => name.endsWith(ext))
    const allowedType = ["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(next.type)
    if (!allowedName && !allowedType) {
      setFile(next)
      setPhase("invalid")
      setMessage("Format non pris en charge. Utilisez une image PNG, JPEG, WEBP ou un PDF.")
      return
    }
    if (!next.size) {
      setFile(next)
      setPhase("invalid")
      setMessage("Le fichier est vide.")
      return
    }
    if (next.size > 5 * 1024 * 1024) {
      setFile(next)
      setPhase("too-big")
      setMessage("Le fichier dépasse la limite de 5 Mo.")
      return
    }
    setFile(next)
    setPhase("selected")
  }

  const extract = async () => {
    if (!file || phase === "extracting") return
    setPhase("extracting")
    setMessage("")
    setConfirmed(false)
    try {
      const result = await moodService.extractOcr(file)
      if (result.status === "success") {
        setDraft(result.text || "")
        setPhase("ready")
        setMessage(result.message || "")
        return
      }
      setDraft("")
      if (result.status === "unavailable") {
        setPhase("unavailable")
        setMessage(result.message || "L'OCR est indisponible.")
        return
      }
      if (result.status === "no_text") {
        setPhase("empty-text")
        setMessage(result.message || "Aucun texte exploitable n'a été trouvé.")
        return
      }
      setPhase("error")
      setMessage(result.message || "L'extraction n'a pas abouti.")
    } catch (err) {
      const text = err.message || "Extraction impossible."
      if (/vide/i.test(text)) setPhase("invalid")
      else if (/limite|volumineux/i.test(text)) setPhase("too-big")
      else if (/format|illisible|endommag|pris en charge/i.test(text)) setPhase("invalid")
      else setPhase("error")
      setMessage(text)
    }
  }

  const useText = () => {
    const text = draft.trim()
    if (!text) {
      setMessage("Le texte est vide. Corrigez-le ou relancez l'extraction.")
      return
    }
    if (text.length > 2000) {
      setMessage("La note ne peut pas dépasser 2000 caractères. Raccourcissez le texte.")
      return
    }
    onUse(text)
    setConfirmed(true)
    setMessage("")
  }

  return (
    <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Importer un document</p>
      <label htmlFor="mood-ocr-file" className="mt-1 block text-sm font-semibold text-stone-800">
        Image ou PDF
      </label>
      <p className="mt-1 text-sm leading-6 text-stone-500">
        1. Choisir un fichier. 2. Extraire le texte. 3. Le corriger. 4. Confirmer pour le placer dans la note. L'humeur et l'intensité ne changent pas.
      </p>
      <input
        id="mood-ocr-file"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
        onChange={choose}
        className="mt-3 block w-full text-sm text-stone-600 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-stone-700"
      />
      {file && (
        <p className="mt-3 text-sm text-stone-600">
          {file.name} · {formatFileSize(file.size)}
        </p>
      )}
      {preview && (
        <img src={preview} alt="Aperçu du document importé" className="mt-3 max-h-40 rounded-xl border border-stone-200 bg-white" />
      )}
      {file && phase !== "invalid" && phase !== "too-big" && (
        <div className="mt-3">
          <Button type="button" variant="secondary" disabled={phase === "extracting"} onClick={extract}>
            {phase === "extracting" ? "Extraction..." : phase === "ready" || phase === "empty-text" ? "Extraire à nouveau" : "Extraire le texte"}
          </Button>
        </div>
      )}
      {phase === "extracting" && (
        <div className="mt-3"><Loading label="Extraction du texte..." /></div>
      )}
      {message && (
        <p role="alert" className={`mt-3 text-sm ${phase === "ready" ? "text-stone-500" : "text-red-700"}`}>{message}</p>
      )}
      {phase === "ready" && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3">
          <Textarea
            label="Texte reconnu, à corriger avant confirmation"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setConfirmed(false)
            }}
          />
          <div className="mt-3">
            <Button type="button" onClick={useText}>
              Utiliser ce texte dans ma note
            </Button>
          </div>
        </div>
      )}
      {confirmed && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Texte inséré dans la note. Il sera enregistré lorsque vous validerez le formulaire.
        </p>
      )}
    </div>
  )
}

function MoodForm({ initial, busy, error, title, subtitle, submitLabel, cancelTo = "/mood", onSubmit }) {
  const [form, setForm] = useState(initial)
  const [localError, setLocalError] = useState("")
  const submit = (e) => {
    e.preventDefault()
    setLocalError("")
    if (form.date > localDateInput()) {
      setLocalError("La date ne peut pas être dans le futur.")
      return
    }
    if (form.note.trim().length > 2000) {
      setLocalError("La note ne peut pas dépasser 2000 caractères.")
      return
    }
    onSubmit({
      mood: form.mood,
      intensity: Number(form.intensity),
      note: form.note.trim(),
      date: toApiDateTime(form.date),
    })
  }
  const dateError = /date|futur/i.test(localError) ? localError : ""
  const noteError = /note|2000/i.test(localError) ? localError : ""
  const otherError = !dateError && !noteError ? localError : ""
  return (
    <>
      <PageHeader eyebrow="Humeurs" title={title} subtitle={subtitle} />
      <Card className="mx-auto max-w-3xl border-stone-200 p-5 shadow-sm sm:p-6">
        <form onSubmit={submit}>
          <fieldset>
            <legend className="text-sm font-semibold text-stone-800">Humeur</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.keys(moodColors).map((x) => {
                const selected = form.mood === x
                return (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm({ ...form, mood: x })}
                    className={`min-h-16 rounded-2xl border px-3 py-3 text-left text-sm font-semibold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                      selected
                        ? "border-teal-800 bg-teal-50 text-teal-950"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: moodColors[x] }} aria-hidden="true" />
                      {x}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-stone-500">{selected ? "Choisie" : "Choisir"}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="mt-7" role="group" aria-label="Intensité de 1 à 5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-stone-800">Intensité</span>
              <span className="text-sm text-stone-500">{form.intensity} sur 5</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  aria-pressed={Number(form.intensity) === step}
                  onClick={() => setForm({ ...form, intensity: step })}
                  className={`min-h-11 rounded-xl border text-sm font-semibold motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                    Number(form.intensity) === step
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
            <p className="mt-2 flex justify-between text-xs text-stone-500"><span>Plus douce</span><span>Plus forte</span></p>
          </div>
          <MoodOcrImport onUse={(text) => setForm((current) => ({ ...current, note: text }))} />
          <div className="mt-6">
            <Textarea
              label="Note personnelle, facultative"
              value={form.note}
              error={noteError}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <Input
            className="mt-4"
            label="Date"
            type="date"
            value={form.date}
            error={dateError}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          {(otherError || error) && (
            <p className="mt-4 text-sm text-red-700" role="alert">{otherError || error}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled={busy}>
              {busy ? "Enregistrement..." : submitLabel}
            </Button>
            <Link to={cancelTo} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
              Annuler
            </Link>
          </div>
        </form>
      </Card>
    </>
  )
}

function MoodNoteAnalysisCard({ detail, busy, notice, onAnalyze }) {
  const analysis = detail.note_analysis
  const hasNote = Boolean(detail.note && detail.note.trim())
  const stale = analysis?.status === "stale"
  const visible = analysis && (analysis.status === "available" || stale)
  return (
    <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5" aria-label="Analyse de la note">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Analyse de la note</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">
            Interprétation du texte enregistré. Elle ne remplace ni l'humeur ni l'intensité que vous avez déclarées.
          </p>
        </div>
        {visible && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stale ? "bg-amber-100 text-amber-900" : "bg-white text-teal-900"}`}>
            {stale ? "Périmée" : "À jour"}
          </span>
        )}
      </div>
      {!hasNote && (
        <p className="mt-4 text-sm text-stone-500">Ajoutez une note pour lancer l'analyse.</p>
      )}
      {hasNote && (
        <div className="mt-4">
          <Button variant="ai" disabled={busy} onClick={() => onAnalyze(stale || analysis?.status === "available")}>
            <Sparkles size={16} />
            {busy ? "Analyse..." : stale || analysis ? "Relancer l'analyse" : "Analyser la note"}
          </Button>
        </div>
      )}
      {busy && <div className="mt-4"><Loading label="Le modèle local lit la note..." /></div>}
      {notice && <p role="alert" className="mt-4 text-sm text-red-700">{notice}</p>}
      {stale && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Cette analyse ne correspond plus à la note actuelle. Le contenu ci-dessous est l'ancienne lecture.
        </p>
      )}
      {visible && (
        <div className={`mt-4 space-y-4 text-sm text-stone-700 ${stale ? "opacity-80" : ""}`}>
          <div>
            <h3 className="font-semibold text-stone-950">Résumé</h3>
            <p className="mt-1 leading-6">{analysis.summary}</p>
          </div>
          <div>
            <h3 className="font-semibold text-stone-950">Émotions secondaires</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.emotions_secondary.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-stone-950">Thèmes</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.themes.map((item) => (
                <Badge key={item} className="bg-white text-teal-900">{item}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-stone-950">Extraits de votre note</h3>
            <ul className="mt-2 space-y-2">
              {analysis.evidence.map((item) => (
                <li key={item} className="rounded-xl bg-white p-3 leading-6">« {item} »</li>
              ))}
            </ul>
          </div>
          {analysis.limitations ? (
            <div>
              <h3 className="font-semibold text-stone-950">Limites</h3>
              <p className="mt-1 leading-6 text-stone-500">{analysis.limitations}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
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

function MoodAssistant() {
  const [question, setQuestion] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [payload, setPayload] = useState(null)

  const ask = async (event) => {
    event.preventDefault()
    const text = question.trim()
    if (!text) {
      setError("Indiquez une question.")
      setPayload(null)
      return
    }
    setBusy(true)
    setError("")
    try {
      setPayload(await moodService.askAssistant(text))
    } catch (err) {
      setPayload(null)
      setError(err.message || "L'assistant est indisponible.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-5 border-stone-200 p-5 shadow-sm">
      <SectionTitle
        title="Assistant"
        subtitle="Une question à la fois, à partir de vos check-ins. Ce n'est pas un diagnostic, et la conversation n'est pas conservée."
      />
      <form onSubmit={ask} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="min-w-0 flex-1"
          label="Votre question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={1000}
          placeholder="Par exemple : quelles situations reviennent lorsque je suis stressé ?"
        />
        <Button type="submit" variant="ai" disabled={busy}>
          <MessageCircle size={16} /> {busy ? "Réponse..." : "Envoyer"}
        </Button>
      </form>
      {busy && <div className="mt-4"><Loading label="Lecture de vos check-ins..." /></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {payload && !busy && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Réponse</p>
            <p className="mt-2 text-sm leading-6 text-stone-800">{payload.answer}</p>
          </div>
          {payload.sources?.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-stone-700">Sources utilisées</p>
              {payload.sources.map((item) => (
                <Link
                  key={item.id}
                  to={`/mood/${item.id}`}
                  className="block rounded-xl border border-stone-200 p-4 motion-safe:transition-colors hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  <span className="flex items-center gap-2 font-semibold text-stone-900">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: moodColors[item.mood] || "#a8a29e" }} aria-hidden="true" />
                    {item.mood}
                  </span>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatMoodDate(item.date)} · Intensité {item.intensity}/5
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{item.excerpt}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Aucune source utilisée. Aucun check-in assez proche n'a été trouvé.</p>
          )}
        </div>
      )}
    </Card>
  )
}

function MoodSemanticSearch() {
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [payload, setPayload] = useState(null)

  const search = async (event) => {
    event.preventDefault()
    const text = query.trim()
    if (!text) {
      setError("Indiquez ce que vous cherchez.")
      setPayload(null)
      return
    }
    setBusy(true)
    setError("")
    try {
      setPayload(await moodService.semanticSearch(text))
    } catch (err) {
      setPayload(null)
      setError(err.message || "La recherche sémantique est indisponible.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-5 border-stone-200 p-5 shadow-sm">
      <SectionTitle
        title="Recherche par le sens"
        subtitle="Retrouve des notes proches par le sens. Le nombre affiché est une similarité, pas un pourcentage ni un diagnostic."
      />
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="min-w-0 flex-1"
          label="Que voulez-vous retrouver ?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={1000}
          placeholder="Par exemple : je suis épuisé et je dors mal"
        />
        <Button type="submit" disabled={busy}>
          <Search size={16} /> {busy ? "Recherche..." : "Rechercher"}
        </Button>
      </form>
      {busy && <div className="mt-4"><Loading label="Comparaison de vos notes..." /></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {payload && !busy && payload.results.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">{payload.message || "Aucun résultat assez proche."}</p>
      )}
      {payload && !busy && payload.pending > 0 && (
        <p className="mt-3 text-sm text-stone-500">
          Certaines notes ne sont pas encore indexées. Relancez la recherche pour les inclure.
        </p>
      )}
      {payload && !busy && payload.results.length > 0 && (
        <div className="mt-4 space-y-3">
          {payload.results.map((item) => (
            <Link
              key={item.id}
              to={`/mood/${item.id}`}
              className="block rounded-xl border border-stone-200 p-4 motion-safe:transition-colors hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-stone-900">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: moodColors[item.mood] || "#a8a29e" }} aria-hidden="true" />
                  {item.mood}
                </span>
                <span
                  className="text-xs font-semibold text-stone-600"
                  title="Similarité cosinus entre la recherche et la note. Ce n'est ni un pourcentage ni un diagnostic."
                >
                  Similarité {Number(item.similarity).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {formatMoodDate(item.date)} · Intensité {item.intensity}/5
              </p>
              <MoodIntensityMeter value={item.intensity} />
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.excerpt}</p>
            </Link>
          ))}
        </div>
      )}
    </Card>
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
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisNotice, setAnalysisNotice] = useState("")
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
    setAnalysisNotice("")
    setAnalysisBusy(false)
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

  const analyzeNote = async (regenerate) => {
    if (!detail || analysisBusy || !detail.note?.trim()) return
    setAnalysisBusy(true)
    setAnalysisNotice("")
    try {
      const result = await moodService.analyzeNote(detail.id, { regenerate })
      setDetail((current) => current ? { ...current, note_analysis: result.note_analysis } : current)
      if (result.analysis_status === "unavailable" || result.analysis_status === "error") {
        setAnalysisNotice(result.message || "L'analyse n'a pas pu être produite.")
      }
    } catch (err) {
      setAnalysisNotice(err.message || "Analyse impossible.")
    } finally {
      setAnalysisBusy(false)
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
        subtitle="Choisissez une humeur, puis une intensité. La note reste la vôtre."
        submitLabel="Enregistrer mon humeur"
        cancelTo="/mood"
        onSubmit={save}
      />
    )
  }

  if (mode === "edit") {
    if (detailLoading) return <Loading label="Chargement de l’humeur..." />
    if (error) return <p role="alert" className="text-red-700">{error}</p>
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
        subtitle="Ajustez l’émotion, l’intensité ou la note. Rien n’est enregistré avant la validation."
        submitLabel="Enregistrer les modifications"
        cancelTo={`/mood/${detail.id}`}
        onSubmit={save}
      />
    )
  }

  if (mode === "detail") {
    if (detailLoading) return <Loading label="Chargement de l’humeur..." />
    if (error && !detail) return <p role="alert" className="text-red-700">{error}</p>
    if (!detail) return <Empty title="Humeur introuvable" text="Cet enregistrement n’existe pas ou ne vous appartient pas." />
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <Link to="/mood/history" className="text-sm font-semibold text-teal-800 hover:underline">Retour à l’historique</Link>
          <p className="mt-3 text-sm text-stone-500">{formatMoodDate(detail.date)}</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight text-stone-950">
            <span className="size-3 rounded-full" style={{ backgroundColor: moodColors[detail.mood] || "#a8a29e" }} aria-hidden="true" />
            {detail.mood}
          </h1>
          <p className="mt-3 text-sm text-stone-600">Intensité {detail.intensity} sur 5</p>
          <div className="mt-2"><MoodIntensityMeter value={detail.intensity} /></div>
        </div>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">Note personnelle</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{detail.note || "Aucune note."}</p>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link to={`/mood/${detail.id}/edit`}><Button variant="secondary"><Edit3 size={16} /> Modifier</Button></Link>
          <Button variant="danger" onClick={() => setConfirm(detail)}><Trash2 size={16} /> Supprimer</Button>
        </div>
        <MoodNoteAnalysisCard
          detail={detail}
          busy={analysisBusy}
          notice={analysisNotice}
          onAnalyze={analyzeNote}
        />
        <MoodDeleteModal item={confirm} busy={busy} onClose={() => setConfirm(null)} onConfirm={remove} />
      </div>
    )
  }

  const chart = (stats?.intensity_over_time || []).map((point) => ({
    day: new Date(point.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: point.intensity,
    mood: point.mood,
  }))
  const distribution = stats?.distribution || []
  const shift = intensityShift(stats?.intensity_over_time)
  const monthDominant = dominantMood(monthStats)

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
          eyebrow="Humeurs"
          title="Tendances"
          subtitle="Les graphiques décrivent ce que vous avez enregistré. Ils n'expliquent pas pourquoi."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Ces tendances sont informatives. Elles ne constituent ni un avis médical, ni un diagnostic, ni un lien de cause à effet.
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
            <Card className="border-stone-200 p-5 shadow-sm">
              <SectionTitle title="Humeurs fréquentes" subtitle="Répartition des check-ins de la période filtrée." />
              {distribution.length ? (
                <div className="grid items-center gap-4 sm:grid-cols-[12rem_1fr]">
                  <div className="h-52">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={distribution} dataKey="count" nameKey="mood" innerRadius={48} outerRadius={72}>
                          {distribution.map((entry) => (
                            <Cell key={entry.mood} fill={moodColors[entry.mood] || "#6c63ff"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {distribution.map((entry) => (
                      <li key={entry.mood} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-stone-800">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: moodColors[entry.mood] || "#a8a29e" }} aria-hidden="true" />
                          {entry.mood}
                        </span>
                        <span className="text-stone-500">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-sm text-stone-500">Aucune humeur sur cette période. Enregistrez un check-in ou élargissez le filtre.</p>}
            </Card>
            <Card className="border-stone-200 p-5 shadow-sm">
              <SectionTitle title="Intensité" subtitle="Chaque point est un check-in, de 1 à 5." />
              {chart.length ? (
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e7e5e4" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#78716c" }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 5]} width={28} tick={{ fontSize: 12, fill: "#78716c" }} />
                      <Tooltip content={<MoodChartTooltip />} />
                      <Area dataKey="value" name="Intensité" stroke="#115e59" fill="#ccfbf1" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-stone-500">Pas encore assez de check-ins pour tracer une courbe.</p>}
            </Card>
            <Card className="border-stone-200 p-5 shadow-sm lg:col-span-2">
              <SectionTitle
                title="Synthèse"
                subtitle="À gauche, les chiffres calculés. À droite, le texte du modèle, seulement s'il a été demandé."
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
            <Card className="border-stone-200 p-5 shadow-sm lg:col-span-2">
              <SectionTitle title="Lecture des chiffres" subtitle="Ces phrases reprennent les statistiques, sans interprétation supplémentaire." />
              <ul className="space-y-3 text-sm text-stone-600">
                {observations.map((line) => (
                  <li key={line} className="rounded-xl bg-stone-50 p-4">{line}</li>
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
          eyebrow="Humeurs"
          title="Historique"
          subtitle="Retrouvez un check-in, posez une question ou cherchez par le sens."
          actions={
            <Link to="/mood/new">
              <Button><Plus /> Nouveau check-in</Button>
            </Link>
          }
        />
        <MoodAssistant />
        <MoodSemanticSearch />
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
            <article key={entry.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-2 font-semibold text-stone-950">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: moodColors[entry.mood] || "#a8a29e" }} aria-hidden="true" />
                      {entry.mood}
                    </span>
                    <span className="text-xs text-stone-500">{formatMoodDate(entry.date)}</span>
                  </div>
                  <div className="mt-2"><MoodIntensityMeter value={entry.intensity} /></div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{entry.note || "Aucune note."}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/mood/${entry.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-stone-900 px-3 text-sm font-semibold text-white hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
                    Voir
                  </Link>
                  <Link to={`/mood/${entry.id}/edit`} aria-label={`Modifier le check-in ${entry.mood}`} className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
                    <Edit3 size={17} />
                  </Link>
                  <button type="button" onClick={() => setConfirm(entry)} aria-label={`Supprimer le check-in ${entry.mood}`} className="inline-flex size-11 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
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
        eyebrow="Humeurs"
        title="Aujourd'hui"
        subtitle="Un aperçu de ce mois et des quatorze derniers jours."
        actions={
          <>
            <Link to="/mood/history"><Button variant="secondary">Historique</Button></Link>
            <Link to="/mood/insights"><Button variant="secondary">Tendances</Button></Link>
            <Link to="/mood/new"><Button><Plus /> Enregistrer</Button></Link>
          </>
        }
      />
      {statsLoading && <Loading label="Chargement de vos humeurs..." />}
      {statsError && <p role="alert" className="mb-4 text-sm text-red-700">{statsError}</p>}
      {!statsLoading && !statsError && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MoodMetric icon={CalendarDays} label="Check-ins ce mois" value={monthStats?.count ?? 0} hint="Enregistrements du mois en cours" />
            <MoodMetric
              icon={Smile}
              label="Humeur la plus fréquente"
              value={monthDominant?.mood || "—"}
              tone={monthDominant ? moodColors[monthDominant.mood] : undefined}
              hint={monthDominant ? `${monthDominant.count} fois ce mois` : "Pas encore de check-in ce mois"}
            />
            <MoodMetric icon={Heart} label="Intensité moyenne" value={formatAverage(monthStats?.average_intensity)} hint="Moyenne du mois, sur 5" />
            <MoodMetric
              icon={ArrowUpRight}
              label="Écart sur 14 jours"
              value={shift?.value || "—"}
              hint={shift?.hint || "Il faut au moins deux check-ins sur la période"}
            />
          </div>
          <Card className="mt-5 border-stone-200 p-5 shadow-sm">
            <SectionTitle title="Intensité, 14 derniers jours" subtitle={stats?.latest?.mood ? `Dernier check-in de la période : ${stats.latest.mood}.` : "Aucun check-in sur les 14 derniers jours."} />
            {chart.length ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#78716c" }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 5]} width={28} tick={{ fontSize: 12, fill: "#78716c" }} />
                    <Tooltip content={<MoodChartTooltip />} />
                    <Area dataKey="value" name="Intensité" stroke="#115e59" fill="#ccfbf1" strokeWidth={2} />
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

export { MediaPage } from "../media/MediaPage"

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
