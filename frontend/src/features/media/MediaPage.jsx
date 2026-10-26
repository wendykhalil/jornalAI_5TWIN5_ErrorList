import { useState, useEffect } from "react"
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

export function MediaPage({ mode = "library" }) {
  const { media, setMedia, mediaLoading, notify, uploadMedia } = useStore()
  const nav = useNavigate()
  const { id } = useParams()

  // --- States pour la bibliothèque et les modes démo ---
  const [q, setQ] = useState("")
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [prompt, setPrompt] = useState(
    "Une plage tunisienne paisible au coucher du soleil"
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
            : item
        )
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
        previous.filter(
          (item) => String(item.id) !== String(currentMedia.id)
        )
      )

      notify("Média supprimé avec succès")
      setIsDeleteModalOpen(false)
      nav("/media")
    } catch (err) {
      // En cas d'erreur, le média est conservé dans l'affichage
      const message =
        err?.message || "Erreur lors de la suppression du média"
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
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} Mo · Cliquez pour changer de fichier
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
                    if (file.type.startsWith("image/")) typeSelect.value = "image"
                    else if (file.type.startsWith("audio/")) typeSelect.value = "audio"
                    else if (file.type.startsWith("video/")) typeSelect.value = "video"
                    else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) typeSelect.value = "document"
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
                  "error"
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
                    media.filter((m) => m.url)[i]?.url ||
                    media[0]?.url ||
                    ""
                  }
                  className="aspect-square w-full rounded-xl object-cover"
                  alt="Groupe de photos"
                  onError={(e) =>
                    handleImageError(
                      e,
                      media.filter((m) => m.url)[i]?.url || media[0]?.url
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
            )
          )}
        </div>
      </>
    )
  }

  // ==========================================
  // MODE 4 : SIMULATION TRANSCRIPTION
  // ==========================================
  if (mode === "transcription") {
    const audioMedia = media.filter(
      (x) => (x.media_type || x.type) === "audio"
    )

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
              {audioMedia.length > 0 ? (
                audioMedia.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))
              ) : (
                <option value="">Aucun fichier audio disponible</option>
              )}
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
              {["priorités", "présentation", "lecture", "famille"].map(
                (item) => (
                  <Badge key={item}>{item}</Badge>
                )
              )}
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
                {isDeleting ? "Suppression en cours..." : "Confirmer la suppression"}
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
              Cette action est irréversible. Le fichier sera physiquement
              effacé du serveur de stockage.
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
    const titleMatch = (x.title || "")
      .toLowerCase()
      .includes(q.toLowerCase())
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
