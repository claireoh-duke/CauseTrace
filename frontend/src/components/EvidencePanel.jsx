import { useEffect, useState } from 'react'
import { getEdgeEvidence } from '../api'
import { ClassBadge } from './ClassBadges'
import ClassBadges from './ClassBadges'
import { CLASS_LABEL, CLASS_ORDER, fmt, plural } from '../evidenceClasses'

export default function EvidencePanel({ edge }) {
  // The loaded result is keyed by the edge it belongs to, so loading is derived, not set.
  const [loaded, setLoaded] = useState({ edge: null, data: null, error: null })

  useEffect(() => {
    if (!edge) return undefined
    let cancelled = false
    getEdgeEvidence(edge.sourceId, edge.targetId, 100)
      .then((data) => { if (!cancelled) setLoaded({ edge, data, error: null }) })
      .catch((err) => { if (!cancelled) setLoaded({ edge, data: null, error: err.message }) })
    return () => { cancelled = true }
  }, [edge])

  const current = edge && loaded.edge === edge
  const state = !edge ? 'idle' : !current ? 'loading' : loaded.error ? 'error' : 'done'
  const data = current ? loaded.data : null
  const error = current ? loaded.error : null

  return (
    <section className="panel evidence-panel" aria-label="Edge evidence">
      <div className="panel-head">
        <h2>Evidence</h2>
      </div>
      <div className="panel-body">
        {!edge && (
          <div className="muted small">Select a connection (→) in a path, or an edge in the graph, to see the papers behind it.</div>
        )}
        {edge && state === 'loading' && <div className="muted small">Loading records…</div>}
        {edge && state === 'error' && <div className="error small">{error}</div>}
        {edge && state === 'done' && data && (
          <>
            <div className="edge-title">
              <b>{data.source}</b> <span className="arrow">→</span> <b>{data.target}</b>
            </div>
            <div className="counts small">
              <span><b>{plural(data.claim_rows, 'claim row')}</b></span>
              <span><b>{plural(data.unique_papers, 'distinct paper')}</b></span>
              <span><b>{plural(data.evidence_records_total, 'distinct record')}</b></span>
              {data.rows_without_paper_id > 0 && <span>{fmt(data.rows_without_paper_id)} rows lack a paper id</span>}
            </div>
            <ClassBadges totals={data.evidence_class_rows} />
            <details className="small legend-details">
              <summary>What do these labels mean?</summary>
              <ul>
                {CLASS_ORDER.map((key) => (
                  <li key={key}><b>{CLASS_LABEL[key]}:</b> {data.evidence_class_meaning[key]}</li>
                ))}
              </ul>
              <div className="muted">A causal-method tag is dataset metadata, not proof that identification is valid.</div>
            </details>

            {data.evidence.map((rec) => (
              <article key={rec.evidence_id} className="record">
                <div className="record-top">
                  <code>{rec.evidence_id}</code>
                  <ClassBadge evidenceClass={rec.evidence_class} />
                  {rec.row_count > 1 && <span className="badge">{rec.row_count} identical rows</span>}
                </div>
                <div className="record-title">{rec.title || <i className="muted">(no title recorded)</i>}</div>
                <dl className="small">
                  <dt>Paper</dt><dd>{rec.paper_id || '–'}{rec.year ? ` · ${rec.year}` : ''}</dd>
                  <dt>Recorded method</dt><dd>{rec.causal_inference_method || '–'}</dd>
                  <dt>Causal-method flag</dt>
                  <dd>{rec.is_method_causal_inference === null ? '–' : rec.is_method_causal_inference}</dd>
                  <dt>Exogenous variation</dt>
                  <dd>{rec.sources_of_exogenous_variation || <span className="muted">none recorded</span>}</dd>
                  <dt>JEL (cause / effect)</dt><dd>{rec.jel_cause || '–'} / {rec.jel_effect || '–'}</dd>
                  <dt>Row ids</dt><dd className="muted">{rec.row_ids.join(', ')}</dd>
                </dl>
              </article>
            ))}
            {data.truncated && (
              <div className="notice small">
                Showing {data.evidence_records_returned} of {data.evidence_records_total} records.
              </div>
            )}
            <ul className="caveats small">
              {data.unassessed.map((u) => <li key={u}>{u}</li>)}
              <li>Titles and fields are shown as recorded in the dataset.</li>
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
