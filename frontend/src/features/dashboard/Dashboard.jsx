import { Link } from "react-router"
import {
  BookOpen,
  HeartPulse,
  Images,
  Target,
  CalendarHeart,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Sparkles,
} from "lucide-react"
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useStore } from "../../store/AppStore"
import {
  Card,
  PageHeader,
  SectionTitle,
  Stat,
  Button,
  Badge,
} from "../../components/ui"

export default function Dashboard() {
  const { memories, journals, moods, media, goals, habits } = useStore()
  const chart = moods
    .slice(0, 7)
    .reverse()
    .map((m, i) => ({
      day: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i],
      value: m.intensity,
    }))
  const activity = Array.from({ length: 8 }, (_, i) => ({
    week: `S${i + 1}`,
    value: 2 + ((i * 3) % 7),
  }))
  const cats = Object.entries(
    memories.reduce(
      (a, m) => ({ ...a, [m.category]: (a[m.category] || 0) + 1 }),
      {},
    ),
  ).map(([name, value]) => ({ name, value }))
  const actions = [
    ["Nouvelle entrée", "/journal/new", BookOpen],
    ["Enregistrer mon humeur", "/mood/new", HeartPulse],
    ["Ajouter un média", "/media/upload", Images],
    ["Créer un souvenir", "/memories/new", CalendarHeart],
    ["Ajouter un objectif", "/goals/new", Target],
  ]
  return (
    <>
      <PageHeader
        eyebrow="Mardi 18 février 2026"
        title="Bonjour Aya, prête à écrire la suite ?"
        subtitle="Voici un aperçu calme et utile de votre parcours personnel."
        actions={
          <Button onClick={() => location.assign("/journal/new")}>
            <Plus size={17} /> Nouvelle entrée
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          label="Entrées"
          value={journals.length}
          icon={BookOpen}
          hint="+2 ce mois"
        />
        <Stat label="Humeur moyenne" value="3,8/5" icon={HeartPulse} />
        <Stat label="Souvenirs" value={memories.length} icon={CalendarHeart} />
        <Stat
          label="Objectifs actifs"
          value={goals.filter((g) => g.status === "active").length}
          icon={Target}
        />
        <Stat label="Habitudes" value="78%" icon={TrendingUp} />
        <Stat label="Médias" value={media.length} icon={Images} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <SectionTitle
            title="Évolution de votre humeur"
            subtitle="Intensité déclarée sur les 7 derniers jours"
          />
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="mood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6C63FF" stopOpacity=".35" />
                    <stop offset="1" stopColor="#6C63FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6C63FF"
                  strokeWidth={3}
                  fill="url(#mood)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="overflow-hidden bg-slate-950 p-6 text-white">
          <Badge className="bg-cyan-300/15 text-cyan-300">
            <Sparkles size={12} className="mr-1" /> Simulation IA
          </Badge>
          <h2 className="mt-5 text-xl font-extrabold">Votre résumé du jour</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Votre semaine montre une belle constance. Vous avez avancé sur vos
            études, pris le temps d’écrire et conservé un nouveau souvenir à
            Sidi Bou Saïd.
          </p>
          <Link
            to="/ai-insights"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white"
          >
            Voir les AI Insights <ArrowUpRight size={16} />
          </Link>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <SectionTitle title="Activité du journal" />
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={activity}>
                <XAxis dataKey="week" axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6C63FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Souvenirs par catégorie" />
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={cats}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {cats.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#6C63FF", "#22D3EE", "#F59E0B", "#34D399", "#F472B6"][
                          i % 5
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Actions rapides" />
          <div className="grid gap-2">
            {actions.map(([label, to, Icon]) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm font-bold hover:border-violet-200 hover:bg-violet-50"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon size={17} />
                </span>
                {label}
                <ArrowUpRight className="ml-auto text-slate-300" size={16} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <SectionTitle
          title="Activité récente"
          subtitle="Vos derniers moments enregistrés"
        />
        <div className="grid gap-3 md:grid-cols-3">
          {journals.slice(0, 3).map((j, i) => (
            <Link
              to={`/journal/${j.id}`}
              key={j.id}
              className="rounded-xl bg-slate-50 p-4 hover:bg-violet-50"
            >
              <Badge>{["Journal", "Humeur", "Souvenir"][i]}</Badge>
              <p className="mt-3 font-bold">{j.title}</p>
              <p className="mt-1 text-xs text-slate-500">{j.date}</p>
            </Link>
          ))}
        </div>
      </Card>
    </>
  )
}
