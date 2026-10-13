import { useState } from "react"
import { Link } from "react-router"
import {
  Sparkles,
  BookOpen,
  HeartPulse,
  Target,
  Images,
  CalendarHeart,
  Bell,
  Trash2,
  CheckCheck,
  UserRound,
  Lock,
  Palette,
  Languages,
  Shield,
  Download,
  Save,
} from "lucide-react"
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
  Textarea,
} from "../../components/ui"

export function AiInsights() {
  const cards = [
    [
      "Résumé du journal",
      "Vos entrées récentes mettent en avant l’apprentissage et la gratitude.",
      "/journal",
      BookOpen,
    ],
    [
      "Tendances d’humeur",
      "Votre humeur est plus stable les jours où vous prenez une pause.",
      "/mood/insights",
      HeartPulse,
    ],
    [
      "Objectifs & habitudes",
      "Vous avez complété 78% de vos routines cette semaine.",
      "/goals/insights",
      Target,
    ],
    [
      "Activité média",
      "Trois photos et une note vocale ont enrichi votre histoire.",
      "/media",
      Images,
    ],
    [
      "Souvenirs importants",
      "Vos moments d’études et de voyage sont les plus représentés.",
      "/memories/insights",
      CalendarHeart,
    ],
  ]
  return (
    <>
      <PageHeader
        title="AI Insights"
        subtitle="Un regard transversal sur votre journal. Toutes les analyses sont simulées dans cette version."
      />
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
        <b>Mode démonstration :</b> ces observations sont générées à partir des
        données fictives visibles dans l’application, sans appel à un service
        d’IA externe.
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, text, to, Icon]) => (
          <Link to={to} key={title}>
            <Card className="h-full p-6 hover:border-violet-300">
              <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Icon />
              </span>
              <h2 className="mt-5 text-lg font-extrabold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-violet-600">
                Explorer le module →
              </span>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <SectionTitle title="Thèmes suggérés pour votre prochain journal" />
        <div className="flex flex-wrap gap-2">
          {[
            "Ce dont je suis fier cette semaine",
            "Une rencontre qui m’a marqué",
            "Ce que je veux apprendre",
            "Un souvenir à transmettre",
          ].map((x) => (
            <Badge key={x} className="bg-cyan-50 text-cyan-700">
              {x}
            </Badge>
          ))}
        </div>
      </Card>
    </>
  )
}
export function Notifications() {
  const { notifications, setNotifications, notify } = useStore(),
    [filter, setFilter] = useState("Tous")
  const list = notifications.filter(
    (x) => filter === "Tous" || x.type === filter,
  )
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Gardez le fil sans être submergée."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setNotifications(notifications.map((x) => ({ ...x, read: true })))
              notify("Toutes les notifications sont lues")
            }}
          >
            <CheckCheck /> Tout marquer comme lu
          </Button>
        }
      />
      <div className="mb-5 max-w-xs">
        <Select
          label="Filtrer par type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>Tous</option>
          {[...new Set(notifications.map((x) => x.type))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
      </div>
      {list.length ? (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {list.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-4 p-4 ${
                !n.read ? "bg-violet-50/60" : ""
              }`}
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${
                  n.read
                    ? "bg-slate-100 text-slate-400"
                    : "bg-violet-100 text-violet-600"
                }`}
              >
                <Bell size={18} />
              </span>
              <button
                className="flex-1 text-left"
                onClick={() =>
                  setNotifications(
                    notifications.map((x) =>
                      x.id === n.id ? { ...x, read: true } : x,
                    ),
                  )
                }
              >
                <p className="text-sm font-bold">{n.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {n.date} · {n.type}
                </p>
              </button>
              {!n.read && (
                <span className="size-2 rounded-full bg-violet-600" />
              )}
              <button
                onClick={() =>
                  setNotifications(notifications.filter((x) => x.id !== n.id))
                }
                aria-label="Supprimer"
              >
                <Trash2 size={17} className="text-slate-400" />
              </button>
            </div>
          ))}
        </Card>
      ) : (
        <Empty title="Aucune notification" />
      )}
    </>
  )
}
export function Profile() {
  const { notify } = useStore(),
    [avatar, setAvatar] = useState(null)
  return (
    <>
      <PageHeader
        title="Mon profil"
        subtitle="Gérez les informations visibles dans votre espace personnel."
      />
      <Card className="mx-auto max-w-4xl p-6">
        <div className="mb-7 flex items-center gap-5">
          <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-slate-900 text-xl font-extrabold text-white">
            {avatar ? (
              <img
                src={avatar}
                className="h-full w-full object-cover"
                alt="Avatar"
              />
            ) : (
              "AM"
            )}
          </div>
          <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">
            Changer la photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files[0] &&
                setAvatar(URL.createObjectURL(e.target.files[0]))
              }
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" defaultValue="Aya" />
          <Input label="Nom" defaultValue="Mansour" />
          <Input label="Nom d’utilisateur" defaultValue="aya.mansour" />
          <Input
            label="Adresse email"
            type="email"
            defaultValue="demo@mindlog.ai"
          />
          <Textarea
            label="Biographie"
            defaultValue="Étudiante passionnée par la technologie, la photographie et les voyages."
          />
          <div className="space-y-4">
            <Select label="Langue préférée">
              <option>Français</option>
            </Select>
            <Select label="Apparence">
              <option>Clair</option>
              <option>Sombre</option>
            </Select>
          </div>
        </div>
        <Button
          className="mt-6"
          onClick={() => notify("Profil mis à jour localement")}
        >
          <Save /> Enregistrer les modifications
        </Button>
      </Card>
    </>
  )
}
export function Settings() {
  const { theme, setTheme, notify } = useStore(),
    [tab, setTab] = useState("account"),
    [deleteOpen, setDeleteOpen] = useState(false)
  const tabs = [
    ["account", "Compte", UserRound],
    ["appearance", "Apparence", Palette],
    ["language", "Langue", Languages],
    ["notifications", "Notifications", Bell],
    ["privacy", "Confidentialité", Shield],
  ]
  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez votre expérience MindLog AI."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${
                tab === id
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </Card>
        <Card className="p-6">
          {tab === "account" && (
            <>
              <SectionTitle title="Compte & sécurité" />
              <Link to="/profile">
                <Button variant="secondary">Ouvrir mon profil</Button>
              </Link>
              <div className="mt-6 max-w-lg space-y-4">
                <Input label="Mot de passe actuel" type="password" />
                <Input label="Nouveau mot de passe" type="password" />
                <Button
                  onClick={() => notify("Mise à jour simulée — backend requis")}
                >
                  Simuler la mise à jour
                </Button>
              </div>
            </>
          )}
          {tab === "appearance" && (
            <>
              <SectionTitle title="Apparence" />
              <div className="grid max-w-xl grid-cols-2 gap-4">
                {[
                  ["light", "Mode clair"],
                  ["dark", "Mode sombre"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setTheme(v)}
                    className={`rounded-2xl border-2 p-6 text-left font-bold ${
                      theme === v
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200"
                    }`}
                  >
                    {l}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Préférence enregistrée dans ce navigateur
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "language" && (
            <>
              <SectionTitle title="Langue de l’interface" />
              <Select className="max-w-sm" label="Langue">
                <option>Français</option>
              </Select>
              <p className="mt-3 text-sm text-slate-500">
                Le français est la seule interface complète de cette
                démonstration.
              </p>
            </>
          )}
          {tab === "notifications" && (
            <>
              <SectionTitle title="Rappels" />
              <div className="space-y-3">
                {[
                  "Rappel quotidien du journal",
                  "Check-in d’humeur",
                  "Habitudes du jour",
                  "Anniversaire de souvenirs",
                  "Résumé AI prêt",
                ].map((x, i) => (
                  <label
                    key={x}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold"
                  >
                    {x}
                    <input
                      type="checkbox"
                      defaultChecked={i < 4}
                      className="size-4 accent-violet-600"
                    />
                  </label>
                ))}
              </div>
              <Button
                className="mt-5"
                onClick={() => notify("Préférences enregistrées")}
              >
                Enregistrer
              </Button>
            </>
          )}
          {tab === "privacy" && (
            <>
              <SectionTitle title="Données & confidentialité" />
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                L’export complet et la suppression de compte nécessiteront une
                implémentation backend sécurisée.
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    notify("Export simulé — aucune donnée serveur")
                  }
                >
                  <Download /> Simuler l’export
                </Button>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  Supprimer mon compte
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer votre compte ?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(false)
                notify("Action simulée — backend requis")
              }}
            >
              Confirmer la simulation
            </Button>
          </>
        }
      >
        Cette action sensible ne sera exécutée qu’après intégration du backend
        et vérification de votre identité.
      </Modal>
    </>
  )
}
export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-7xl font-extrabold text-violet-200">404</p>
        <h1 className="mt-4 text-2xl font-extrabold">
          Cette page n’existe pas
        </h1>
        <Link
          to="/dashboard"
          className="mt-5 inline-block font-bold text-violet-600"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
