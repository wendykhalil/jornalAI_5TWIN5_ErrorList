import { Card, SectionTitle } from "../../../components/ui"

const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "short" })
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" })
const levelClasses = {
  100: "bg-violet-100",
  200: "bg-violet-200",
  300: "bg-violet-300",
  400: "bg-violet-400",
  600: "bg-violet-600",
}

export function HabitHeatmap({ days, habitCount }) {
  const columns = Array.from({ length: 12 }, (_, column) => days.slice(column * 7, column * 7 + 7))
  return (
    <Card className="p-5">
      <SectionTitle title="Régularité" subtitle="Les 12 dernières semaines" />
      {!habitCount ? (
        <p className="py-12 text-center text-sm text-slate-500">Ajoutez une habitude pour voir votre calendrier</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <div className="grid w-7 shrink-0 grid-rows-7 gap-1 pt-5 text-[10px] text-slate-400">
              {["L", "", "M", "", "V", "", "D"].map((day, i) => <span key={i}>{day}</span>)}
            </div>
            <div className="flex min-w-max gap-1">
              {columns.map((column, i) => (
                <div key={i} className="grid grid-rows-7 gap-1">
                  <span className="h-4 text-[10px] text-slate-400">
                    {column[0] && (column[0].date.getDate() < 8 || i === 0) ? monthFormat.format(column[0].date) : ""}
                  </span>
                  {column.map((day) => (
                    <span
                      key={day.key}
                      title={`${dayFormat.format(day.date)} : ${day.count} ${day.count === 1 ? "habitude" : "habitudes"}`}
                      className={`size-3 rounded-sm ${day.future ? "bg-slate-100" : levelClasses[day.level]}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-500">
            moins <span className="size-3 rounded-sm bg-violet-100" /> <span className="size-3 rounded-sm bg-violet-300" /> <span className="size-3 rounded-sm bg-violet-600" /> plus
          </div>
        </>
      )}
    </Card>
  )
}
