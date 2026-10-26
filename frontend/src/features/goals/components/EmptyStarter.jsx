import { useState } from "react"
import { CheckCircle2, Plus } from "lucide-react"
import { Button, Card } from "../../../components/ui"

const habits = ["Lire 20 minutes", "Boire 2 L d'eau", "Méditer 5 minutes", "Marcher 30 minutes"]
const goals = ["Courir 10 km", "Lire 12 livres", "Valider mon semestre"]

export function EmptyStarter({ onCreateHabit, onCreateGoal }) {
  const [busy, setBusy] = useState("")
  const create = async (type, value) => {
    setBusy(`${type}:${value}`)
    try {
      if (type === "habit") await onCreateHabit(value)
      else await onCreateGoal(value)
    } finally {
      setBusy("")
    }
  }
  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <CheckCircle2 className="mx-auto size-12 text-violet-600" />
        <h2 className="mt-4 text-xl font-extrabold text-slate-950">Commencez en douceur</h2>
        <p className="mt-2 text-sm text-slate-500">Choisissez une idée pour lancer votre progression.</p>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-bold text-slate-900">Habitudes</h3>
          <div className="mt-3 grid gap-2">
            {habits.map((item) => <Button key={item} variant="secondary" className="justify-start" disabled={!!busy} onClick={() => create("habit", item)} aria-label={`Créer l'habitude ${item}`}><Plus size={15} />{busy === `habit:${item}` ? "Création..." : item}</Button>)}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Objectifs</h3>
          <div className="mt-3 grid gap-2">
            {goals.map((item) => <Button key={item} variant="secondary" className="justify-start" disabled={!!busy} onClick={() => create("goal", item)} aria-label={`Créer l'objectif ${item}`}><Plus size={15} />{busy === `goal:${item}` ? "Création..." : item}</Button>)}
          </div>
        </div>
      </div>
    </Card>
  )
}
