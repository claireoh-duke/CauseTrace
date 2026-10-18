import { useRef, useState } from 'react'
import { lookupNode, searchNodes } from '../api'
import { fmt } from '../evidenceClasses'
import { relationLabel, toConcept } from '../concepts'

// Search indexed nodes (exact match + semantic candidates) and pick one.
// `value` is the chosen concept, or null. `onPick` receives the concept with its degrees.
export default function ConceptPicker({ label, value, onPick, onClear, placeholder }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  async function runSearch(event) {
    event.preventDefault()
    if (!query.trim()) return
    const id = ++requestId.current
    setStatus('loading')
    setError(null)
    try {
      const body = await searchNodes(query, 8)
      if (id !== requestId.current) return
      setResponse(body)
      setStatus('done')
    } catch (err) {
      if (id !== requestId.current) return
      setError(err.message)
      setStatus('error')
    }
  }

  async function choose(result) {
    try {
      const info = await lookupNode(result.node)
      onPick({ ...toConcept(result), out_degree: info.out_degree, in_degree: info.in_degree })
      setResponse(null)
      setStatus('idle')
      setQuery('')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  if (value) {
    return (
      <div className="field">
        <div className="field-label">{label}</div>
        <div className="chosen">
          <div className="chosen-name">{value.node}</div>
          <div className="muted small">
            node {value.node_id}
            {value.out_degree !== undefined && value.in_degree !== undefined &&
              ` · ${fmt(value.out_degree)} outgoing / ${fmt(value.in_degree)} incoming edges`}
            {relationLabel(value) && ` · ${relationLabel(value)}`}
          </div>
          {value.relation === 'related' && (
            <div className="warn small">
              This is a different node from the wording you gave. Check that it is the concept you mean.
            </div>
          )}
          <button type="button" className="link" onClick={onClear}>
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <form className="row" onSubmit={runSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || 'Search indexed concepts…'}
          maxLength={500}
        />
        <button type="submit" disabled={status === 'loading' || !query.trim()}>
          Search
        </button>
      </form>
      {status === 'loading' && (
        <div className="muted small">Searching… the first search loads BGE-M3 on CPU and can take a while.</div>
      )}
      {status === 'error' && <div className="error small">{error}</div>}
      {status === 'done' && response && (
        <div className="candidates">
          {response.query_truncated && (
            <div className="warn small">
              Query exceeds {response.max_query_tokens} tokens; only the beginning was embedded.
            </div>
          )}
          {!response.exact_match && (
            <div className="muted small">
              No indexed node is named exactly “{response.normalized_query}”. Semantic candidates:
            </div>
          )}
          {response.results.length === 0 && <div className="muted small">No candidates returned.</div>}
          {response.results.map((r) => (
            <button type="button" key={r.node_id} className="candidate" onClick={() => choose(r)}>
              <span className="candidate-name">{r.node}</span>
              {r.is_exact && <span className="badge exact">exact</span>}
              <span className="sim" title="Semantic similarity only; not causal confidence. Edges = outgoing + incoming in the graph.">
                {r.similarity.toFixed(3)} · {fmt(r.out_degree + r.in_degree)} edges
              </span>
            </button>
          ))}
          <div className="muted tiny">Similarity measures text relatedness, not causal confidence.</div>
        </div>
      )}
    </div>
  )
}
