import { X, Search, ChevronRight, Download, LoaderCircle } from "lucide-react"

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  const styles = {
    primary: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm",
    secondary:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
export function Input({ label, error, className = "", ...props }) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`}>
      {label && <span className="mb-1.5 block">{label}</span>}
      <input
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 ${
          error ? "border-rose-400" : "border-slate-200"
        }`}
        {...props}
      />
      {error && (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      )}
    </label>
  )
}
export function Select({ label, options = [], className = "", ...props }) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`}>
      {label && <span className="mb-1.5 block">{label}</span>}
      <select
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        {...props}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
export function Card({ children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}
export function Badge({ children, tone }) {
  const value = String(children)
  const selected =
    tone ||
    (["Active", "Completed", "Resolved", "Success"].includes(value)
      ? "green"
      : ["Failed", "Suspended"].includes(value)
        ? "red"
        : [
              "Pending Review",
              "Pending verification",
              "Processing",
              "Queued",
            ].includes(value)
          ? "amber"
          : "slate")
  const colors = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  }
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[selected]}`}
    >
      {children}
    </span>
  )
}
export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
          Administration <ChevronRight size={13} /> {title}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}
export function StatCard({ label, value, change, icon: Icon }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && (
          <span className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-950">{value}</div>
      {change && (
        <div className="mt-2 text-xs font-medium text-emerald-600">
          {change}
        </div>
      )}
    </Card>
  )
}
export function SearchField({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
      <input
        aria-label="Search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
      />
    </div>
  )
}
export function DataTable({
  columns,
  rows,
  empty = "No records match your filters.",
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="whitespace-nowrap px-4 py-3 text-slate-600"
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-14 text-center text-slate-400"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
export function Modal({ open, onClose, title, description, children, footer }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-slate-950">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
export function ExportButton({ rows, filename = "mindlog-export.csv" }) {
  const download = () => {
    if (!rows.length) return
    const keys = Object.keys(rows[0])
    const csv = [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="secondary" onClick={download}>
      <Download size={16} /> Export CSV
    </Button>
  )
}
export function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <LoaderCircle className="animate-spin" size={18} /> Loading authorized
      results…
    </div>
  )
}
