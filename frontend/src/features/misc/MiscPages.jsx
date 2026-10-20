import { useEffect, useState } from "react"

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

      "Ouvrez les tendances calculées à partir de vos humeurs et leur synthèse descriptive.",

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
  const { user, updateUser, notify, theme, setTheme } = useStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" })
  const [avatar, setAvatar] = useState(null)

  useEffect(() => {
    setForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
    })
  }, [user])

  useEffect(() => () => {
    if (avatar) URL.revokeObjectURL(avatar)
  }, [avatar])

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Utilisateur"
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("")

  const cancel = () => {
    setForm({
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
    })
    setEditing(false)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editing || saving) return
    if (!form.email.trim()) {
      notify("L'adresse email est obligatoire", "error")
      return
    }
    if (typeof updateUser !== "function") {
      notify("La mise à jour du profil n'est pas disponible", "error")
      return
    }
    setSaving(true)
    try {
      await updateUser({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
      })
      setEditing(false)
      notify("Profil mis à jour avec succès")
    } catch (error) {
      notify(error.message || "Impossible de mettre à jour le profil", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Mon profil" subtitle="Gérez les informations de votre compte personnel." />
      <Card className="mx-auto max-w-4xl p-6">
        <div className="mb-7 flex flex-wrap items-center gap-5">
          <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-slate-900 text-xl font-extrabold text-white">
            {avatar ? <img src={avatar} className="h-full w-full object-cover" alt="Avatar" /> : initials}
          </div>
          <div className="flex-1">
            <h2 className="font-bold">{displayName}</h2>
            <p className="mb-3 text-xs text-slate-500">{user?.email || ""}</p>
            <label className={`inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold ${editing ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
              Changer la photo
              <input type="file" accept="image/*" disabled={!editing || saving} className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setAvatar(URL.createObjectURL(file))
              }} />
            </label>
            <p className="mt-2 text-xs text-slate-400">Aperçu local uniquement (photo non enregistrée)</p>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">
              Modifier le profil
            </button>
          )}
        </div>

        <form onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["first_name", "Prénom"],
              ["last_name", "Nom"],
              ["username", "Nom d’utilisateur"],
              ["email", "Adresse email"],
            ].map(([key, label]) => {
              const locked = key === "username"
              const canEdit = editing && !locked && !saving
              return (
                <div key={key}>
                  <label htmlFor={`profile-${key}`} className="mb-2 block text-sm font-semibold text-slate-700">
                    {label}{locked && <span className="ml-2 text-xs font-normal text-slate-400">(non modifiable)</span>}
                  </label>
                  <input
                    id={`profile-${key}`}
                    type={key === "email" ? "email" : "text"}
                    value={locked ? (user?.username || "") : form[key]}
                    onChange={locked ? undefined : (event) => setForm((old) => ({ ...old, [key]: event.target.value }))}
                    readOnly={!canEdit}
                    disabled={saving}
                    required={key === "email"}
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${canEdit ? "border-violet-300 bg-white text-slate-900 focus:border-violet-500 focus:ring-4 focus:ring-violet-100" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                  />
                </div>
              )
            })}
            <div className="sm:col-span-2">
              <label htmlFor="profile-theme" className="mb-2 block text-sm font-semibold">Apparence</label>
              <select id="profile-theme" value={theme} onChange={(event) => setTheme(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
              </select>
            </div>
          </div>
          {editing && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                <Save size={17} /> {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
              <button type="button" disabled={saving} onClick={cancel} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Annuler
              </button>
            </div>
          )}
        </form>
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
