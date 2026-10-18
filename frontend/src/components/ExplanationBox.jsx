import { useEffect, useRef } from 'react'
import { CLASS_LABEL, fmt } from '../evidenceClasses'

const EV = /(ev\d+)/g

// Render text with evidence IDs as clickable chips. IDs that are not in `citations` stay plain text.
function WithCitations({ text, citations, onCitation }) {
  return text.split(EV).map((part, i) => {
    const citation = citations[part]
    if (!citation) return <span key={i}>{part}</span>
    return <CitationChip key={i} id={part} citation={citation} onCitation={onCitation} />
  })
}

function CitationChip({ id, citation, onCitation }) {
  return (
    <button
      type="button"
      className="cite"
      onClick={() => onCitation(citation)}
      title={`${citation.paper_id || 'unknown paper'}${citation.year ? ` · ${citation.year}` : ''} · ${
        CLASS_LABEL[citation.evidence_class] || citation.evidence_class
      } — click to open the record`}
    >
      {id}
    </button>
  )
}

export default function ExplanationBox({ explanation, onCitation }) {
  const { state, error, data, message } = explanation
  const ref = useRef(null)

  useEffect(() => {
    if (state === 'done' && ref.current) ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [state])

  return (
    <div className="answer-box" ref={ref} aria-live="polite">
      <div className="step-title">AI explanation <span className="muted small">(optional)</span></div>

      {state === 'loading' && (
        <div className="muted small"><span className="spinner" aria-hidden="true" /> Writing an explanation from a sample of the retrieved records… this can take about 20 seconds.</div>
      )}
      {state === 'error' && <div className="error small">{error}</div>}
      {state === 'done' && !data && <div className="warn small">{message}</div>}

      {state === 'done' && data && (
        <>
          <div className="badge-row">
            <span className="badge off">{data.model} · generated, not verified against papers</span>
            {data.grounding.is_subset && <span className="badge join">summarizes a subset</span>}
          </div>
          <div className="muted small">
            Scope: {fmt(data.grounding.paths_sent_to_model)} of {fmt(data.grounding.paths_retrieved)} retrieved paths, not only the
            path you selected.
          </div>

          <div className="field-label">Overall summary · links findings from several papers, not independently verified</div>
          <p className="answer-text">
            <WithCitations text={data.answer} citations={data.citations} onCitation={onCitation} />
          </p>
          {data.answer_strong_wording && (
            <div className="warn tiny">
              Wording may be stronger than the records: the dataset records that a link was claimed, not an established effect.
            </div>
          )}

          <div className="field-label">Individual records behind each connection</div>
          {data.claims.length === 0 && <div className="muted small">The model listed no claims.</div>}
          {data.claims.map((claim, i) => (
            <div key={i} className={`claim${claim.grounded ? '' : ' ungrounded'}`}>
              <div className="claim-edge small">{claim.edge || '(no edge named)'}</div>
              <div className="small">{claim.statement}</div>
              <div className="badge-row">
                {claim.evidence_ids.map((id) => (
                  <CitationChip key={id} id={id} citation={data.citations[id]} onCitation={onCitation} />
                ))}
                {!claim.grounded && <span className="badge join">no valid citation for this edge</span>}
                {claim.strong_wording && <span className="badge join" title="Contains a causal verb such as affects or influences.">wording may overstate</span>}
                {claim.ids_from_other_edges.length > 0 && (
                  <span className="badge join">cited IDs belong to other edges: {claim.ids_from_other_edges.join(', ')}</span>
                )}
              </div>
            </div>
          ))}
          {data.invalid_citation_ids.length > 0 && (
            <div className="warn small">
              The model cited IDs that were not in the supplied records and they were removed: {data.invalid_citation_ids.join(', ')}.
            </div>
          )}

          <div className="field-label">Limitations (computed from the records sent)</div>
          <ul className="caveats small">
            {data.limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>

          <details className="small legend-details">
            <summary>Grounding: what the model saw</summary>
            <ul>
              <li>Paths: {fmt(data.grounding.paths_sent_to_model)} of {fmt(data.grounding.paths_retrieved)} retrieved.</li>
              <li>
                Records: {fmt(data.grounding.records_sent_to_model)} of {fmt(data.grounding.records_in_sent_edges)} on those edges
                (up to {data.grounding.max_records_per_edge} per edge).
              </li>
              <li>{data.grounding.path_selection}</li>
              <li>Pack size: {fmt(data.grounding.pack_chars)} characters.</li>
              <li>
                Paths summarized:{' '}
                {data.paths_summarized.map((p) => `${p.path_id} (${p.node_ids.length - 1} hops)`).join(', ')}
              </li>
            </ul>
          </details>
          <ul className="caveats tiny">
            {data.fixed_notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}
