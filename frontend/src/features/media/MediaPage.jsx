import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  Upload,
  Sparkles,
  Mic,
  MicOff,
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
  RefreshCw,
  Wand2,
  Square,
  Layers,
  ArrowRight,
  Info,
  X,
  StopCircle,
} from "lucide-react"
import { useStore } from "../../store/AppStore"
import { mediaService, dataUrlToFile } from "../../services/mediaService"
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

// Résolution universelle pour tout type d'URL média (absolue, relative ou data URL)
function resolveMediaUrl(rawUrl) {
  if (!rawUrl) return ""
  if (
    rawUrl.startsWith("http://") ||
    rawUrl.startsWith("https://") ||
    rawUrl.startsWith("data:") ||
    rawUrl.startsWith("blob:")
  ) {
    return rawUrl
  }
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
  const cleanBase = API_BASE_URL.replace(/\/api\/?$/, "")
  return `${cleanBase}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
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

  // --- States pour l'Atelier Image IA (Mode 2 : mode === "ai") ---
  const [aiSubTab, setAiSubTab] = useState("create") // "create" | "edit"

  // Mode A : Création T2I
  const [createPrompt, setCreatePrompt] = useState("")
  const [createStyle, setCreateStyle] = useState("none")
  const [createAspectRatio, setCreateAspectRatio] = useState("1:1")
  const [createSeed, setCreateSeed] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const [generatedResult, setGeneratedResult] = useState(null)

  // Mode B : Modification I2I
  const [selectedSourceMediaId, setSelectedSourceMediaId] = useState("")
  const [editPrompt, setEditPrompt] = useState("")
  const [editSeed, setEditSeed] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [aiEditError, setAiEditError] = useState(null)
  const [editedResult, setEditedResult] = useState(null)

  // Enregistrement volontaire en galerie
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveTarget, setSaveTarget] = useState(null)
  const [saveTitle, setSaveTitle] = useState("")
  const [saveDescription, setSaveDescription] = useState("")
  const [isSavingAiMedia, setIsSavingAiMedia] = useState(false)
  const [saveAiMediaError, setSaveAiMediaError] = useState(null)

  // Enregistrement vocal (Microphone & Whisper)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingTarget, setRecordingTarget] = useState(null) // "create" | "edit"
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false)
  const [voiceError, setVoiceError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const activeRequestIdRef = useRef(0)

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      clearInterval(recordingTimerRef.current)
    }
  }, [])

  // Médias de type image pour le mode édition IA
  const imageMediaList = media.filter(
    (x) => (x.media_type || x.type) === "image",
  )

  useEffect(() => {
    if (mode === "ai" && aiSubTab === "edit" && imageMediaList.length > 0) {
      if (
        !selectedSourceMediaId ||
        !imageMediaList.some(
          (m) => String(m.id) === String(selectedSourceMediaId),
        )
      ) {
        setSelectedSourceMediaId(String(imageMediaList[0].id))
      }
    }
  }, [mode, aiSubTab, imageMediaList.length, selectedSourceMediaId])

  const activeSourceMedia =
    imageMediaList.find(
      (x) => String(x.id) === String(selectedSourceMediaId),
    ) || imageMediaList[0]

  // Détection des types MIME audio supportés par le navigateur
  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return ""
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
    ]
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t
      }
    }
    return ""
  }

  // Démarrer l'enregistrement vocal pour dictée du prompt
  const startVoiceRecording = async (target) => {
    if (isRecordingVoice || isTranscribingVoice) return
    setVoiceError(null)

    if (
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      const msg =
        "L'enregistrement vocal n'est pas pris en charge par votre navigateur."
      setVoiceError(msg)
      notify(msg, "error")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        // Arrêt propre des flux audio
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop())
          audioStreamRef.current = null
        }
        clearInterval(recordingTimerRef.current)

        const chunks = audioChunksRef.current
        if (!chunks || chunks.length === 0) {
          setIsRecordingVoice(false)
          return
        }

        const actualMime = recorder.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunks, { type: actualMime })
        if (blob.size < 100) {
          setIsRecordingVoice(false)
          return
        }

        setIsRecordingVoice(false)
        setIsTranscribingVoice(true)
        setVoiceError(null)

        try {
          const ext = actualMime.includes("ogg")
            ? "ogg"
            : actualMime.includes("mp4")
              ? "m4a"
              : actualMime.includes("wav")
                ? "wav"
                : "webm"
          const audioFile = new File(
            [blob],
            `voice_prompt_${Date.now()}.${ext}`,
            { type: actualMime },
          )

          const resp = await mediaService.transcribeVoicePrompt(audioFile)
          if (!isMountedRef.current) return

          const text = resp?.text ? resp.text.trim() : ""
          if (!text) {
            notify("Aucune parole audible détectée par Whisper.", "info")
          } else {
            notify("Instruction vocale transcrite avec succès !")
            if (target === "create") {
              setCreatePrompt((prev) =>
                prev ? `${prev.trim()} ${text}` : text,
              )
            } else if (target === "edit") {
              setEditPrompt((prev) => (prev ? `${prev.trim()} ${text}` : text))
            }
          }
        } catch (err) {
          if (!isMountedRef.current) return
          let msg = err?.message || "Erreur lors de la transcription vocale."
          if (err?.status === 422 || err?.code === "no_speech_detected") {
            msg = "Aucune parole audible détectée par Whisper."
          } else if (err?.status === 400 && err?.code === "duration_exceeded") {
            msg =
              "L'enregistrement vocal dépasse la durée maximale autorisée de 30 secondes."
          } else if (err?.status === 503) {
            msg =
              "Le service de transcription Whisper est temporairement indisponible."
          }
          setVoiceError(msg)
          notify(msg, "error")
        } finally {
          if (isMountedRef.current) {
            setIsTranscribingVoice(false)
          }
        }
      }

      recorder.start(250)
      setIsRecordingVoice(true)
      setRecordingTarget(target)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            stopVoiceRecording()
            return 30
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error("Microphone access error:", err)
      let msg = "Impossible d'accéder au microphone."
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        msg =
          "Autorisation microphone refusée. Veuillez activer l'accès au micro dans votre navigateur."
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        msg = "Aucun microphone détecté sur cet appareil."
      }
      setVoiceError(msg)
      notify(msg, "error")
    }
  }

  // Arrêter l'enregistrement et transcrire
  const stopVoiceRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordingTimerRef.current)
  }

  // Annuler l'enregistrement sans transcrire
  const cancelVoiceRecording = () => {
    clearInterval(recordingTimerRef.current)
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop())
      audioStreamRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
    audioChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingSeconds(0)
    setRecordingTarget(null)
  }

  // Traduction utilisateur des erreurs de l'API IA
  const formatAiError = (err) => {
    if (err?.code === "provider_not_configured" || err?.status === 503) {
      return "Le service d'images IA n'est pas activé sur le serveur (clé API POLLINATIONS_API_KEY non configurée)."
    }
    if (err?.code === "provider_rate_limited" || err?.status === 429) {
      return "La limite de requêtes auprès du fournisseur IA a été atteinte. Veuillez patienter quelques instants."
    }
    if (err?.code === "provider_auth_error") {
      return "Échec d'authentification auprès du fournisseur d'images (clé API non valide)."
    }
    if (err?.code === "provider_insufficient_credits") {
      return "Crédits ou quota insuffisants auprès du service d'images IA."
    }
    if (err?.code === "provider_timeout" || err?.status === 504) {
      return "Le fournisseur d'images a mis trop de temps à répondre (timeout réseau). Veuillez réessayer."
    }
    if (err?.code === "invalid_prompt" || err?.status === 400) {
      return (
        err?.message ||
        "Le prompt fourni est invalide ou dépasse la limite autorisée de 1000 caractères."
      )
    }
    if (err?.code === "invalid_source_image") {
      return (
        err?.message ||
        "L'image source sélectionnée n'est pas valide pour une modification IA."
      )
    }
    if (err?.status === 401) {
      return "Votre session a expiré. Veuillez vous reconnecter."
    }
    if (err?.status === 404) {
      return "L'image source est introuvable ou vous n'avez pas l'autorisation d'y accéder."
    }
    return (
      err?.message ||
      "Une erreur est survenue lors de la communication avec le service d'images IA."
    )
  }

  // Action : Générer une image
  const handleGenerateImage = async () => {
    const trimmed = createPrompt.trim()
    if (!trimmed) {
      setGenerationError(
        "Veuillez saisir une description ou dicter une instruction pour générer une image.",
      )
      notify("Veuillez saisir une description pour l'image.", "error")
      return
    }
    if (trimmed.length > 1000) {
      setGenerationError(
        `Le prompt dépasse la limite maximale de 1000 caractères (${trimmed.length} fournis).`,
      )
      return
    }
    if (isGenerating) return

    setIsGenerating(true)
    setGenerationError(null)
    const requestId = ++activeRequestIdRef.current

    try {
      const res = await mediaService.generateAiImage({
        prompt: trimmed,
        style: createStyle,
        aspect_ratio: createAspectRatio,
        seed: createSeed,
      })

      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return

      setGeneratedResult(res)
      notify("Image générée avec succès !")
    } catch (err) {
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return
      const userMsg = formatAiError(err)
      setGenerationError(userMsg)
      notify(userMsg, "error")
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setIsGenerating(false)
      }
    }
  }

  // Action : Modifier une image existante
  const handleEditImage = async () => {
    if (!activeSourceMedia) {
      setAiEditError("Veuillez sélectionner une image source dans votre galerie.")
      notify("Veuillez sélectionner une image source.", "error")
      return
    }
    const trimmed = editPrompt.trim()
    if (!trimmed) {
      setAiEditError("Veuillez décrire la modification souhaitée sur cette image.")
      notify("Veuillez décrire la modification souhaitée.", "error")
      return
    }
    if (trimmed.length > 1000) {
      setAiEditError(
        `L'instruction dépasse la limite maximale de 1000 caractères (${trimmed.length} fournis).`,
      )
      return
    }
    if (isEditing) return

    setIsEditing(true)
    setAiEditError(null)
    const requestId = ++activeRequestIdRef.current

    try {
      const res = await mediaService.editAiImage(activeSourceMedia.id, {
        prompt: trimmed,
        seed: editSeed,
      })

      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return

      setEditedResult(res)
      notify("Image modifiée avec succès avec l'IA !")
    } catch (err) {
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return
      const userMsg = formatAiError(err)
      setAiEditError(userMsg)
      notify(userMsg, "error")
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setIsEditing(false)
      }
    }
  }

  // Ouverture du modal de sauvegarde volontaire
  const handleOpenSaveModal = (dataUrl, defaultTitle, defaultDescription) => {
    if (!dataUrl) return
    setSaveTarget({ dataUrl, defaultTitle, defaultDescription })
    setSaveTitle(defaultTitle || "Création IA")
    setSaveDescription(defaultDescription || "")
    setSaveAiMediaError(null)
    setIsSaveModalOpen(true)
  }

  const handleCloseSaveModal = () => {
    if (isSavingAiMedia) return
    setIsSaveModalOpen(false)
    setSaveAiMediaError(null)
  }

  // Confirmation de l'enregistrement de l'image générée en base de données
  const handleConfirmSaveAiMedia = async () => {
    if (!saveTarget?.dataUrl) return
    if (!saveTitle.trim()) {
      setSaveAiMediaError("Le titre du média ne peut pas être vide.")
      return
    }
    if (isSavingAiMedia) return

    setIsSavingAiMedia(true)
    setSaveAiMediaError(null)

    try {
      const savedMedia = await mediaService.saveGeneratedImage(
        saveTarget.dataUrl,
        {
          title: saveTitle.trim(),
          description: saveDescription.trim(),
        },
      )

      if (!isMountedRef.current) return

      setMedia((prev) => [savedMedia, ...prev])
      notify("Image enregistrée dans votre bibliothèque avec succès !")
      setIsSaveModalOpen(false)
      setSaveTarget(null)
    } catch (err) {
      if (!isMountedRef.current) return
      const msg =
        err?.message || "Erreur lors de l'enregistrement dans la bibliothèque."
      setSaveAiMediaError(msg)
      notify(msg, "error")
    } finally {
      if (isMountedRef.current) {
        setIsSavingAiMedia(false)
      }
    }
  }

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
  // MODE 2 : ATELIER IMAGE IA (RÉEL & SÉCURISÉ)
  // ==========================================
  if (mode === "ai") {
    return (
      <>
        <PageHeader
          title="Atelier Image IA"
          subtitle="Générez de nouvelles créations visuelles ou sublimez vos photos existantes avec l'IA."
          actions={
            <Link to="/media">
              <Button variant="secondary">
                <ImageIcon size={16} /> Ma bibliothèque
              </Button>
            </Link>
          }
        />

        {/* Navigation des sous-modes : Créer ou Modifier */}
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
          <Button
            variant={aiSubTab === "create" ? "primary" : "secondary"}
            onClick={() => {
              setAiSubTab("create")
              setGenerationError(null)
              setVoiceError(null)
            }}
            className="flex items-center gap-2"
          >
            <Sparkles size={16} />
            Créer une image
          </Button>
          <Button
            variant={aiSubTab === "edit" ? "primary" : "secondary"}
            onClick={() => {
              setAiSubTab("edit")
              setAiEditError(null)
              setVoiceError(null)
            }}
            className="flex items-center gap-2"
          >
            <Wand2 size={16} />
            Modifier une photo
            {imageMediaList.length > 0 && (
              <Badge className="ml-1 bg-violet-100 text-violet-800">
                {imageMediaList.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Bandeau d'enregistrement vocal en cours (Microphone) */}
        {isRecordingVoice && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3 text-red-700">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex size-3 rounded-full bg-red-600"></span>
              </span>
              <div>
                <p className="text-sm font-bold">
                  Enregistrement vocal en cours ({recordingSeconds}s / 30s)
                </p>
                <p className="text-xs text-red-600">
                  Parlez distinctement pour dicter votre instruction à Whisper...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                onClick={stopVoiceRecording}
                className="!py-1.5 !px-3 text-xs"
              >
                <StopCircle size={14} /> Terminer et transcrire
              </Button>
              <Button
                variant="ghost"
                onClick={cancelVoiceRecording}
                className="!py-1.5 !px-3 text-xs text-slate-600"
              >
                <X size={14} /> Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Bandeau de transcription Whisper en cours */}
        {isTranscribingVoice && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-800 shadow-sm">
            <LoaderCircle
              className="animate-spin text-violet-600 shrink-0"
              size={20}
            />
            <div>
              <p className="text-sm font-bold">
                Transcription Whisper en cours d’exécution
              </p>
              <p className="text-xs text-violet-600">
                Traitement sécurisé de votre voix par le modèle Whisper local...
              </p>
            </div>
          </div>
        )}

        {/* Message d'erreur vocal */}
        {voiceError && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{voiceError}</span>
            </div>
            <Button
              variant="ghost"
              className="!p-1 text-amber-700"
              onClick={() => setVoiceError(null)}
              aria-label="Fermer l'alerte"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {/* ======================================================== */}
        {/* SOUS-MODE A : CRÉER UNE NOUVELLE IMAGE (T2I)              */}
        {/* ======================================================== */}
        {aiSubTab === "create" && (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            {/* Colonne gauche : Formulaire de prompt & options */}
            <Card className="flex flex-col justify-between p-5 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionTitle title="Génération depuis un prompt" />
                  <Badge className="bg-violet-50 text-violet-700">
                    Flux.1 Schnell
                  </Badge>
                </div>

                {/* Champ Prompt Texte */}
                <div>
                  <Textarea
                    label="Description de l'image (Prompt) *"
                    value={createPrompt}
                    onChange={(e) => {
                      setCreatePrompt(e.target.value)
                      if (generationError) setGenerationError(null)
                    }}
                    placeholder="Décrivez précisément l'image que vous souhaitez générer (ex: Un vieux phare sur une côte rocheuse bretonne au crépuscule, vagues argentées, ambiance mystique)..."
                    rows={4}
                    disabled={
                      isGenerating || isRecordingVoice || isTranscribingVoice
                    }
                  />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                    <span>Soignez les détails, l'ambiance et la lumière</span>
                    <span
                      className={
                        createPrompt.length > 900
                          ? "font-bold text-amber-600"
                          : ""
                      }
                    >
                      {createPrompt.length} / 1000
                    </span>
                  </div>
                </div>

                {/* Bouton Microphone Whisper */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mic size={15} className="text-violet-600 shrink-0" />
                      <span>Vous préférez parler ? Dictez votre idée</span>
                    </div>
                    <Button
                      variant={
                        isRecordingVoice && recordingTarget === "create"
                          ? "danger"
                          : "secondary"
                      }
                      onClick={() => {
                        if (isRecordingVoice && recordingTarget === "create") {
                          stopVoiceRecording()
                        } else {
                          startVoiceRecording("create")
                        }
                      }}
                      disabled={
                        isGenerating ||
                        isTranscribingVoice ||
                        (isRecordingVoice && recordingTarget !== "create")
                      }
                      className="!py-1.5 !px-3 text-xs"
                    >
                      {isRecordingVoice && recordingTarget === "create" ? (
                        <>
                          <StopCircle size={14} /> Stop ({recordingSeconds}s)
                        </>
                      ) : (
                        <>
                          <Mic size={14} className="text-violet-600" /> Dicter
                          (Whisper)
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Options de style & format supportées par Django */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Style visuel"
                    value={createStyle}
                    onChange={(e) => setCreateStyle(e.target.value)}
                    disabled={isGenerating}
                  >
                    <option value="none">Aucun (naturel)</option>
                    <option value="photographie réaliste">
                      Photographie réaliste
                    </option>
                    <option value="aquarelle">Aquarelle douce</option>
                    <option value="art numérique">Art numérique</option>
                    <option value="cinématique">Cinématique 35mm</option>
                    <option value="anime">Anime / Manga</option>
                    <option value="peinture à l'huile">
                      Peinture à l'huile
                    </option>
                    <option value="minimaliste">Minimaliste épuré</option>
                    <option value="cyberpunk">Cyberpunk néon</option>
                  </Select>

                  <Select
                    label="Format / Ratio"
                    value={createAspectRatio}
                    onChange={(e) => setCreateAspectRatio(e.target.value)}
                    disabled={isGenerating}
                  >
                    <option value="1:1">1:1 — Carré (1024×1024)</option>
                    <option value="16:9">16:9 — Paysage (1280×720)</option>
                    <option value="4:5">4:5 — Portrait (816×1024)</option>
                    <option value="9:16">9:16 — Story (720×1280)</option>
                  </Select>
                </div>

                {/* Graine optionnelle pour reproductibilité */}
                <div>
                  <Input
                    label="Graine / Seed (optionnel)"
                    type="number"
                    value={createSeed}
                    onChange={(e) => setCreateSeed(e.target.value)}
                    placeholder="Laisser vide pour un résultat aléatoire"
                    disabled={isGenerating}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Une même graine avec un prompt identique produit un résultat
                    reproductible.
                  </p>
                </div>

                {/* Alerte d'erreur de génération */}
                {generationError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        size={18}
                        className="shrink-0 mt-0.5 text-red-600"
                      />
                      <div>
                        <p className="font-semibold">Échec de la génération</p>
                        <p className="mt-0.5 text-xs text-red-600">
                          {generationError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton d'action Générer */}
              <div className="pt-4">
                <Button
                  className="w-full justify-center !py-3 shadow-md"
                  onClick={handleGenerateImage}
                  disabled={
                    isGenerating ||
                    isRecordingVoice ||
                    isTranscribingVoice ||
                    !createPrompt.trim()
                  }
                >
                  {isGenerating ? (
                    <>
                      <LoaderCircle className="animate-spin" size={18} />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Générer une image
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Colonne droite : Prévisualisation éphémère */}
            <Card className="flex min-h-[460px] flex-col overflow-hidden">
              {isGenerating ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <LoaderCircle className="size-8 animate-spin" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Création de votre image par l'IA
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Communication sécurisée avec Flux.1 Schnell via le backend
                    Django. Veuillez patienter quelques secondes...
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    <Sparkles size={13} /> Modèle Flux.1 Schnell
                  </span>
                </div>
              ) : generatedResult ? (
                <div className="flex flex-1 flex-col justify-between">
                  {/* Image générée */}
                  <div className="relative flex flex-1 items-center justify-center bg-slate-950 p-3">
                    <img
                      src={generatedResult.image}
                      alt={generatedResult.prompt}
                      className="max-h-[520px] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                    />
                    <div className="absolute top-5 left-5 flex gap-2">
                      <Badge className="bg-slate-900/80 text-white backdrop-blur">
                        {createAspectRatio}
                      </Badge>
                      <Badge className="bg-violet-600/90 text-white backdrop-blur">
                        Flux.1 Schnell
                      </Badge>
                    </div>
                  </div>

                  {/* Barre d'actions sous l'image */}
                  <div className="border-t border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="max-w-md">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Aperçu éphémère (non enregistré)
                        </span>
                        <p className="truncate text-xs text-slate-600 italic">
                          « {generatedResult.prompt} »
                        </p>
                      </div>
                      <span className="text-xs text-emerald-600 font-semibold">
                        ✓ Prêt à enregistrer
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <Button
                        onClick={() =>
                          handleOpenSaveModal(
                            generatedResult.image,
                            `Création IA - ${createPrompt.trim().slice(0, 35)}`,
                            createPrompt.trim(),
                          )
                        }
                        className="flex-1 sm:flex-none"
                      >
                        <Save size={16} /> Enregistrer dans ma bibliothèque
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const link = document.createElement("a")
                          link.href = generatedResult.image
                          link.download = `creation_ia_${Date.now()}.jpg`
                          link.click()
                        }}
                      >
                        <Download size={16} /> Télécharger
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleGenerateImage}
                        disabled={isGenerating}
                      >
                        <RefreshCw size={16} /> Régénérer
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-violet-50 text-violet-500">
                    <Sparkles size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Votre création visuelle apparaîtra ici
                  </h3>
                  <p className="mt-1.5 max-w-md text-sm text-slate-500">
                    Saisissez une description textuelle dans le formulaire ou
                    dictez vos idées au micro grâce à la transcription Whisper.
                  </p>

                  {/* Suggestions d'inspiration rapide */}
                  <div className="mt-6 w-full max-w-md space-y-2 text-left">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Idées pour démarrer :
                    </span>
                    {[
                      "Un chat astronaute contemplant la Terre depuis une station orbitale",
                      "Une ruelle pavée de Sidi Bou Saïd sous une pluie dorée de fin d'après-midi",
                      "Un jardin zen japonais minimaliste avec des cerisiers en fleurs sous la brume",
                    ].map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCreatePrompt(suggestion)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left text-xs text-slate-700 transition hover:border-violet-300 hover:bg-violet-50/50"
                      >
                        💡 « {suggestion} »
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ======================================================== */}
        {/* SOUS-MODE B : MODIFIER UNE IMAGE EXISTANTE (I2I)           */}
        {/* ======================================================== */}
        {aiSubTab === "edit" && (
          <div className="space-y-6">
            {imageMediaList.length === 0 ? (
              <Empty
                title="Aucune image disponible dans votre bibliothèque"
                text="Pour modifier une photo avec l'IA, commencez par téléverser une image dans votre bibliothèque multimédia."
                action={
                  <Link to="/media/upload">
                    <Button>
                      <Upload size={16} /> Téléverser une image
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                {/* Sélecteur visuel d'image source */}
                <Card className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        1. Choisissez l'image à transformer
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sélectionnez l'une de vos photos enregistrées. Le fichier
                        original restera strictement intact.
                      </p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700">
                      Original préservé
                    </Badge>
                  </div>

                  {/* Galerie miniature cliquable */}
                  <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {imageMediaList.map((item) => {
                      const isSelected =
                        String(item.id) === String(activeSourceMedia?.id)
                      const itemUrl = resolveMediaUrl(item.url)

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedSourceMediaId(String(item.id))
                            setEditedResult(null)
                            setAiEditError(null)
                          }}
                          className={`group relative shrink-0 rounded-xl overflow-hidden border-2 text-left transition ${
                            isSelected
                              ? "border-violet-600 ring-4 ring-violet-100 shadow-md scale-102"
                              : "border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={itemUrl}
                            alt={item.title}
                            className="size-20 object-cover sm:size-24"
                            onError={(e) => handleImageError(e, item.url)}
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 p-1">
                            <p className="truncate text-[10px] font-semibold text-white">
                              {item.title}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-violet-600 text-white shadow">
                              <CheckCircle2 size={12} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Card>

                {/* Atelier de modification : Contrôles + Comparaison */}
                <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
                  {/* Colonne gauche : Formulaire de modification */}
                  <Card className="flex flex-col justify-between p-5 space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionTitle title="Instruction de modification" />
                        <Badge className="bg-violet-50 text-violet-700">
                          Flux.1 Kontext
                        </Badge>
                      </div>

                      {/* Récapitulatif image source */}
                      {activeSourceMedia && (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <img
                            src={resolveMediaUrl(activeSourceMedia.url)}
                            alt={activeSourceMedia.title}
                            className="size-12 rounded-lg object-cover"
                            onError={(e) =>
                              handleImageError(e, activeSourceMedia.url)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                              Image source sélectionnée
                            </span>
                            <p className="truncate text-sm font-bold text-slate-900">
                              {activeSourceMedia.title}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Champ instruction de retouche */}
                      <div>
                        <Textarea
                          label="Que souhaitez-vous modifier ? *"
                          value={editPrompt}
                          onChange={(e) => {
                            setEditPrompt(e.target.value)
                            if (aiEditError) setAiEditError(null)
                          }}
                          placeholder="Expliquez les changements (ex: Ajouter un chapeau d'aventurier vintage, transformer l'arrière-plan en plage tropicale au crépuscule)..."
                          rows={4}
                          disabled={
                            isEditing ||
                            isRecordingVoice ||
                            isTranscribingVoice
                          }
                        />
                        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                          <span>
                            Décrivez les ajouts, remplacements ou retouches
                          </span>
                          <span
                            className={
                              editPrompt.length > 900
                                ? "font-bold text-amber-600"
                                : ""
                            }
                          >
                            {editPrompt.length} / 1000
                          </span>
                        </div>
                      </div>

                      {/* Bouton Microphone Whisper */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mic
                              size={15}
                              className="text-violet-600 shrink-0"
                            />
                            <span>Dicter la modification</span>
                          </div>
                          <Button
                            variant={
                              isRecordingVoice && recordingTarget === "edit"
                                ? "danger"
                                : "secondary"
                            }
                            onClick={() => {
                              if (
                                isRecordingVoice &&
                                recordingTarget === "edit"
                              ) {
                                stopVoiceRecording()
                              } else {
                                startVoiceRecording("edit")
                              }
                            }}
                            disabled={
                              isEditing ||
                              isTranscribingVoice ||
                              (isRecordingVoice && recordingTarget !== "edit")
                            }
                            className="!py-1.5 !px-3 text-xs"
                          >
                            {isRecordingVoice && recordingTarget === "edit" ? (
                              <>
                                <StopCircle size={14} /> Stop (
                                {recordingSeconds}s)
                              </>
                            ) : (
                              <>
                                <Mic size={14} className="text-violet-600" />{" "}
                                Dicter (Whisper)
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Graine optionnelle */}
                      <div>
                        <Input
                          label="Graine / Seed (optionnel)"
                          type="number"
                          value={editSeed}
                          onChange={(e) => setEditSeed(e.target.value)}
                          placeholder="Laisser vide pour aléatoire"
                          disabled={isEditing}
                        />
                      </div>

                      {/* Alerte d'erreur de retouche */}
                      {aiEditError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                          <div className="flex items-start gap-2">
                            <AlertCircle
                              size={18}
                              className="shrink-0 mt-0.5 text-red-600"
                            />
                            <div>
                              <p className="font-semibold">
                                Échec de la modification
                              </p>
                              <p className="mt-0.5 text-xs text-red-600">
                                {aiEditError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bouton d'action Modifier */}
                    <div className="pt-4">
                      <Button
                        className="w-full justify-center !py-3 shadow-md"
                        onClick={handleEditImage}
                        disabled={
                          isEditing ||
                          isRecordingVoice ||
                          isTranscribingVoice ||
                          !editPrompt.trim() ||
                          !activeSourceMedia
                        }
                      >
                        {isEditing ? (
                          <>
                            <LoaderCircle className="animate-spin" size={18} />
                            Modification IA en cours...
                          </>
                        ) : (
                          <>
                            <Wand2 size={18} />
                            Appliquer la modification
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>

                  {/* Colonne droite : Comparaison Avant / Après */}
                  <Card className="flex min-h-[460px] flex-col overflow-hidden">
                    {isEditing ? (
                      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                        <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                          <LoaderCircle className="size-8 animate-spin" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          Transformation en cours par Flux.1 Kontext Pro
                        </h3>
                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                          L'IA analyse l'image originale et applique vos
                          instructions contextuelles sans dénaturer la scène...
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                          <Wand2 size={13} /> Modèle Flux.1 Kontext Pro
                        </span>
                      </div>
                    ) : editedResult ? (
                      <div className="flex flex-1 flex-col justify-between">
                        {/* Zone de comparaison responsive */}
                        <div className="p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <Badge className="bg-violet-100 text-violet-800">
                              Comparaison Avant / Après
                            </Badge>
                            <span className="text-xs text-emerald-600 font-semibold">
                              ✓ Fichier source préservé
                            </span>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Colonne Avant (Original) */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <Badge className="bg-slate-200 text-slate-700">
                                  AVANT (ORIGINAL)
                                </Badge>
                                <span className="text-[11px] text-slate-400">
                                  Source intacte
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-lg bg-black">
                                <img
                                  src={resolveMediaUrl(activeSourceMedia.url)}
                                  alt={activeSourceMedia.title}
                                  className="aspect-square w-full object-cover"
                                  onError={(e) =>
                                    handleImageError(e, activeSourceMedia.url)
                                  }
                                />
                              </div>
                              <p className="mt-2 truncate text-xs font-bold text-slate-800">
                                {activeSourceMedia.title}
                              </p>
                            </div>

                            {/* Colonne Après (Résultat IA) */}
                            <div className="rounded-xl border-2 border-violet-300 bg-violet-50/40 p-3 shadow-sm">
                              <div className="mb-2 flex items-center justify-between">
                                <Badge className="bg-violet-600 text-white">
                                  APRÈS (RÉSULTAT IA)
                                </Badge>
                                <span className="text-[11px] font-semibold text-violet-600">
                                  Aperçu éphémère
                                </span>
                              </div>
                              <div className="overflow-hidden rounded-lg bg-black">
                                <img
                                  src={editedResult.image}
                                  alt={editedResult.prompt}
                                  className="aspect-square w-full object-cover"
                                />
                              </div>
                              <p className="mt-2 truncate text-xs font-bold text-slate-900">
                                « {editedResult.prompt} »
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Barre d'action sous la comparaison */}
                        <div className="border-t border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">
                              L'enregistrement créera un nouveau média dans
                              votre bibliothèque sans toucher à la photo
                              d'origine.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() =>
                                  handleOpenSaveModal(
                                    editedResult.image,
                                    `${activeSourceMedia.title} (Modifié IA)`,
                                    `Modifié par IA avec l'instruction : ${editPrompt.trim()}`,
                                  )
                                }
                              >
                                <Save size={16} /> Enregistrer comme nouvelle
                                image
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  const link = document.createElement("a")
                                  link.href = editedResult.image
                                  link.download = `edit_ia_${Date.now()}.jpg`
                                  link.click()
                                }}
                              >
                                <Download size={16} /> Télécharger
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* État initial : aperçu de l'original sélectionné */
                      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                        {activeSourceMedia ? (
                          <div className="max-w-sm space-y-3">
                            <div className="relative mx-auto overflow-hidden rounded-2xl border border-slate-200 shadow-md">
                              <img
                                src={resolveMediaUrl(activeSourceMedia.url)}
                                alt={activeSourceMedia.title}
                                className="aspect-square w-64 object-cover"
                                onError={(e) =>
                                  handleImageError(e, activeSourceMedia.url)
                                }
                              />
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-slate-900/80 text-white backdrop-blur">
                                  Image source prête
                                </Badge>
                              </div>
                            </div>
                            <h3 className="font-bold text-slate-900">
                              {activeSourceMedia.title}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Saisissez vos instructions dans le formulaire à
                              gauche ou dictez-les au micro pour transformer
                              cette image avec l'IA.
                            </p>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            <ImageIcon size={40} className="mx-auto mb-2" />
                            <p>Sélectionnez une image ci-dessus</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal d'enregistrement volontaire dans la galerie */}
        <Modal
          open={isSaveModalOpen}
          onClose={handleCloseSaveModal}
          title="Enregistrer dans votre bibliothèque"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={handleCloseSaveModal}
                disabled={isSavingAiMedia}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirmSaveAiMedia}
                disabled={isSavingAiMedia || !saveTitle.trim()}
              >
                {isSavingAiMedia ? (
                  <>
                    <LoaderCircle className="animate-spin" size={16} />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Confirmer et enregistrer
                  </>
                )}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {saveAiMediaError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="shrink-0" />
                <span>{saveAiMediaError}</span>
              </div>
            )}

            {saveTarget?.dataUrl && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <img
                  src={saveTarget.dataUrl}
                  alt="Aperçu"
                  className="size-16 rounded-lg object-cover shadow-sm"
                />
                <div className="min-w-0 flex-1 text-xs text-slate-600">
                  <p className="font-bold text-slate-900">
                    Nouvelle image Media
                  </p>
                  <p className="truncate text-slate-500 mt-0.5">
                    Format : Image JPEG · Générée par IA
                  </p>
                </div>
              </div>
            )}

            <Input
              label="Titre de l'image *"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Donnez un titre à votre création"
              disabled={isSavingAiMedia}
              autoFocus
            />

            <Textarea
              label="Description (optionnelle)"
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Détails du prompt ou notes personnelles..."
              rows={3}
              disabled={isSavingAiMedia}
            />

            <div className="rounded-xl bg-violet-50 p-3 text-xs text-violet-800">
              <span className="font-semibold">Information :</span> Cette image
              sera ajoutée comme un nouveau fichier indépendant dans votre
              galerie. L'image originale n'est jamais altérée ni écrasée.
            </div>
          </div>
        </Modal>
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
