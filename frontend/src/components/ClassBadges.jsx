import { CLASS_LABEL, CLASS_ORDER, fmt } from '../evidenceClasses'

export function ClassBadge({ evidenceClass, count }) {
  return (
    <span className={`badge cls-${evidenceClass}`}>
      {CLASS_LABEL[evidenceClass] || evidenceClass}
      {count !== undefined && <b> {fmt(count)}</b>}
    </span>
  )
}

// Row counts per evidence class; classes with zero rows are omitted.
export default function ClassBadges({ totals }) {
  const present = CLASS_ORDER.filter((key) => totals[key])
  if (present.length === 0) return null
  return (
    <span className="badge-row">
      {present.map((key) => (
        <ClassBadge key={key} evidenceClass={key} count={totals[key]} />
      ))}
    </span>
  )
}
