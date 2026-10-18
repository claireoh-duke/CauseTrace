import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import ConceptPicker from './ConceptPicker'
import { fmt } from '../evidenceClasses'

const STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#4b5a78',
      'border-width': 1,
      'border-color': '#6b7a99',
      label: 'data(label)',
      color: '#d7deec',
      'font-size': 12,
      'text-wrap': 'wrap',
      'text-max-width': 110,
      'text-valign': 'bottom',
      'text-margin-y': 4,
      width: 18,
      height: 18,
      'min-zoomed-font-size': 3,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.2,
      'line-color': '#4a5470',
      'target-arrow-color': '#4a5470',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 0.8,
    },
  },
  { selector: '.faded', style: { opacity: 0.18 } },
  {
    selector: 'node.path',
    style: { 'background-color': '#f0b429', 'border-color': '#ffd980', 'border-width': 2, color: '#fff1cf' },
  },
  {
    selector: 'edge.path',
    style: { 'line-color': '#f0b429', 'target-arrow-color': '#f0b429', width: 3 },
  },
  { selector: 'node.source', style: { 'background-color': '#4f9dff', 'border-color': '#a9d0ff', 'border-width': 3 } },
  { selector: 'node.target', style: { 'background-color': '#c084fc', 'border-color': '#e3c6ff', 'border-width': 3 } },
  { selector: 'node.selected', style: { 'border-color': '#ffffff', 'border-width': 3 } },
  { selector: 'edge:selected', style: { 'line-color': '#ffffff', 'target-arrow-color': '#ffffff', width: 3 } },
]

const shorten = (text, max = 48) => (text.length > max ? text.slice(0, max - 1) + '…' : text)

export default function GraphExplorer({
  graph,
  totals,
  selectedNodeId,
  activePath,
  sourceId,
  targetId,
  topics,
  notice,
  busy,
  onSelectNode,
  onSelectEdge,
  onAddNode,
  onExpand,
  onSetSource,
  onSetTarget,
  onClear,
}) {
  const containerRef = useRef(null)
  const cyRef = useRef(null)
  const handlers = useRef({ onSelectNode, onSelectEdge })
  useEffect(() => {
    handlers.current = { onSelectNode, onSelectEdge }
  })

  // Create the Cytoscape instance once.
  useEffect(() => {
    const cy = cytoscape({
      container: containerRef.current,
      style: STYLE,
      wheelSensitivity: 0.25,
      minZoom: 0.08,
      maxZoom: 1.4,
    })
    cy.on('tap', 'node', (e) => handlers.current.onSelectNode(e.target.id()))
    cy.on('tap', 'edge', (e) => {
      const d = e.target.data()
      handlers.current.onSelectEdge({ sourceId: Number(d.source), targetId: Number(d.target), edgeId: d.id })
    })
    cyRef.current = cy
    return () => cy.destroy()
  }, [])

  // Sync graph data into Cytoscape, adding new elements near existing neighbors.
  useEffect(() => {
    const cy = cyRef.current
    const nodeIds = new Set(Object.keys(graph.nodes))
    const edgeIds = new Set(Object.keys(graph.edges))
    let added = 0
    const hadFewNodes = cy.nodes().length <= 1

    if (nodeIds.size === 0) cy.reset()
    cy.batch(() => {
      cy.nodes().forEach((n) => { if (!nodeIds.has(n.id())) n.remove() })
      cy.edges().forEach((e) => { if (!edgeIds.has(e.id())) e.remove() })

      const width = cy.width()
      const height = cy.height()
      for (const [id, info] of Object.entries(graph.nodes)) {
        if (!cy.getElementById(id).empty()) continue
        const neighbor = Object.values(graph.edges)
          .map((e) => (String(e.source_id) === id ? String(e.target_id) : String(e.target_id) === id ? String(e.source_id) : null))
          .filter(Boolean)
          .map((other) => cy.getElementById(other))
          .find((el) => !el.empty())
        const base = neighbor
          ? neighbor.position()
          : { x: width / 2 + (Math.random() - 0.5) * 200, y: height / 2 + (Math.random() - 0.5) * 200 }
        cy.add({
          group: 'nodes',
          data: { id, label: shorten(info.node), full: info.node },
          position: { x: base.x + (Math.random() - 0.5) * 160, y: base.y + (Math.random() - 0.5) * 160 },
        })
        added++
      }
      for (const [id, e] of Object.entries(graph.edges)) {
        if (!cy.getElementById(id).empty()) continue
        cy.add({ group: 'edges', data: { id, source: String(e.source_id), target: String(e.target_id) } })
        added++
      }
    })

    if (added > 0) {
      cy.layout({
        name: 'cose',
        animate: false,
        randomize: false,
        fit: false,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: Math.min(60 + 4 * cy.nodes().length, 170),
        nodeRepulsion: () => 2500 + 150 * cy.nodes().length,
        numIter: 500,
      }).run()
      // Refit only when the layout left nodes outside the current view, so manual panning is kept otherwise.
      const view = cy.extent()
      const box = cy.nodes().boundingBox()
      if (hadFewNodes || box.x1 < view.x1 || box.x2 > view.x2 || box.y1 < view.y1 || box.y2 > view.y2) cy.fit(undefined, 30)
    }
  }, [graph])

  // Highlight state: selection, source/target, and the active candidate path.
  useEffect(() => {
    const cy = cyRef.current
    cy.elements().removeClass('path faded selected source target')
    if (activePath) {
      cy.elements().addClass('faded')
      const members = cy.collection()
      activePath.nodeIds.forEach((id) => members.merge(cy.getElementById(id)))
      activePath.edgeIds.forEach((id) => members.merge(cy.getElementById(id)))
      members.removeClass('faded').addClass('path')
    }
    if (sourceId !== null) cy.getElementById(String(sourceId)).addClass('source')
    if (targetId !== null) cy.getElementById(String(targetId)).addClass('target')
    if (selectedNodeId !== null) cy.getElementById(String(selectedNodeId)).addClass('selected')
  }, [graph, activePath, selectedNodeId, sourceId, targetId])

  // Fit the view to a newly activated path.
  useEffect(() => {
    const cy = cyRef.current
    if (!activePath) return
    const members = cy.collection()
    activePath.nodeIds.forEach((id) => members.merge(cy.getElementById(id)))
    if (!members.empty()) cy.animate({ fit: { eles: members, padding: 40 }, duration: 250 })
  }, [activePath])

  const selected = selectedNodeId !== null ? graph.nodes[String(selectedNodeId)] : null
  const visibleNodes = Object.keys(graph.nodes).length
  const visibleEdges = Object.keys(graph.edges).length

  return (
    <section className="panel graph-panel" aria-label="Knowledge graph explorer">
      <div className="panel-head">
        <h2>Knowledge graph</h2>
        <div className="counter" title="Only a bounded part of the graph is drawn at once.">
          Showing <b>{fmt(visibleNodes)}</b> of {fmt(totals?.graph_nodes)} nodes · <b>{fmt(visibleEdges)}</b> of{' '}
          {fmt(totals?.graph_edges)} edges
        </div>
      </div>

      <div className="graph-tools">
        <ConceptPicker label="Find a concept to add" value={null} onPick={onAddNode} placeholder="Search any indexed node…" />
        {/* Same structure as the search field (label row + control row) so the buttons line up with the input. */}
        <div className="field tools-actions">
          <div className="field-label" aria-hidden="true">&nbsp;</div>
          <div className="row">
            <button type="button" onClick={() => cyRef.current.fit(undefined, 60)} disabled={visibleNodes === 0}>
              Fit view
            </button>
            <button type="button" onClick={onClear} disabled={visibleNodes === 0}>
              Clear graph
            </button>
          </div>
        </div>
      </div>

      <div className="graph-canvas-wrap">
        <div ref={containerRef} className="graph-canvas" />
        {visibleNodes === 0 && (
          <div className="graph-empty">
            <span className="empty-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <path d="M12 7v4M12 11l-6 6M12 11l6 6" />
              </svg>
            </span>
            <h3 className="empty-title">Explore economic connections</h3>
            <p className="empty-desc">Explore research-backed connections between economic concepts.</p>
            {topics.length > 0 && (
              <div className="empty-topics">
                <div className="field-label">Suggested topics</div>
                <div className="chips">
                  {topics.map((h) => (
                    <button type="button" key={h.node_id} className="chip topic" onClick={() => onAddNode(h)}>
                      {h.node.charAt(0).toUpperCase() + h.node.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="empty-note">Explore a network of {fmt(totals?.graph_nodes)} economic concepts</p>
          </div>
        )}
        {visibleNodes > 0 && (
        <div className="legend small">
          <span><i className="dot src" /> source</span>
          <span><i className="dot tgt" /> target</span>
          <span><i className="dot pth" /> selected path</span>
        </div>
        )}
      </div>

      {notice && <div className="notice small">{notice}</div>}

      <div className="node-bar">
        {selected ? (
          <>
            <div className="node-bar-name" title={selected.node}>
              <b>{selected.node}</b>
              <span className="muted small">
                {' '}
                · {fmt(selected.out_degree)} out / {fmt(selected.in_degree)} in
              </span>
            </div>
            <div className="row wrap">
              <button type="button" disabled={busy} onClick={() => onExpand('out')}>Expand effects →</button>
              <button type="button" disabled={busy} onClick={() => onExpand('in')}>← Expand causes</button>
              <button type="button" disabled={busy} onClick={() => onExpand('both')}>Both</button>
              <button type="button" onClick={() => onSetSource(selected)}>Set as source</button>
              <button type="button" onClick={() => onSetTarget(selected)}>Set as target</button>
            </div>
          </>
        ) : (
          <span className="muted small">
            Click a node to expand its neighbors or use it as source/target. Click an edge to inspect its papers.
            Arrows point from cause to effect.
          </span>
        )}
      </div>
    </section>
  )
}
