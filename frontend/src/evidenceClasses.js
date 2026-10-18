// Descriptive labels for the backend's evidence classes. These describe dataset metadata only.

export const CLASS_ORDER = [
  'causal_method_tagged',
  'theoretical',
  'unspecified_method',
  'other_method_not_causal_tagged',
]

export const CLASS_LABEL = {
  causal_method_tagged: 'Causal-method tag',
  theoretical: 'Theoretical',
  unspecified_method: 'Method unspecified',
  other_method_not_causal_tagged: 'Other method, no causal tag',
}

export const fmt = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('en-US'))

// Sum evidence_class_rows over a list of edge summaries.
export function sumClasses(edges) {
  const totals = {}
  for (const edge of edges) {
    for (const [key, count] of Object.entries(edge.evidence_class_rows || {})) {
      totals[key] = (totals[key] || 0) + count
    }
  }
  return totals
}

export const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`
