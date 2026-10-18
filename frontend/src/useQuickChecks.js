import { useEffect, useRef, useState } from 'react'
import { postPaths } from './api'

// Small, bounded preview of whether a pair has any path. It reuses the retrieval endpoint but its
// output is only a count for a concept card; it is never displayed as retrieval results.
const CHECK_LIMITS = { max_hops: 3, max_paths: 20, time_limit_s: 2 }

export const pairKey = (sourceId, targetId) => `${sourceId}>${targetId}`

// `pairs` is an array of [sourceId, targetId]. Returns { 'a>b': {state, count, more} } as results arrive.
export function useQuickChecks(pairs) {
  const [checks, setChecks] = useState({})
  const requested = useRef(new Set())

  useEffect(() => {
    pairs.forEach(([s, t]) => {
      const key = pairKey(s, t)
      if (requested.current.has(key)) return
      requested.current.add(key)
      postPaths({ source_id: s, target_id: t, ...CHECK_LIMITS })
        .then((r) => setChecks((prev) => ({ ...prev, [key]: { state: 'done', count: r.paths.length, more: r.truncated } })))
        .catch(() => setChecks((prev) => ({ ...prev, [key]: { state: 'error' } })))
    })
  }, [pairs])

  return checks
}
