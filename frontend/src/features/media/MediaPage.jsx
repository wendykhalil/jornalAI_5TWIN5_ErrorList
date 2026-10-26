import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  Upload,
  Sparkles,
  Mic,
  Image as ImageIcon,
  Users,
  Play,
  Save,
  Download,
  Trash2,
  Edit3,
  AlertCircle,
  FileText,
  Film,
  Music,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react"
import { useStore } from "../../store/AppStore"
import { mediaService } from "../../services/mediaService"
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  PageHeader,
  Empty,
  Modal,
  Loading,
  SectionTitle,
} from "../../components/ui"

// Résolution sécurisée de l'URL d'un fichier audio (absolue ou relative)
function resolveAudioUrl(item) {
  if (!item?.url) return ""
  if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
    return item.url
  }
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
  const cleanBase = API_BASE_URL.replace(/\/api\/?$/, "")
  return `${cleanBase}${item.url.startsWith("/") ? "" : "/"}${item.url}`
}

export function MediaPage({ mode = "library" }) {
  const { media, setMedia, mediaLoading, notify, uploadMedia } = useStore()
  const nav = useNavigate()
  const { id } = useParams()

  // --- States pour la bibliothèque et les modes démo ---
  const [q, setQ] = useState("")
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [prompt, setPrompt] = useState(
    "Une plage tunisienne paisible au coucher du soleil",
  )
  const [generated, setGenerated] = useState(false)

  // --- State pour l'upload (Mode 1) ---
  const [selectedFile, setSelectedFile] = useState(null)

  // --- States pour le mode détail et CRUD ---
  const [fetchedItem, setFetchedItem] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  // Édition des métadonnées (PATCH JSON)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Suppression sécurisée (DELETE)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // --- States pour la transcription audio (Mode 4) ---
  const [selectedAudioId, setSelectedAudioId] = useState("")
  const [transcriptionText, setTranscriptionText] = useState("")
  const [transcriptionMeta, setTranscriptionMeta] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState(null)
  const [noSpeechDetected, setNoSpeechDetected] = useState(false)
  const [isConfirmSaveModalOpen, setIsConfirmSaveModalOpen] = useState(false)
  const [isSavingTranscription, setIsSavingTranscription] = useState(false)
  const [saveTranscriptionError, setSaveTranscriptionError] = useState(null)

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Médias audio appartenant à l'utilisateur connecté
  const audioMedia = media.filter((x) => (x.media_type || x.type) === "audio")

  // Initialisation du fichier audio sélectionné
  useEffect(() => {
    if (mode === "transcription" && audioMedia.length > 0) {
      if (
        !selectedAudioId ||
        !audioMedia.some((m) => String(m.id) === String(selectedAudioId))
      ) {
        setSelectedAudioId(String(audioMedia[0].id))
      }
    }
  }, [mode, audioMedia.length, selectedAudioId])

  const activeAudioMedia =
    audioMedia.find((x) => String(x.id) === String(selectedAudioId)) ||
    audioMedia[0]

  // Changement de fichier audio sélectionné : réinitialisation de la transcription pour éviter d'attribuer
  // l'ancienne transcription au nouveau fichier (Règle 19)
  const handleSelectAudio = (newId) => {
    setSelectedAudioId(newId)
    setTranscriptionText("")
    setTranscriptionMeta(null)
    setTranscriptionError(null)
    setSaveTranscriptionError(null)
    setNoSpeechDetected(false)
  }

  // Lancement de la transcription Whisper
  const handleTranscribe = async () => {
    if (!activeAudioMedia) {
      notify("Veuillez sélectionner un fichier audio.", "error")
      return
    }

    if (isTranscribing) return

    setIsTranscribing(true)
    setTranscriptionError(null)
    setNoSpeechDetected(false)
    setSaveTranscriptionError(null)

    try {
      const result = await mediaService.transcribeMedia(activeAudioMedia.id)
      if (!isMountedRef.current) return

      const text = result?.text || ""
      setTranscriptionText(text)
      setTranscriptionMeta({
        language: result?.language || "unknown",
        duration: result?.duration || 0,
        model: result?.model || "base",
      })

      if (!text.trim()) {
        setNoSpeechDetected(true)
        notify("Aucune parole détectée dans cet enregistrement.", "info")
      } else {
        notify("Transcription réussie avec Whisper !")
      }
    } catch (err) {
      if (!isMountedRef.current) return

      let userMsg = ""
      if (err.status === 422 || err.code === "no_speech_detected") {
        setNoSpeechDetected(true)
        setTranscriptionText("")
        userMsg = "Aucune parole détectée dans cet enregistrement."
      } else if (
        err.status === 400 ||
        err.code === "invalid_media_type" ||
        err.code === "invalid_audio"
      ) {
        userMsg =
          err.message || "Fichier audio non valide ou format non supporté."
      } else if (err.status === 401) {
        userMsg =
          "Session expirée. Veuillez vous reconnecter pour transcrire un média."
      } else if (err.status === 404 || err.code === "file_not_found") {
        userMsg = "Fichier audio introuvable sur le serveur ou non accessible."
      } else if (
        err.status === 503 ||
        err.code === "service_unavailable" ||
        err.code === "service_busy"
      ) {
        userMsg =
          err.message ||
          "Le service de transcription Whisper est temporairement indisponible ou surchargé."
      } else {
        userMsg =
          err.message || "Une erreur est survenue lors de la transcription."
      }

      setTranscriptionError(userMsg)
      notify(userMsg, "error")
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false)
      }
    }
  }

  const handleOpenConfirmSave = () => {
    if (!transcriptionText.trim()) {
      notify("Aucun texte à enregistrer.", "error")
      return
    }
    setSaveTranscriptionError(null)
    setIsConfirmSaveModalOpen(true)
  }

  const handleCloseConfirmSave = () => {
    if (isSavingTranscription) return
    setIsConfirmSaveModalOpen(false)
    setSaveTranscriptionError(null)
  }

  const handleConfirmSaveTranscription = async () => {
    if (!activeAudioMedia) return
    if (!transcriptionText.trim()) {
      setSaveTranscriptionError(
        "Le texte de transcription ne peut pas être vide.",
      )
      return
    }

    if (isSavingTranscription) return

    setIsSavingTranscription(true)
    setSaveTranscriptionError(null)

    try {
      const payload = {
        description: transcriptionText.trim(),
      }

      const updated = await mediaService.updateMedia(
        activeAudioMedia.id,
        payload,
      )
      if (!isMountedRef.current) return

      // Mise à jour de l'état local du store sans recharger toute la page
      setMedia((previous) =>
        previous.map((item) =>
          String(item.id) === String(activeAudioMedia.id)
            ? { ...item, ...updated }
            : item,
        ),
      )

      notify("Transcription enregistrée dans la description du média !")
      setIsConfirmSaveModalOpen(false)
    } catch (err) {
      if (!isMountedRef.current) return
      const msg =
        err?.message || "Erreur lors de l'enregistrement de la description."
      setSaveTranscriptionError(msg)
      notify(msg, "error")
    } finally {
      if (isMountedRef.current) {
        setIsSavingTranscription(false)
      }
    }
  }

  // Recherche du média dans le store ou récupération via l'API en direct
  const storeItem = media.find((m) => String(m.id) === String(id))
  const currentMedia = storeItem || fetchedItem

  useEffect(() => {
    if (mode !== "detail" || !id) {
      setFetchedItem(null)
      setFetchLoading(false)
      setFetchError(null)
      return
    }

    // Si le média est déjà dans le store local, pas d'appel réseau nécessaire
    if (storeItem) {
      setFetchLoading(false)
      setFetchError(null)
      return
    }

    let active = true
    setFetchLoading(true)
    setFetchError(null)

    mediaService
      .getMediaById(id)
      .then((data) => {
        if (active) {
          setFetchedItem(data)
          setFetchError(null)
        }
      })
      .catch((err) => {
        if (active) {
          setFetchedItem(null)
          setFetchError(err?.message || "Média introuvable")
        }
      })
      .finally(() => {
        if (active) {
          setFetchLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [mode, id, Boolean(storeItem)])

  // Gestion des images distantes / relatives
  const handleImageError = (e, url) => {
    if (url && url.startsWith("/")) {
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
      e.target.src = `${API_BASE_URL}${url}`
    }
  }

  // Fonctions d'édition des métadonnées
  const handleOpenEdit = () => {
    if (!currentMedia) return
    setEditTitle(currentMedia.title || "")
    setEditDescription(currentMedia.description || "")
    setEditError(null)
    setIsEditModalOpen(true)
  }

  const handleCloseEdit = () => {
    if (isSaving) return
    setIsEditModalOpen(false)
    setEditError(null)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setEditError("Le titre ne peut pas être vide.")
      return
    }

    setIsSaving(true)
    setEditError(null)

    try {
      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim(),
      }

      const updated = await mediaService.updateMedia(currentMedia.id, payload)

      // Mise à jour de l'état local du store sans écraser les autres données
      setMedia((previous) =>
        previous.map((item) =>
          String(item.id) === String(currentMedia.id)
            ? { ...item, ...updated }
            : item,
        ),
      )

      if (fetchedItem) {
        setFetchedItem((prev) => (prev ? { ...prev, ...updated } : prev))
      }

      notify("Métadonnées mises à jour avec succès")
      setIsEditModalOpen(false)
    } catch (err) {
      const message =
        err?.message || "Erreur lors de la mise à jour des métadonnées"
      setEditError(message)
      notify(message, "error")
    } finally {
      setIsSaving(false)
    }
  }

  // Fonctions de suppression
  const handleOpenDelete = () => {
    setDeleteError(null)
    setIsDeleteModalOpen(true)
  }

  const handleCloseDelete = () => {
    if (isDeleting) return
    setIsDeleteModalOpen(false)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!currentMedia) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await mediaService.deleteMedia(currentMedia.id)

      // Retrait du média du store uniquement après succès confirmé par le backend
      setMedia((previous) =>
        previous.filter((item) => String(item.id) !== String(currentMedia.id)),
      )

      notify("Média supprimé avec succès")
      setIsDeleteModalOpen(false)
      nav("/media")
    } catch (err) {
      // En cas d'erreur, le média est conservé dans l'affichage
      const message = err?.message || "Erreur lors de la suppression du média"
      setDeleteError(message)
      notify(message, "error")
    } finally {
      setIsDeleting(false)
    }
  }

  // ==========================================
  // MODE 1 : AJOUTER UN MÉDIA (UPLOAD)
  // ==========================================
  if (mode === "upload") {
    return (
      <>
        <PageHeader
          title="Ajouter un média"
          subtitle="Les médias sont enregistrés et disponibles dans votre bibliothèque."
        />
        <Card className="mx-auto max-w-3xl p-6">
          <label className="grid min-h-52 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-violet-400">
            {selectedFile ? (
              <div className="p-4 text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-violet-100 text-violet-700">
                  <CheckCircle2 size={24} />
                </div>
                <b className="block max-w-md truncate text-base text-slate-900">
                  {selectedFile.name}
                </b>
                <p className="mt-1 text-xs text-slate-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} Mo · Cliquez
                  pour changer de fichier
                </p>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto mb-3 text-violet-600" />
                <b>Déposez vos fichiers ou cliquez pour parcourir</b>
                <p className="mt-1 text-sm text-slate-500">
                  Images, audio, vidéo ou documents
                </p>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              id="file-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setSelectedFile(file)
                  const titleInput = document.querySelector("#media-title")
                  if (titleInput && !titleInput.value) {
                    titleInput.value = file.name.replace(/\.[^/.]+$/, "")
                  }
                  const typeSelect = document.querySelector("#media-type")
                  if (typeSelect) {
                    if (file.type.startsWith("image/"))
                      typeSelect.value = "image"
                    else if (file.type.startsWith("audio/"))
                      typeSelect.value = "audio"
                    else if (file.type.startsWith("video/"))
                      typeSelect.value = "video"
                    else if (
                      file.type === "application/pdf" ||
                      file.name.toLowerCase().endsWith(".pdf")
                    )
                      typeSelect.value = "document"
                  }
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
            <div className="sm:col-span-2">
              <Textarea
                id="media-description"
                label="Description"
                placeholder="Description détaillée du média (optionnelle)"
                rows={4}
              />
            </div>
          </div>
          {progress > 0 && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-300"
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

              const title =
                document.querySelector("#media-title")?.value || file.name
              const mediaType =
                document.querySelector("#media-type")?.value || "image"
              const description =
                document.querySelector("#media-description")?.value || ""

              try {
                setIsUploading(true)
                setProgress(25)

                await uploadMedia(file, title, mediaType, description)

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
                notify(
                  error?.message || "Erreur lors du téléversement",
                  "error",
                )
              }
            }}
            disabled={isUploading}
          >
            {isUploading ? "Enregistrement en cours..." : "Enregistrer"}
          </Button>
        </Card>
      </>
    )
  }

  // ==========================================
  // MODE 2 : SIMULATION IMAGE IA
  // ==========================================
  if (mode === "ai") {
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
                  onError={(e) =>
                    handleImageError(e, media.find((x) => x.url)?.url)
                  }
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
  }

  // ==========================================
  // MODE 3 : SIMULATION PERSONNES
  // ==========================================
  if (mode === "people") {
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
                  src={
                    media.filter((m) => m.url)[i]?.url || media[0]?.url || ""
                  }
                  className="aspect-square w-full rounded-xl object-cover"
                  alt="Groupe de photos"
                  onError={(e) =>
                    handleImageError(
                      e,
                      media.filter((m) => m.url)[i]?.url || media[0]?.url,
                    )
                  }
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
  }

  // ==========================================
  // MODE 4 : TRANSCRIPTION AUDIO WHISPER (RÉELLE)
  // ==========================================
  if (mode === "transcription") {
    if (mediaLoading && audioMedia.length === 0) {
      return (
        <div className="py-12 text-center">
          <Loading label="Chargement de vos enregistrements audio..." />
        </div>
      )
    }

    return (
      <>
        <PageHeader
          title="Transcription audio Whisper"
          subtitle="Transcription automatique sécurisée en local avec Whisper (modèle base, CPU int8)."
          actions={
            <Link to="/media/upload">
              <Button variant="secondary">
                <Upload size={16} /> Ajouter un audio
              </Button>
            </Link>
          }
        />

        {audioMedia.length === 0 ? (
          <Empty
            title="Aucun fichier audio disponible"
            text="Vous n'avez pas encore téléversé d'enregistrement audio dans votre bibliothèque."
            action={
              <Link to="/media/upload">
                <Button>
                  <Upload size={16} /> Téléverser un fichier audio
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Colonne latérale : sélection du fichier et lecteur */}
            <Card className="flex flex-col justify-between p-5">
              <div>
                <SectionTitle title="Enregistrement audio" />

                <div className="mt-4">
                  <Select
                    label="Fichier audio sélectionné"
                    value={selectedAudioId}
                    onChange={(e) => handleSelectAudio(e.target.value)}
                    disabled={isTranscribing || isSavingTranscription}
                  >
                    {audioMedia.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title || "Enregistrement sans titre"}
                      </option>
                    ))}
                  </Select>
                </div>

                {activeAudioMedia && (
                  <div className="mt-4">
                    <b className="block text-sm text-slate-900 truncate">
                      {activeAudioMedia.title}
                    </b>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {activeAudioMedia.created_at
                        ? `Ajouté le ${new Date(activeAudioMedia.created_at).toLocaleDateString("fr-FR")}`
                        : "Fichier audio"}
                    </p>

                    {/* Vrai lecteur HTML5 audio */}
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Music size={14} />
                        <span>Écoute du fichier</span>
                      </div>
                      {activeAudioMedia.url ? (
                        <audio
                          key={activeAudioMedia.id}
                          controls
                          src={resolveAudioUrl(activeAudioMedia)}
                          className="w-full"
                          preload="metadata"
                        >
                          Votre navigateur ne supporte pas la lecture audio.
                        </audio>
                      ) : (
                        <p className="text-xs text-slate-400">
                          URL du fichier indisponible.
                        </p>
                      )}
                    </div>

                    {/* Aperçu de la description actuelle */}
                    {activeAudioMedia.description && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        <span className="font-semibold text-slate-700 block mb-1">
                          Description actuelle :
                        </span>
                        <p className="text-slate-600 line-clamp-3 italic">
                          « {activeAudioMedia.description} »
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bouton de déclenchement de la transcription Whisper */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Button
                  variant="ai"
                  className="w-full"
                  onClick={handleTranscribe}
                  disabled={
                    isTranscribing || isSavingTranscription || !activeAudioMedia
                  }
                >
                  {isTranscribing ? (
                    <>
                      <LoaderCircle className="animate-spin" size={16} />
                      Transcription en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Transcrire avec Whisper
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-xs text-slate-400">
                  Traitement local sécurisé sur CPU int8
                </p>
              </div>
            </Card>

            {/* Colonne principale : Éditeur et résultat */}
            <Card className="flex flex-col justify-between p-5 lg:col-span-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <SectionTitle title="Transcription Whisper" />
                  {isTranscribing && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600">
                      <LoaderCircle className="animate-spin" size={14} />
                      Analyse en cours...
                    </span>
                  )}
                </div>

                {/* État explicite de chargement */}
                {isTranscribing && (
                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3.5 text-violet-800">
                    <LoaderCircle
                      className="animate-spin shrink-0 text-violet-600"
                      size={20}
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        Transcription Whisper en cours d’exécution
                      </p>
                      <p className="text-xs text-violet-600">
                        Analyse audio locale par le modèle Whisper base.
                        Veuillez patienter...
                      </p>
                    </div>
                  </div>
                )}

                {/* Bannière d'erreur */}
                {transcriptionError && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Erreur de transcription</p>
                      <p className="mt-0.5 text-xs text-red-600">
                        {transcriptionError}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notification aucune parole détectée */}
                {noSpeechDetected && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>
                      Aucune parole détectée dans cet enregistrement audio.
                    </span>
                  </div>
                )}

                {/* Zone de texte éditable */}
                <Textarea
                  label="Texte transcrit (zone éditable)"
                  rows={10}
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  placeholder={
                    isTranscribing
                      ? "Transcription audio en cours par Whisper..."
                      : "Le texte issu de la transcription Whisper apparaîtra ici. Cliquez sur « Transcrire avec Whisper » pour analyser l'enregistrement audio sélectionné."
                  }
                  disabled={isTranscribing}
                />

                {/* Métadonnées de l'inférence Whisper */}
                {transcriptionMeta && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {transcriptionMeta.language && (
                      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                        Langue : {transcriptionMeta.language.toUpperCase()}
                      </Badge>
                    )}
                    {typeof transcriptionMeta.duration === "number" && (
                      <Badge className="border border-blue-200 bg-blue-50 text-blue-700">
                        Durée audio : {transcriptionMeta.duration.toFixed(1)}s
                      </Badge>
                    )}
                    {transcriptionMeta.model && (
                      <Badge className="border border-purple-200 bg-purple-50 text-purple-700">
                        Modèle : Whisper {transcriptionMeta.model}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Bouton d'enregistrement vers la description */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Button
                  onClick={handleOpenConfirmSave}
                  disabled={
                    !transcriptionText.trim() ||
                    isTranscribing ||
                    isSavingTranscription
                  }
                >
                  <Save size={16} /> Enregistrer la transcription
                </Button>
                {transcriptionText.trim() ? (
                  <span className="text-xs text-slate-500">
                    {transcriptionText.trim().split(/\s+/).length} mots ·
                    Cliquez sur Enregistrer pour mettre à jour la description
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Aucune transcription à enregistrer
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Modal de confirmation d'enregistrement */}
        <Modal
          open={isConfirmSaveModalOpen}
          onClose={handleCloseConfirmSave}
          title="Enregistrer la transcription"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={handleCloseConfirmSave}
                disabled={isSavingTranscription}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirmSaveTranscription}
                disabled={isSavingTranscription || !transcriptionText.trim()}
              >
                {isSavingTranscription
                  ? "Enregistrement..."
                  : "Confirmer et remplacer"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {saveTranscriptionError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>{saveTranscriptionError}</span>
              </div>
            )}
            <p className="text-sm text-slate-700">
              Voulez-vous enregistrer cette transcription comme nouvelle
              description du média{" "}
              <b className="font-semibold text-slate-900">
                « {activeAudioMedia?.title} »
              </b>{" "}
              ?
            </p>
            {activeAudioMedia?.description ? (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <span className="mb-1 block font-semibold">
                  ⚠️ Attention : Cette action remplacera la description actuelle
                  :
                </span>
                <p className="line-clamp-3 italic text-slate-700">
                  « {activeAudioMedia.description} »
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Cette transcription sera enregistrée dans les métadonnées de ce
                fichier audio.
              </p>
            )}
          </div>
        </Modal>
      </>
    )
  }

  // ==========================================
  // MODE 5 : DÉTAIL D'UN MÉDIA (AVEC MODIFICATION ET SUPPRESSION)
  // ==========================================
  if (mode === "detail") {
    // Condition de chargement : affiche le spinner si fetchLoading est actif,
    // ou si le store charge globalement sans qu'on ait déjà une erreur explicite
    const isLoading =
      fetchLoading || (!currentMedia && mediaLoading && !fetchError)

    if (isLoading) {
      return (
        <div className="py-12 text-center">
          <Loading label="Chargement du média..." />
        </div>
      )
    }

    if (!currentMedia) {
      return (
        <Empty
          title="Média introuvable"
          text={
            fetchError ||
            "Le média demandé n'existe pas, a été supprimé ou vous n'avez pas l'autorisation d'y accéder."
          }
          action={
            <Link to="/media">
              <Button variant="secondary">Retour à la bibliothèque</Button>
            </Link>
          }
        />
      )
    }

    const mediaType = currentMedia.media_type || currentMedia.type || "image"

    return (
      <>
        <Card className="mx-auto max-w-4xl overflow-hidden">
          {currentMedia.url ? (
            mediaType === "audio" ? (
              <div className="grid h-72 place-items-center bg-slate-100">
                <Music size={60} className="text-slate-400" />
                <audio
                  controls
                  src={currentMedia.url}
                  className="mt-4 w-3/4 max-w-md"
                >
                  Votre navigateur ne supporte pas la lecture audio.
                </audio>
              </div>
            ) : mediaType === "video" ? (
              <video
                controls
                src={currentMedia.url}
                className="max-h-32rem w-full bg-black object-contain"
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            ) : mediaType === "document" ? (
              <div className="grid h-72 place-items-center bg-slate-100">
                <FileText size={60} className="text-slate-400" />
                <p className="mt-2 text-sm text-slate-500">Document PDF</p>
              </div>
            ) : (
              <img
                src={currentMedia.url}
                className="max-h-32rem w-full object-cover"
                alt={currentMedia.title}
                onError={(e) => handleImageError(e, currentMedia.url)}
              />
            )
          ) : (
            <div className="grid h-72 place-items-center bg-slate-100">
              <Mic size={60} className="text-slate-300" />
            </div>
          )}

          <div className="p-6">
            <Badge>{mediaType.toUpperCase()}</Badge>
            <h1 className="mt-3 text-2xl font-extrabold">
              {currentMedia.title}
            </h1>
            {currentMedia.description && (
              <p className="mt-2 text-slate-600 whitespace-pre-wrap">
                {currentMedia.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={handleOpenEdit}
                aria-label="Modifier les métadonnées"
              >
                <Edit3 size={16} /> Modifier les métadonnées
              </Button>

              {currentMedia.url && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.open(currentMedia.url, "_blank", "noopener")
                  }
                  aria-label="Télécharger le fichier"
                >
                  <Download size={16} /> Télécharger
                </Button>
              )}

              <Button
                variant="danger"
                onClick={handleOpenDelete}
                aria-label="Supprimer le média"
              >
                <Trash2 size={16} /> Supprimer
              </Button>
            </div>
          </div>
        </Card>

        {/* Modal d'édition des métadonnées (PATCH JSON) */}
        <Modal
          open={isEditModalOpen}
          onClose={handleCloseEdit}
          title="Modifier les métadonnées"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={handleCloseEdit}
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {editError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>{editError}</span>
              </div>
            )}
            <Input
              label="Titre *"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre du média"
              disabled={isSaving}
              autoFocus
            />
            <Textarea
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description détaillée du média (optionnelle)"
              rows={4}
              disabled={isSaving}
            />
          </div>
        </Modal>

        {/* Modal de confirmation de suppression (DELETE) */}
        <Modal
          open={isDeleteModalOpen}
          onClose={handleCloseDelete}
          title="Supprimer ce média"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={handleCloseDelete}
                disabled={isDeleting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting
                  ? "Suppression en cours..."
                  : "Confirmer la suppression"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {deleteError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <p className="text-sm text-slate-700">
              Êtes-vous sûr de vouloir supprimer définitivement le média{" "}
              <b className="font-semibold text-slate-900">
                « {currentMedia.title} »
              </b>{" "}
              ?
            </p>
            <p className="text-xs text-slate-500">
              Cette action est irréversible. Le fichier sera physiquement effacé
              du serveur de stockage.
            </p>
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-semibold">Remarque :</span> Si ce média est
              associé à des entrées de votre journal, le fichier physique sera
              détaché de celles-ci.
            </div>
          </div>
        </Modal>
      </>
    )
  }

  // ==========================================
  // MODE 6 : BIBLIOTHÈQUE MULTIMÉDIA (LISTE)
  // ==========================================
  const list = media.filter((x) => {
    const titleMatch = (x.title || "").toLowerCase().includes(q.toLowerCase())
    const descMatch = (x.description || "")
      .toLowerCase()
      .includes(q.toLowerCase())
    return titleMatch || descMatch
  })

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
          placeholder="Rechercher par titre ou description..."
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

      {mediaLoading ? (
        <div className="py-12 text-center">
          <Loading label="Chargement de vos médias..." />
        </div>
      ) : list.length === 0 ? (
        <Empty
          title="Aucun média trouvé"
          description={
            q
              ? "Aucun résultat ne correspond à votre recherche."
              : "Commencez par ajouter votre premier média en cliquant sur le bouton « Ajouter »."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {list.map((x) => {
            const mediaType = x.media_type || x.type || "image"
            const dateDisplay = x.created_at
              ? new Date(x.created_at).toLocaleDateString("fr-FR")
              : x.date || ""

            return (
              <Link to={`/media/${x.id}`} key={x.id}>
                <Card className="h-full overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
                  {x.url ? (
                    mediaType === "audio" ? (
                      <div className="grid aspect-4/3 place-items-center bg-slate-100">
                        <Music className="text-slate-400" size={36} />
                      </div>
                    ) : mediaType === "video" ? (
                      <div className="grid aspect-4/3 place-items-center bg-slate-900 text-white">
                        <Film className="text-slate-400" size={36} />
                      </div>
                    ) : mediaType === "document" ? (
                      <div className="grid aspect-4/3 place-items-center bg-slate-100">
                        <FileText className="text-slate-400" size={36} />
                      </div>
                    ) : (
                      <img
                        src={x.url}
                        alt={x.title}
                        className="aspect-4/3 w-full object-cover"
                        onError={(e) => handleImageError(e, x.url)}
                      />
                    )
                  ) : (
                    <div className="grid aspect-4/3 place-items-center bg-slate-100">
                      <Mic className="text-slate-400" />
                    </div>
                  )}
                  <div className="p-4">
                    <b className="line-clamp-1">{x.title}</b>
                    <p className="mt-1 text-xs text-slate-400">
                      {mediaType.toUpperCase()}
                      {dateDisplay ? ` · ${dateDisplay}` : ""}
                    </p>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

export default MediaPage
