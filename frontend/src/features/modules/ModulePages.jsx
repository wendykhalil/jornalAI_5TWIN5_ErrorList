import { useMemo, useState } from "react"
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
  Save,
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
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  PageHeader,
  SectionTitle,
  Select,
  Stat,
  Textarea,
} from "../../components/ui"

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

function EntryForm({ item }) {
  const { journals, setJournals, media, notify } = useStore(),
    nav = useNavigate()
  const [form, setForm] = useState(
      item || {
        title: "",
        content: "",
        date: "2026-02-18",
        mood: "Calme",
        tags: [],
        favorite: false,
      },
    ),
    [ai, setAi] = useState(null),
    [error, setError] = useState("")
  const save = (draft = false) => {
    if (!form.title || !form.content) {
      setError("Le titre et le contenu sont requis.")
      return
    }
    const next = { ...form, id: item?.id || crypto.randomUUID(), draft }
    setJournals(
      item
        ? journals.map((x) => (x.id === item.id ? next : x))
        : [next, ...journals],
    )
    notify(draft ? "Brouillon enregistré" : "Entrée enregistrée")
    nav(`/journal/${next.id}`)
  }
  return (
    <>
      <PageHeader
        title={item ? "Modifier l’entrée" : "Nouvelle entrée"}
        subtitle="Écrivez librement. Vos données restent dans le stockage local de cette démo."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="space-y-5 p-6">
          <Input
            label="Titre"
            placeholder="Donnez un titre à cette journée"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            label="Votre histoire"
            rows={12}
            placeholder="Qu’avez-vous envie de retenir ?"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Select
              label="Humeur"
              value={form.mood}
              onChange={(e) => setForm({ ...form, mood: e.target.value })}
            >
              {Object.keys(moodColors).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            <Input
              label="Tags (séparés par des virgules)"
              defaultValue={form.tags.join(", ")}
              onBlur={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(false)}>Enregistrer l’entrée</Button>
            <Button variant="secondary" onClick={() => save(true)}>
              Enregistrer le brouillon
            </Button>
            <Button variant="ghost" onClick={() => nav("/journal")}>
              Annuler
            </Button>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle
              title="Organiser avec l’IA"
              subtitle="Suggestions simulées"
            />
            <Button
              variant="ai"
              className="w-full"
              onClick={() =>
                setTimeout(
                  () =>
                    setAi({
                      summary:
                        "Une réflexion positive sur les progrès et les nouvelles rencontres.",
                      tags: ["progression", "rencontres", "confiance"],
                      sentiment: "Positif et serein",
                    }),
                  550,
                )
              }
            >
              <Sparkles size={16} /> Analyser avec l’IA
            </Button>
            {ai && (
              <div className="mt-4 space-y-3 text-sm">
                <p>
                  <b>Résumé :</b> {ai.summary}
                </p>
                <p>
                  <b>Sentiment :</b> {ai.sentiment}
                </p>
                <div className="flex flex-wrap gap-1">
                  {ai.tags.map((x) => (
                    <Badge key={x} className="bg-cyan-50 text-cyan-700">
                      {x}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Suggestion IA — simulation de démonstration
                </p>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title="Média lié" />
            <div className="grid grid-cols-3 gap-2">
              {media
                .filter((x) => x.url)
                .slice(0, 3)
                .map((x) => (
                  <img
                    key={x.id}
                    src={x.url}
                    alt={x.title}
                    className="aspect-square rounded-lg object-cover"
                  />
                ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
export function JournalPage({ mode = "list" }) {
  const { journals, setJournals, notify } = useStore(),
    { id } = useParams()
  const [q, setQ] = useState(""),
    [sort, setSort] = useState("new"),
    [confirm, setConfirm] = useState(false)
  const item = journals.find((x) => x.id === id)
  if (mode === "new") return <EntryForm />
  if (mode === "edit") return item ? <EntryForm item={item} /> : <Empty />
  if (mode === "detail") {
    if (!item) return <Empty title="Entrée introuvable" />
    return (
      <>
        <Link
          to="/journal"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500"
        >
          <ArrowLeft size={16} /> Retour au journal
        </Link>
        <Card className="mx-auto max-w-4xl overflow-hidden">
          <div className="border-b border-slate-100 p-7">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-violet-50 text-violet-700">
                {item.mood}
              </Badge>
              {item.tags.map((x) => (
                <Badge key={x}>#{x}</Badge>
              ))}
            </div>
            <h1 className="mt-5 text-3xl font-extrabold">{item.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{item.date}</p>
          </div>
          <div className="p-7">
            <p className="whitespace-pre-line leading-8 text-slate-700">
              {item.content}
            </p>
            <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
              <div className="font-extrabold text-cyan-900">
                Résumé et thèmes suggérés par l’IA
              </div>
              <p className="mt-2 text-sm text-cyan-800">
                Cette entrée évoque la progression personnelle, l’apprentissage
                et la gratitude.
              </p>
              <p className="mt-2 text-xs text-cyan-700">
                Simulation de démonstration — ce résultat n’est pas une analyse
                réelle.
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              <Link to={`/journal/${id}/edit`}>
                <Button variant="secondary">
                  <Edit3 size={16} /> Modifier
                </Button>
              </Link>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <Trash2 size={16} /> Supprimer
              </Button>
            </div>
          </div>
        </Card>
        <Modal
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Supprimer cette entrée ?"
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setJournals(journals.filter((x) => x.id !== id))
                  notify("Entrée supprimée")
                  location.assign("/journal")
                }}
              >
                Confirmer
              </Button>
            </>
          }
        >
          Cette action supprimera « {item.title} » du stockage local.
        </Modal>
      </>
    )
  }
  const list = journals
    .filter((x) =>
      [x.title, x.content, ...x.tags]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "old"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    )
  return (
    <>
      <PageHeader
        title="Mon journal"
        subtitle="Un espace pour écrire, comprendre et revisiter vos journées."
        actions={
          <Link to="/journal/new">
            <Button>
              <Plus size={17} /> Nouvelle entrée
            </Button>
          </Link>
        }
      />
      <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:ring-4 focus:ring-violet-100"
            placeholder="Rechercher dans le journal..."
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Plus récent</option>
          <option value="old">Plus ancien</option>
          <option value="title">Titre A–Z</option>
        </Select>
      </Card>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((x) => (
            <Card key={x.id} className="group p-5">
              <div className="flex justify-between">
                <Badge className="bg-violet-50 text-violet-700">{x.mood}</Badge>
                <button
                  onClick={() =>
                    setJournals(
                      journals.map((j) =>
                        j.id === x.id ? { ...j, favorite: !j.favorite } : j,
                      ),
                    )
                  }
                >
                  <Heart
                    size={18}
                    className={
                      x.favorite
                        ? "fill-rose-500 text-rose-500"
                        : "text-slate-300"
                    }
                  />
                </button>
              </div>
              <Link to={`/journal/${x.id}`}>
                <h2 className="mt-4 text-lg font-extrabold group-hover:text-violet-600">
                  {x.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                  {x.content}
                </p>
              </Link>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                <CalendarDays size={14} />
                {x.date}
                <div className="ml-auto flex gap-1">
                  {x.tags.slice(0, 2).map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty />
      )}
    </>
  )
}

export function MoodPage({ mode = "dashboard" }) {
  const { moods, setMoods, notify } = useStore(),
    nav = useNavigate(),
    { id } = useParams()
  const [filter, setFilter] = useState("Tous"),
    [form, setForm] = useState({
      mood: "Calme",
      intensity: 3,
      note: "",
      date: "2026-02-18",
    })
  if (mode === "new")
    return (
      <>
        <PageHeader
          title="Comment vous sentez-vous ?"
          subtitle="Il n’y a pas de bonne ou de mauvaise réponse."
        />
        <Card className="mx-auto max-w-3xl p-6">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {Object.keys(moodColors).map((x) => (
              <button
                key={x}
                onClick={() => setForm({ ...form, mood: x })}
                className={`rounded-2xl border p-4 text-center text-sm font-bold ${
                  form.mood === x
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-200"
                }`}
              >
                <Smile
                  className="mx-auto mb-2"
                  style={{ color: moodColors[x] }}
                />
                {x}
              </button>
            ))}
          </div>
          <div className="mt-7">
            <label className="text-sm font-bold">
              Intensité : {form.intensity}/5
            </label>
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
          <Button
            className="mt-6"
            onClick={() => {
              setMoods([{ ...form, id: crypto.randomUUID() }, ...moods])
              notify("Humeur enregistrée")
              nav("/mood")
            }}
          >
            Enregistrer mon humeur
          </Button>
        </Card>
      </>
    )
  if (mode === "detail") {
    const m = moods.find((x) => x.id === id)
    return m ? (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <Smile
          className="mx-auto"
          size={50}
          style={{ color: moodColors[m.mood] }}
        />
        <h1 className="mt-4 text-3xl font-extrabold">{m.mood}</h1>
        <p className="mt-2 text-slate-500">
          {m.date} · Intensité {m.intensity}/5
        </p>
        <p className="mt-6 rounded-xl bg-slate-50 p-4">{m.note}</p>
        <Link
          className="mt-6 inline-block font-bold text-violet-600"
          to="/mood/history"
        >
          Retour à l’historique
        </Link>
      </Card>
    ) : (
      <Empty />
    )
  }
  const data = moods
    .slice(0, 14)
    .reverse()
    .map((x, i) => ({ day: i + 1, value: x.intensity }))
  const dist = Object.entries(
    moods.reduce((a, x) => ({ ...a, [x.mood]: (a[x.mood] || 0) + 1 }), {}),
  ).map(([name, value]) => ({ name, value }))
  if (mode === "insights")
    return (
      <>
        <PageHeader
          title="Tendances de vos émotions"
          subtitle="Des observations informatives sur les données que vous avez enregistrées."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Ces tendances sont informatives et ne constituent ni un avis médical
          ni un diagnostic psychologique.
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <SectionTitle title="Humeurs fréquentes" />
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={dist}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={85}
                  >
                    {dist.map((x, i) => (
                      <Cell
                        key={x.name}
                        fill={Object.values(moodColors)[i % 9]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="Suggestions douces" />
            <ul className="space-y-3 text-sm text-slate-600">
              {[
                "Vos notes calmes mentionnent souvent des moments de pause.",
                "Les journées d’étude sont souvent associées à la motivation.",
                "Préserver une courte pause les jours chargés pourrait vous aider.",
              ].map((x) => (
                <li key={x} className="rounded-xl bg-slate-50 p-4">
                  {x}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </>
    )
  if (mode === "history")
    return (
      <>
        <PageHeader
          title="Historique des humeurs"
          actions={
            <Link to="/mood/new">
              <Button>
                <Plus /> Nouveau check-in
              </Button>
            </Link>
          }
        />
        <Select
          className="mb-5 max-w-xs"
          label="Filtrer"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>Tous</option>
          {Object.keys(moodColors).map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
        <div className="space-y-3">
          {moods
            .filter((x) => filter === "Tous" || x.mood === filter)
            .map((x) => (
              <Card key={x.id} className="flex items-center gap-4 p-4">
                <Smile style={{ color: moodColors[x.mood] }} />
                <Link to={`/mood/${x.id}`} className="flex-1">
                  <b>{x.mood}</b>
                  <p className="text-sm text-slate-500">{x.note}</p>
                </Link>
                <Badge>{x.intensity}/5</Badge>
                <span className="text-xs text-slate-400">{x.date}</span>
                <button
                  onClick={() => setMoods(moods.filter((m) => m.id !== x.id))}
                  aria-label="Supprimer"
                >
                  <Trash2 size={17} className="text-slate-400" />
                </button>
              </Card>
            ))}
        </div>
      </>
    )
  return (
    <>
      <PageHeader
        title="Mon humeur"
        subtitle="Observez vos émotions avec douceur, sans jugement."
        actions={
          <>
            <Link to="/mood/history">
              <Button variant="secondary">Historique</Button>
            </Link>
            <Link to="/mood/insights">
              <Button variant="secondary">Insights</Button>
            </Link>
            <Link to="/mood/new">
              <Button>
                <Plus /> Enregistrer
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Humeur actuelle"
          value={moods[0]?.mood || "—"}
          icon={Smile}
        />
        <Stat label="Moyenne mensuelle" value="3,8/5" icon={Heart} />
        <Stat label="Check-ins" value={moods.length} icon={CalendarDays} />
      </div>
      <Card className="mt-5 p-5">
        <SectionTitle title="Les 14 derniers jours" />
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <XAxis dataKey="day" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Area dataKey="value" stroke="#6C63FF" fill="#ede9fe" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}

export function MediaPage({ mode = "library" }) {
  const { media, setMedia, notify } = useStore(),
    nav = useNavigate(),
    { id } = useParams()
  const [q, setQ] = useState(""),
    [progress, setProgress] = useState(0),
    [prompt, setPrompt] = useState(
      "Une plage tunisienne paisible au coucher du soleil",
    ),
    [generated, setGenerated] = useState(false)
  if (mode === "upload")
    return (
      <>
        <PageHeader
          title="Ajouter un média"
          subtitle="Les aperçus locaux ne constituent pas un stockage cloud permanent."
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
              onChange={() => setProgress(35)}
            />
          </label>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Titre" id="media-title" placeholder="Nom du média" />
            <Select label="Type">
              <option>Image</option>
              <option>Audio</option>
              <option>Vidéo</option>
              <option>Document</option>
            </Select>
            <Textarea label="Description" className="sm:col-span-2" />
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
                Téléversement simulé : {progress}%
              </p>
            </div>
          )}
          <Button
            className="mt-5"
            onClick={() => {
              const title =
                document.querySelector("#media-title").value || "Nouveau média"
              setMedia([
                {
                  id: crypto.randomUUID(),
                  title,
                  type: "document",
                  date: "2026-02-18",
                  description: "Média local de démonstration",
                },
                ...media,
              ])
              notify("Média ajouté")
              nav("/media")
            }}
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
              <Button className="!rounded-full !p-3">
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
            className="max-h-[32rem] w-full object-cover"
            alt={x.title}
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
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-slate-100">
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
