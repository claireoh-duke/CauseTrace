import { useEffect, useMemo, useRef, useState } from 'react'
import { relationLabel, wordingNote } from '../concepts'
import { fmt } from '../evidenceClasses'
import { conceptPool, pickSuggestion } from '../suggestion'
import { pairKey, useQuickChecks } from '../useQuickChecks'
import ConceptSide from './ConceptSide'
import ExplanationBox from './ExplanationBox'

// Values the backend actually supports. Defaults live in App.
const HOP_OPTIONS = [1, 2, 3, 4]
const PATH_OPTIONS = [20, 50, 100, 200]
const TIME_OPTIONS = [2, 5, 10, 20]

const HINT_TITLE =
  'Quick check, not a retrieval result: up to 3 connections, at most 20 paths, 2 s, against the currently selected concept on the other side. ' +
  'A path count says nothing about how strong the evidence is.'

function hintInfo(check, other) {
  if (!other) return null
  if (!check) return { text: 'Checking…', tone: 'pending', title: HINT_TITLE }
  if (check.state === 'error') return null
  if (check.count === 0) return { text: 'No paths found', tone: 'none', title: HINT_TITLE }
  return {
    text: `${check.count}${check.more ? '+' : ''} possible path${check.count === 1 ? '' : 's'}`,
    tone: 'ok',
    title: HINT_TITLE,
  }
}

// Starting points for the question box. They are questions to explore, not validated findings.
const EXAMPLE_QUESTIONS = [
  'How does inflation affect stock prices?',
  'How does economic growth affect stock prices?',
  'How do interest rates affect investment?',
]

const unique = (ids) => [...new Set(ids)]

// Cards for one side: the concept matched from the user's wording, at most one suggestion,
// then anything the user searched for or picked elsewhere.
function buildCards({ pool, suggestion, extras, selected, hintFor }) {
  const cards = []
  const seen = new Set()
  const add = (concept, label, title) => {
    if (!concept || seen.has(concept.node_id)) return
    seen.add(concept.node_id)
    cards.push({ concept, label, title, hint: hintFor(concept) })
  }
  if (pool.original) {
    add(
      pool.original,
      pool.original.relation === 'same' ? 'Your wording' : 'Closest match',
      pool.original.relation === 'same' ? 'A concept with exactly the wording in your question' : 'The closest concept to the wording in your question',
    )
  }
  if (suggestion.alternative) {
    const alt = suggestion.alternative
    add(alt, 'Suggested', `${wordingNote(alt.node, pool.original.node)}. Chosen for similar meaning; check it is what you intend. It is a different concept in the data.`)
  }
  extras.forEach((c) => add(c, 'Your search', 'Concept you searched for'))
  if (selected) {
    add(
      selected,
      selected.relation === 'unchanged' ? 'Previous search' : selected.relation === 'related' ? 'Suggested' : 'From the graph',
      'Currently selected',
    )
  }
  return cards
}

export default function AskPanel({
  source,
  target,
  onSourceChange,
  onTargetChange,
  onSwap,
  onRetrieve,
  retrieval, // { state, error, result }
  llm,
  onRefreshLlm,
  parsed,
  parseState,
  onAsk,
  onExplain,
  explanation,
  onCitation,
  suggestions,
  onUseSuggestion,
  limits,
  onLimitsChange,
  staleReason, // null | 'concepts' | 'settings'
  onViewConnections,
  onStartOver,
}) {
  const [question, setQuestion] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [extras, setExtras] = useState({ source: [], target: [] })
  const bodyRef = useRef(null)
  const questionRef = useRef(null)
  const confirmRef = useRef(null)
  const statusRef = useRef(null)

  const { state, error, result } = retrieval
  const busy = state === 'loading' || parseState.state === 'loading' || explanation.state === 'loading'

  // A new question resets manual picks (adjusting state during render, per React guidance).
  const parsedId = parsed ? parsed.question : null
  const [seenParsed, setSeenParsed] = useState(parsedId)
  if (seenParsed !== parsedId) {
    setSeenParsed(parsedId)
    setExtras({ source: [], target: [] })
  }

  // When a question has been understood, bring the concept cards to the top of this panel's scroll area.
  useEffect(() => {
    const body = bodyRef.current
    const box = confirmRef.current
    if (!parsedId || !body || !box) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    body.scrollBy({ top: box.getBoundingClientRect().top - body.getBoundingClientRect().top - 8, behavior: reduce ? 'auto' : 'smooth' })
  }, [parsedId])

  // When a search finishes, show its status (and the View connections button) inside this panel's scroll area.
  useEffect(() => {
    const body = bodyRef.current
    const card = statusRef.current
    if (state !== 'done' || !body || !card) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gap = card.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom
    if (gap > 0) body.scrollBy({ top: gap + 12, behavior: reduce ? 'auto' : 'smooth' })
  }, [state, result])

  const srcPool = useMemo(() => conceptPool(parsed && parsed.source), [parsed])
  const tgtPool = useMemo(() => conceptPool(parsed && parsed.target), [parsed])

  const sourceIds = unique([
    ...(srcPool.original ? [srcPool.original.node_id] : []),
    ...srcPool.alternatives.map((c) => c.node_id),
    ...extras.source.map((c) => c.node_id),
    ...(source ? [source.node_id] : []),
  ])
  const targetIds = unique([
    ...(tgtPool.original ? [tgtPool.original.node_id] : []),
    ...tgtPool.alternatives.map((c) => c.node_id),
    ...extras.target.map((c) => c.node_id),
    ...(target ? [target.node_id] : []),
  ])
  const idsKey = `${sourceIds.join(',')}|${targetIds.join(',')}`
  const pairs = useMemo(
    () => sourceIds.flatMap((s) => targetIds.filter((t) => t !== s).map((t) => [s, t])),
    // idsKey captures both id lists
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  )
  const checks = useQuickChecks(pairs)

  // Best quick-check path count of a concept against anything offered on the other side; null while checking.
  const coverage = (id, otherIds, side) => {
    let best = 0
    for (const other of otherIds) {
      if (other === id) continue
      const check = checks[side === 'source' ? pairKey(id, other) : pairKey(other, id)]
      if (!check) return null
      if (check.state === 'done') best = Math.max(best, check.count)
    }
    return best
  }
  const offered = (pool) => [...(pool.original ? [pool.original.node_id] : []), ...pool.alternatives.map((c) => c.node_id)]
  const sourceSuggestion = pickSuggestion(srcPool.original, srcPool.alternatives, (id) => coverage(id, offered(tgtPool), 'source'))
  const targetSuggestion = pickSuggestion(tgtPool.original, tgtPool.alternatives, (id) => coverage(id, offered(srcPool), 'target'))

  const sourceCards = buildCards({
    pool: srcPool,
    suggestion: sourceSuggestion,
    extras: extras.source,
    selected: source,
    hintFor: (c) => hintInfo(target ? checks[pairKey(c.node_id, target.node_id)] : null, target),
  })
  const targetCards = buildCards({
    pool: tgtPool,
    suggestion: targetSuggestion,
    extras: extras.target,
    selected: target,
    hintFor: (c) => hintInfo(source ? checks[pairKey(source.node_id, c.node_id)] : null, source),
  })

  const ready = Boolean(source && target && source.node_id !== target.node_id)
  const showConfirm = Boolean(parsed || source || target || manualOpen || (llm.checked && !llm.ready))
  const askDisabled = !llm.ready || !question.trim() || busy
  const resultCurrent = Boolean(result) && !staleReason

  function pick(side, concept) {
    setExtras((prev) => ({ ...prev, [side]: [...prev[side].filter((c) => c.node_id !== concept.node_id), concept] }))
    if (side === 'source') onSourceChange(concept)
    else onTargetChange(concept)
  }

  function swap() {
    onSwap()
    setExtras((prev) => ({ source: prev.target, target: prev.source }))
  }

  const setLimit = (key) => (e) => onLimitsChange({ ...limits, [key]: Number(e.target.value) })

  return (
    <section className="panel ask-panel" aria-label="Ask CauseTrace">
      <div className="panel-head">
        <h2>Ask CauseTrace</h2>
        <div className="head-actions">
          {!llm.checked ? (
            <span className="badge">checking AI…</span>
          ) : llm.ready ? (
            <span className="badge exact" title="Local model served by Ollama on this machine">AI ready</span>
          ) : (
            <span className="badge off" title={llm.error || ''}>AI unavailable</span>
          )}
          <button type="button" className="secondary small-btn" onClick={onStartOver} title="Clear this exploration and return to the start">
            <span aria-hidden="true">↺</span> Start over
          </button>
        </div>
      </div>

      <div className="panel-body" ref={bodyRef}>
        {/* A · Ask */}
        <div className="field">
          <label className="step-title" htmlFor="question">Ask a question</label>
          <textarea
            id="question"
            ref={questionRef}
            className="question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !askDisabled) {
                e.preventDefault()
                onAsk(question.trim())
              }
            }}
            placeholder="How does growth affect stock prices?"
            disabled={!llm.ready}
            maxLength={500}
          />
          <button type="button" className="primary wide" disabled={askDisabled} onClick={() => onAsk(question.trim())}>
            {parseState.state === 'loading' ? 'Reading your question…' : 'Ask'}
          </button>
          {parseState.state === 'error' && <div className="error small">{parseState.error}</div>}
          {llm.ready && !parsed && parseState.state !== 'loading' && (
            <div className="examples">
              <div className="field-label">Try an example</div>
              <div className="chips left">
                {EXAMPLE_QUESTIONS.map((example) => (
                  <button
                    type="button"
                    key={example}
                    className="chip example"
                    onClick={() => {
                      setQuestion(example) // fills the box only; nothing is asked or searched
                      if (questionRef.current) questionRef.current.focus()
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="muted tiny">Questions to explore. Results are possible connections in the data, not proven effects.</div>
            </div>
          )}
          {llm.checked && !llm.ready && (
            <div className="warn small">
              {llm.error || 'The AI model is unavailable.'} You can still search for concepts below.{' '}
              <button type="button" className="link" onClick={onRefreshLlm}>Check again</button>
            </div>
          )}
          {llm.ready && !showConfirm && (
            <button type="button" className="link" onClick={() => setManualOpen(true)}>
              Or choose concepts yourself
            </button>
          )}
        </div>

        {/* B · Confirm concepts */}
        {showConfirm && (
          <div className="confirm-box" ref={confirmRef}>
            <div className="step-title">Confirm concepts</div>
            <div className="muted small">
              {parsed
                ? 'We found these concepts in your question. Choose the ones you’d like to explore.'
                : 'Choose the concepts you’d like to explore.'}
            </div>

            <ConceptSide
              title="Starting concept"
              cards={sourceCards}
              selectedId={source ? source.node_id : null}
              onSelect={onSourceChange}
              onSearchPick={(c) => pick('source', c)}
              missingMessage={parsed && !parsed.source ? 'We couldn’t find a starting concept in your question. Search for one below.' : null}
              placeholder="Search for the cause…"
            />
            <div className="row center">
              <button type="button" className="link" onClick={swap} disabled={!source && !target}>
                ⇅ Swap direction
              </button>
            </div>
            <ConceptSide
              title="Outcome concept"
              cards={targetCards}
              selectedId={target ? target.node_id : null}
              onSelect={onTargetChange}
              onSearchPick={(c) => pick('target', c)}
              missingMessage={parsed && !parsed.target ? 'We couldn’t find an outcome concept in your question. Search for one below.' : null}
              placeholder="Search for the effect…"
            />
            {source && target && source.node_id === target.node_id && (
              <div className="warn small">The starting and outcome concepts are the same. Choose two different concepts.</div>
            )}

            <button type="button" className="primary wide confirm" disabled={!ready || busy} onClick={onRetrieve}>
              {state === 'loading' ? 'Searching…' : 'Confirm & find connections →'}
            </button>

            <details className="small legend-details">
              <summary>Advanced details</summary>
              <div className="muted">The search will use exactly these concepts:</div>
              <ul>
                <li>source_id {source ? `${source.node_id} (${source.node})` : '—'}</li>
                <li>target_id {target ? `${target.node_id} (${target.node})` : '—'}</li>
              </ul>
              <table className="adv-table">
                <thead>
                  <tr><th>Concept</th><th>Node ID</th><th>Similarity</th><th>Out / in edges</th><th>Relation</th></tr>
                </thead>
                <tbody>
                  {[...sourceCards.map((c) => ['start', c]), ...targetCards.map((c) => ['outcome', c])].map(([side, c]) => (
                    <tr key={`${side}-${c.concept.node_id}`}>
                      <td>{c.concept.node} <span className="muted">({side})</span></td>
                      <td>{c.concept.node_id}</td>
                      <td>{c.concept.similarity !== undefined ? c.concept.similarity.toFixed(3) : '–'}</td>
                      <td>{c.concept.out_degree !== undefined ? `${fmt(c.concept.out_degree)} / ${fmt(c.concept.in_degree)}` : '–'}</td>
                      <td>{relationLabel(c.concept) || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted tiny">
                Similarity is the cosine similarity of text embeddings. It is not causal confidence. A card’s path hint is a quick
                check (up to 3 connections), and neither it nor an edge count measures how strong the evidence is. Suggestions are
                chosen by similar wording first; connectivity is only a late tie-breaker.
              </div>
              {result && (
                <div className="diag">
                  <b>Last search</b>: ≤{result.limits.max_hops} connections, ≤{result.limits.max_paths} results, ≤{result.limits.time_limit_s}s,
                  took {result.elapsed_s}s,{' '}
                  {result.truncated ? `stopped early (${result.truncated_reason})` : 'finished within these limits'}.
                  {result.found && (
                    <ul className="caveats">
                      {result.caveats.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </details>
          </div>
        )}

        {/* C · Result status (the paths themselves live in Retrieved Channels) */}
        {state !== 'idle' && (
          <div className={`status-card${staleReason ? ' stale' : ''}`} aria-live="polite" ref={statusRef}>
            {state === 'loading' && (
              <>
                <div className="status-title"><span className="spinner" aria-hidden="true" /> Finding connections…</div>
                <div className="muted small">Searching the graph within your search settings.</div>
              </>
            )}
            {state === 'error' && (
              <>
                <div className="status-title error">Something went wrong</div>
                <div className="small">{error}</div>
                <div className="muted small">Check that the backend is running, then press “Confirm &amp; find connections” again.</div>
              </>
            )}
            {state === 'done' && result && (
              <>
                {staleReason ? (
                  <>
                    <div className="status-title warn">These results are out of date</div>
                    <div className="small">
                      {staleReason === 'concepts'
                        ? 'You changed the concepts after this search.'
                        : 'You changed the search settings after this search.'}{' '}
                      Press “Confirm &amp; find connections” to update them.
                    </div>
                  </>
                ) : result.found ? (
                  <>
                    <div className="status-title ok">Ready to explore</div>
                    <div className="small">Your connections are ready. Explore the results in Retrieved Channels below.</div>
                    {result.truncated && <div className="warn small">Only part of the available results is shown.</div>}
                  </>
                ) : (
                  <>
                    <div className="status-title warn">No connections found</div>
                    <div className="small">
                      We couldn’t find a connection between these concepts with the current search settings. Try another concept or
                      adjust Advanced Settings. This does not mean the concepts are unrelated.
                    </div>
                    <div className="suggestions">
                      {suggestions.state === 'loading' && <span className="muted small">Looking for related concepts that do have connections…</span>}
                      {suggestions.state === 'error' && <span className="error small">{suggestions.error}</span>}
                      {suggestions.state === 'done' && suggestions.data.suggestions.length > 0 && (
                        <>
                          <div className="field-label">Related concepts that do have connections</div>
                          <div className="muted tiny">{suggestions.data.note}</div>
                          {suggestions.data.suggestions.slice(0, 5).map((sg) => (
                            <button
                              type="button"
                              key={`${sg.source.node_id}-${sg.target.node_id}`}
                              className="candidate"
                              onClick={() => onUseSuggestion(sg)}
                            >
                              <span className="candidate-name">
                                {sg.source.node} → {sg.target.node}
                                <span className="muted tiny"> · {sg.paths_found}{sg.more_possible ? '+' : ''} possible path(s)</span>
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                )}

                {result.found && (
                  <div className="row wrap actions">
                    <button type="button" className="secondary" onClick={onViewConnections}>View connections ↙</button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!llm.ready || !resultCurrent || busy}
                      onClick={() => onExplain(question.trim() || null)}
                    >
                      {explanation.state === 'loading' ? 'Generating…' : 'Explain with AI ✨'}
                    </button>
                  </div>
                )}
                {result.found && (
                  <div className="muted tiny">
                    {llm.ready
                      ? 'Optional. The AI summarizes a sample of the retrieved paths, not only the one you select.'
                      : 'AI explanations are unavailable right now. You can still explore the connections and their evidence.'}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {explanation.state !== 'idle' && <ExplanationBox explanation={explanation} onCitation={onCitation} />}

        {/* D · Advanced settings */}
        <details className="small legend-details settings">
          <summary>Advanced Settings</summary>
          <div className="limits">
            <label>
              Maximum path length
              <select value={limits.max_hops} onChange={setLimit('max_hops')}>
                {HOP_OPTIONS.map((v) => <option key={v} value={v}>{v} connection{v === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <label>
              Maximum results
              <select value={limits.max_paths} onChange={setLimit('max_paths')}>
                {PATH_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>
              Search time limit
              <select value={limits.time_limit_s} onChange={setLimit('time_limit_s')}>
                {TIME_OPTIONS.map((v) => <option key={v} value={v}>{v} seconds</option>)}
              </select>
            </label>
          </div>
          <div className="muted tiny">These settings control search coverage, not causal confidence.</div>
          {staleReason === 'settings' && <div className="warn tiny">Settings changed. Search again to apply them.</div>}
        </details>
      </div>
    </section>
  )
}
