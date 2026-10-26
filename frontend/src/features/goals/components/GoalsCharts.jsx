import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, SectionTitle } from "../../../components/ui"

const tooltipStyle = { borderRadius: 12, border: "1px solid #e2e8f0" }

export function StatusDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return (
    <Card className="p-5">
      <SectionTitle title="Répartition des objectifs" subtitle="Votre équilibre actuel" />
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Pas encore de données</p>
      ) : (
        <div className="relative h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82}>
                {data.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}`, "Objectifs"]} />
              <Legend verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
          <strong className="pointer-events-none absolute inset-0 grid place-items-center pb-6 text-2xl">{total}</strong>
        </div>
      )}
    </Card>
  )
}

export function GoalsProgressChart({ data }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Progression par objectif" subtitle="Du plus avancé au plus récent" />
      {!data.length ? (
        <p className="py-12 text-center text-sm text-slate-500">Pas encore de données</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "Progression"]} />
              <Bar dataKey="progress" radius={[0, 6, 6, 0]}>
                {data.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export function WeekBars({ data }) {
  return (
    <Card className="p-5">
      <SectionTitle title="Les 7 derniers jours" subtitle="Validations quotidiennes" />
      {!data.length ? (
        <p className="py-12 text-center text-sm text-slate-500">Pas encore de données</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}`, "Habitudes validées"]} />
              <Bar dataKey="count" name="Validations" radius={[6, 6, 0, 0]} fill="#7c3aed">
                {data.map((item) => <Cell key={item.date} fill={item.today ? "#10b981" : "#7c3aed"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
