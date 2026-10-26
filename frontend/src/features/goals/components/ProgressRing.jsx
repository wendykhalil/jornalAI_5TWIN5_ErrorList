export function ProgressRing({ value, label }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(1, Math.max(0, value))
  const offset = circumference * (1 - progress)

  return (
    <div
      className="relative size-32 shrink-0"
      role="img"
      aria-label={`${label}: ${Math.round(progress * 100)} %`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-violet-100"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-violet-600 transition-all duration-700 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <strong className="text-xl text-slate-950">
          {Math.round(progress * 100)}%
        </strong>
      </div>
    </div>
  )
}
