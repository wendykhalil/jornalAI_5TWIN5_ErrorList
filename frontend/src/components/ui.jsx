import { X, LoaderCircle, Sparkles } from "lucide-react"

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
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
    ai: "bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100",
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
export function Input({ label, error, className = "", ...props }) {
  return (
    <label
      className={`block text-sm font-semibold text-slate-700 ${className}`}
    >
      {label && <span className="mb-2 block">{label}</span>}
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        {...props}
      />
      {error && (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      )}
    </label>
  )
}
export function Select({ label, children, className = "", ...props }) {
  return (
    <label
      className={`block text-sm font-semibold text-slate-700 ${className}`}
    >
      {label && <span className="mb-2 block">{label}</span>}
      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        {...props}
      >
        {children}
      </select>
    </label>
  )
}
export function Textarea({ label, error, ...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label && <span className="mb-2 block">{label}</span>}
      <textarea
        className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}
export function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${className || "bg-slate-100 text-slate-700"}`}
    >
      {children}
    </span>
  )
}
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        {eyebrow && (
          <div className="mb-2 text-sm font-bold text-violet-600">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
export function Empty({
  title = "Aucun résultat",
  text = "Essayez de modifier vos filtres.",
  action,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
        <Sparkles size={20} />
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function Modal({ open, onClose, title, children, actions }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <Button
            variant="ghost"
            className="!p-2"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      </Card>
    </div>
  )
}
export function Loading({ label = "Chargement..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-slate-500">
      <LoaderCircle className="animate-spin" size={20} />
      {label}
    </div>
  )
}
export function Stat({ label, value, icon: Icon, tone = "violet", hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-emerald-600">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={`grid size-10 place-items-center rounded-xl bg-${tone}-50 text-${tone}-600`}
          >
            <Icon size={20} />
          </div>
        )}
      </div>
    </Card>
  )
}
export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
