// Choosing the single "Suggested" card for one side (starting or outcome concept).
// Semantic compatibility comes first; graph connectivity is only a late tie-breaker and
// edge counts are never read as stronger evidence.

import { toConcept, wordingNote } from './concepts.js'

export const SUGGEST_MIN_SIMILARITY = 0.85
export const MAX_POOL_ALTERNATIVES = 4

const isFormVariant = (node, original) => /^(Plural|Singular)/.test(wordingNote(node, original) || '')

// The original matched concept plus semantically close alternatives (best first).
export function conceptPool(parsedSide) {
  if (!parsedSide || !parsedSide.selected) return { original: null, alternatives: [] }
  const original = toConcept(parsedSide.selected)
  const alternatives = parsedSide.candidates
    .filter((c) => c.node_id !== original.node_id && c.similarity >= SUGGEST_MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_POOL_ALTERNATIVES)
    .map(toConcept)
  return { original, alternatives }
}

// `coverage(nodeId)` returns the best quick-check path count against any concept offered on the other side,
// or null while checks are still running.
// An alternative is suggested only when it is meaningful:
//   (a) the original has no paths but the alternative does, or
//   (b) it is a plural/singular form of the original, or
//   (c) it extends the original wording (e.g. "economic growth" for "growth") and its quick check finds at least
//       as many paths as the original (so it is no worse for this question),
// and it has paths. Otherwise no suggestion is shown.
// Result: { status: 'pending' | 'none' | 'ready', alternative }
export function pickSuggestion(original, alternatives, coverage) {
  if (!original || alternatives.length === 0) return { status: 'none', alternative: null }
  const originalCov = coverage(original.node_id)
  const scored = alternatives.map((a) => ({ a, cov: coverage(a.node_id) }))
  if (originalCov === null || scored.some((s) => s.cov === null)) return { status: 'pending', alternative: null }

  const extendsOriginal = (node) => node.endsWith(` ${original.node}`)
  const meaningful = (s) =>
    s.cov > 0 &&
    (originalCov === 0 || isFormVariant(s.a.node, original.node) || (extendsOriginal(s.a.node) && s.cov >= originalCov))
  const usable = scored.filter(meaningful)
  if (usable.length === 0) return { status: 'none', alternative: null }

  const rank = (s) => [
    isFormVariant(s.a.node, original.node) ? 1 : 0, // plural/singular forms first
    Math.round(s.a.similarity / 0.02), // similarity in bands of 0.02
    extendsOriginal(s.a.node) ? 1 : 0,
    s.cov, // quick-check coverage (secondary)
    (s.a.out_degree || 0) + (s.a.in_degree || 0), // last tie-break only; not a sign of stronger evidence
    s.a.similarity,
  ]
  usable.sort((x, y) => {
    const rx = rank(x)
    const ry = rank(y)
    for (let i = 0; i < rx.length; i += 1) if (rx[i] !== ry[i]) return ry[i] - rx[i]
    return 0
  })
  return { status: 'ready', alternative: usable[0].a }
}
