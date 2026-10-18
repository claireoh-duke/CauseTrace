import { useEffect } from 'react'
import ClassBadges from './ClassBadges'
import { fmt, sumClasses } from '../evidenceClasses'

function PathCard({ path, active, activeEdgeId, onSelectPath, onSelectEdge }) {
  const totals = sumClasses(path.edges)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`path-card${active ? ' active' : ''}`}
      onClick={() => onSelectPath(path.path_index)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectPath(path.path_index)}
    >
      <div className="path-line">
        {path.nodes.map((n, i) => (
          <span key={n.node_id} className="path-seg">
            <span className="path-node">{n.node}</span>
            {i < path.edges.length && (
              <button
                type="button"
                className={`path-edge${activeEdgeId === path.edges[i].edge_id ? ' on' : ''}`}
                aria-pressed={activeEdgeId === path.edges[i].edge_id}
                title="Open the papers behind this connection"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectEdge(path.path_index, path.edges[i])
                }}
              >
                → <span className="tiny">{fmt(path.edges[i].claim_rows)} row{path.edges[i].claim_rows === 1 ? '' : 's'} · {fmt(path.edges[i].unique_papers)} paper
                {path.edges[i].unique_papers === 1 ? '' : 's'}</span>
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="path-meta small">
        <span className="muted">{path.hops} hop{path.hops === 1 ? '' : 's'}</span>
        <ClassBadges totals={totals} />
        {path.joins_findings_across_papers && (
          <span
            className="badge join"
            title="No single paper supports every connection in this path. Findings from different papers are joined; their compatibility is unassessed."
          >
            joins different papers
          </span>
        )}
        {path.papers_on_every_edge.length > 0 && (
          <span className="badge" title={path.papers_on_every_edge.join(', ')}>
            {path.papers_on_every_edge.length} paper(s) on every edge
          </span>
        )}
      </div>
    </div>
  )
}

const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ChannelsPanel({ panelRef, retrieval, flash, outdated, result, activeIndex, selectedEdge, onSelectPath, onSelectEdge }) {
  // When a new set of results arrives, bring the panel into view only if it is not already fully visible.
  useEffect(() => {
    const el = panelRef.current
    if (!flash || !el) return
    const rect = el.getBoundingClientRect()
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight + 1
    if (!fullyVisible) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
  }, [flash, panelRef])

  return (
    <section className="panel channels-panel" aria-label="Retrieved channels" ref={panelRef} tabIndex={-1}>
      {/* Re-mounted on every retrieval so the attention ring plays once. */}
      {flash > 0 && <div key={flash} className="flash-ring" aria-hidden="true" />}
      <div className="panel-head">
        <h2>Retrieved channels</h2>
        {result?.found && (
          <span className="muted small">
            {fmt(result.paths.length)} possible connection(s) · {fmt(result.channels.length)} group(s)
            {result.truncated && ' · partial'}
          </span>
        )}
      </div>
      <div className="panel-body">
        {retrieval.state === 'idle' && (
          <div className="muted small">
            Choose a starting and an outcome concept in Ask CauseTrace, then press “Confirm &amp; find connections”. Possible connections will appear here.
          </div>
        )}
        {retrieval.state === 'loading' && <div className="muted small"><span className="spinner" aria-hidden="true" /> Finding connections…</div>}
        {retrieval.state === 'error' && <div className="error small">{retrieval.error}</div>}
        {result && !result.found && (
          <div className="warn small">
            No connections found with the current search settings. This does not mean the concepts are unrelated.
          </div>
        )}
        {result?.found && (
          <>
            {outdated && (
              <div className="notice warn-notice small">
                These results are from an earlier search. You changed the concepts or settings; press “Confirm &amp; find connections” to update.
              </div>
            )}
            {result.truncated && <div className="notice warn-notice small">Only part of the available results is shown.</div>}
            <details className="why small">
              <summary>Why?</summary>
              Retrieved paths are candidates, not proven causal pathways. Connections are grouped by a shared intermediate concept.
              Some links come from different papers, so the complete chain has not been independently verified. Path length and
              paper counts do not measure how credible a connection is.
            </details>
            {result.channels.map((group, i) => (
              <details key={group.via} open={i < 3} className="group">
                <summary>
                  <span className="group-title">
                    {group.via === '(direct edge)' ? 'Direct edge' : <>via <b>{group.via}</b></>}
                  </span>
                  <span className="muted small"> · {group.path_count} path{group.path_count === 1 ? '' : 's'}</span>
                </summary>
                {group.path_indices.map((idx) => (
                  <PathCard
                    key={idx}
                    path={result.paths[idx]}
                    active={activeIndex === idx}
                    activeEdgeId={selectedEdge && selectedEdge.pathIndex === idx ? selectedEdge.edgeId : null}
                    onSelectPath={onSelectPath}
                    onSelectEdge={onSelectEdge}
                  />
                ))}
              </details>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
