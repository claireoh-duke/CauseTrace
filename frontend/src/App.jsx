import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askParse, getHealth, getLlmStatus, getNeighborhood, lookupNode, postExplain, postPaths, suggestPaths } from './api'
import { fmt } from './evidenceClasses'
import { suggestionToConcept, toConcept } from './concepts'
import AskPanel from './components/AskPanel'
import ChannelsPanel from './components/ChannelsPanel'
import EvidencePanel from './components/EvidencePanel'
import GraphExplorer from './components/GraphExplorer'

// Upper bound on nodes drawn at once; the full graph is never rendered.
const VISIBLE_NODE_CAP = 400

const EMPTY_GRAPH = { nodes: {}, edges: {} }
// Suggested starting topics for the empty graph, in display order. They are resolved to existing graph nodes by exact name.
const SUGGESTED_TOPICS = ['inflation', 'monetary policy', 'government spending', 'economic growth']

// Defaults of the retrieval settings (unchanged from earlier versions of the app).
const DEFAULT_LIMITS = { max_hops: 3, max_paths: 50, time_limit_s: 5 }
const nodeInfo = (n) => ({
  node_id: n.node_id,
  node: n.node,
  out_degree: n.out_degree,
  in_degree: n.in_degree,
})

function mergeGraph(prev, nodes, edges) {
  const next = { nodes: { ...prev.nodes }, edges: { ...prev.edges } }
  for (const n of nodes) {
    const key = String(n.node_id)
    // Keep degree information if an earlier response already had it.
    next.nodes[key] = { ...(prev.nodes[key] || {}), ...Object.fromEntries(Object.entries(nodeInfo(n)).filter(([, v]) => v !== undefined)) }
  }
  for (const e of edges) next.edges[e.edge_id] = e
  return next
}

export default function App() {
  const [health, setHealth] = useState(null)
  const [backendError, setBackendError] = useState(null)
  const [topics, setTopics] = useState([])

  const [graph, setGraph] = useState(EMPTY_GRAPH)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [graphNotice, setGraphNotice] = useState(null)
  const [expanding, setExpanding] = useState(false)

  const [source, setSource] = useState(null)
  const [target, setTarget] = useState(null)
  const [retrieval, setRetrieval] = useState({ state: 'idle', error: null, result: null })
  const [activePathIndex, setActivePathIndex] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [channelsFlash, setChannelsFlash] = useState(0)
  const [limits, setLimits] = useState(DEFAULT_LIMITS)
  const channelsRef = useRef(null)
  // Every Start over bumps this id. Async handlers remember the id they started under and drop late answers.
  const sessionRef = useRef(0)
  const [session, setSession] = useState(0)

  const [llm, setLlm] = useState({ checked: false, ready: false, error: null, model: null })
  const [parsed, setParsed] = useState(null) // result of /ask/parse
  const [parseState, setParseState] = useState({ state: 'idle', error: null })
  const [suggestions, setSuggestions] = useState({ state: 'idle', error: null, data: null })
  const [explanation, setExplanation] = useState({ state: 'idle', error: null, data: null, message: null })

  const refreshLlm = useCallback(() => {
    getLlmStatus()
      .then((s) => setLlm({ checked: true, ready: s.ready, error: s.error, model: s.model }))
      .catch((err) => setLlm({ checked: true, ready: false, error: err.message, model: null }))
  }, [])

  useEffect(() => {
    getHealth().then(setHealth).catch((err) => setBackendError(err.message))
    // Look up each suggested topic by exact name; a topic that is not found is simply left out (nothing is created).
    Promise.all(SUGGESTED_TOPICS.map((name) => lookupNode(name).catch(() => null)))
      .then((found) => setTopics(found.filter((n) => n && n.found)))
    refreshLlm()
  }, [refreshLlm])

  // graphRef always holds the latest graph so the node cap can be checked synchronously.
  const graphRef = useRef(EMPTY_GRAPH)
  const commitGraph = useCallback((next) => {
    graphRef.current = next
    setGraph(next)
  }, [])

  // Returns false (and changes nothing) if the visible-node cap would be exceeded.
  const addToGraph = useCallback(
    (nodes, edges = []) => {
      const merged = mergeGraph(graphRef.current, nodes, edges)
      if (Object.keys(merged.nodes).length > VISIBLE_NODE_CAP) return false
      commitGraph(merged)
      return true
    },
    [commitGraph],
  )

  function handleAddNode(info) {
    if (!addToGraph([info])) {
      setGraphNotice(`Visible-node cap (${VISIBLE_NODE_CAP}) reached. Clear the graph to add more concepts.`)
      return
    }
    setGraphNotice(null)
    setSelectedNodeId(info.node_id)
  }

  async function handleExpand(direction) {
    if (selectedNodeId === null) return
    const sid = sessionRef.current
    setExpanding(true)
    setGraphNotice(null)
    try {
      const nb = await getNeighborhood(selectedNodeId, direction, 25)
      if (sid !== sessionRef.current) return
      if (!addToGraph(nb.nodes, nb.edges)) {
        setGraphNotice(`Visible-node cap (${VISIBLE_NODE_CAP}) would be exceeded. Clear the graph or start from another concept.`)
      } else {
        setGraphNotice(
          `${nb.center.node}: showing ${fmt(nb.edges_returned)} of ${fmt(nb.edges_total)} ${direction === 'both' ? '' : direction === 'out' ? 'outgoing ' : 'incoming '}edges, ordered by number of supporting claim rows (data volume, not causal strength).`,
        )
      }
    } catch (err) {
      if (sid === sessionRef.current) setGraphNotice(err.message)
    } finally {
      if (sid === sessionRef.current) setExpanding(false)
    }
  }

  function handleClear() {
    commitGraph(EMPTY_GRAPH)
    setSelectedNodeId(null)
    setSelectedEdge(null)
    setActivePathIndex(null)
    setGraphNotice(null)
  }

  async function handleRetrieve(pair = { source, target }) {
    const sid = sessionRef.current
    setRetrieval({ state: 'loading', error: null, result: null })
    setExplanation({ state: 'idle', error: null, data: null, message: null })
    setSuggestions({ state: 'idle', error: null, data: null })
    setActivePathIndex(null)
    setSelectedEdge(null)
    try {
      const result = await postPaths({ source_id: pair.source.node_id, target_id: pair.target.node_id, ...limits })
      if (sid !== sessionRef.current) return null
      setRetrieval({ state: 'done', error: null, result })
      addToGraph([result.source, result.target])
      setChannelsFlash((n) => n + 1)
      if (!result.found) loadSuggestions(pair)
      return result
    } catch (err) {
      if (sid !== sessionRef.current) return null
      setRetrieval({ state: 'error', error: err.message, result: null })
      return null
    }
  }

  // When nothing was found, look for related concept pairs that do have paths. The user chooses.
  async function loadSuggestions(pair) {
    const sid = sessionRef.current
    setSuggestions({ state: 'loading', error: null, data: null })
    try {
      const data = await suggestPaths({
        source_id: pair.source.node_id,
        target_id: pair.target.node_id,
        max_hops: Math.min(limits.max_hops, 3),
      })
      if (sid !== sessionRef.current) return
      setSuggestions({ state: 'done', error: null, data })
    } catch (err) {
      if (sid !== sessionRef.current) return
      setSuggestions({ state: 'error', error: err.message, data: null })
    }
  }

  function handleUseSuggestion(suggestion) {
    const pair = { source: suggestionToConcept(suggestion.source), target: suggestionToConcept(suggestion.target) }
    setSource(pair.source)
    setTarget(pair.target)
    handleRetrieve(pair)
  }

  async function handleExplain(question, pair = { source, target }) {
    const sid = sessionRef.current
    setExplanation({ state: 'loading', error: null, data: null, message: null })
    try {
      const body = await postExplain({
        source_id: pair.source.node_id,
        target_id: pair.target.node_id,
        ...limits,
        question: question || null,
      })
      if (sid !== sessionRef.current) return
      setExplanation({ state: 'done', error: null, data: body.explanation, message: body.message })
    } catch (err) {
      if (sid !== sessionRef.current) return
      setExplanation({ state: 'error', error: err.message, data: null, message: null })
      if (err.status === 503) refreshLlm()
    }
  }

  // Question -> parsed concepts. Nothing is retrieved or explained until the user confirms the concepts.
  async function handleAsk(question) {
    const sid = sessionRef.current
    setParseState({ state: 'loading', error: null })
    setParsed(null)
    setRetrieval({ state: 'idle', error: null, result: null })
    setSuggestions({ state: 'idle', error: null, data: null })
    setExplanation({ state: 'idle', error: null, data: null, message: null })
    setActivePathIndex(null)
    setSelectedEdge(null)
    setSource(null)
    setTarget(null)
    let body
    try {
      body = await askParse(question)
    } catch (err) {
      if (sid !== sessionRef.current) return
      setParseState({ state: 'error', error: err.message })
      if (err.status === 503) refreshLlm()
      return
    }
    if (sid !== sessionRef.current) return
    setParseState({ state: 'done', error: null })
    setParsed(body)
    // Pre-select the originally matched concept; the user can pick an alternative card instead.
    setSource(body.source && body.source.selected ? toConcept(body.source.selected) : null)
    setTarget(body.target && body.target.selected ? toConcept(body.target.selected) : null)
  }

  // Back to the initial Ask interface. Keeps the dataset, backend resources, AI status and Advanced Settings.
  function handleStartOver() {
    sessionRef.current += 1
    setSession(sessionRef.current)
    setParsed(null)
    setParseState({ state: 'idle', error: null })
    setSource(null)
    setTarget(null)
    setRetrieval({ state: 'idle', error: null, result: null })
    setSuggestions({ state: 'idle', error: null, data: null })
    setExplanation({ state: 'idle', error: null, data: null, message: null })
    setActivePathIndex(null)
    setSelectedEdge(null)
    setSelectedNodeId(null)
    commitGraph(EMPTY_GRAPH)
    setGraphNotice(null)
    setExpanding(false)
    setChannelsFlash(0)
  }

  function handleCitation(citation) {
    setSelectedEdge({ sourceId: citation.source_id, targetId: citation.target_id, edgeId: citation.edge_id })
    addToGraph(
      [{ node_id: citation.source_id, node: citation.source }, { node_id: citation.target_id, node: citation.target }],
      [{ edge_id: citation.edge_id, source_id: citation.source_id, target_id: citation.target_id }],
    )
  }

  const result = retrieval.result
  // Results are only "current" if they were produced for the selected concepts and the current settings.
  const conceptsChanged = Boolean(result) && (!source || !target || result.source.node_id !== source.node_id || result.target.node_id !== target.node_id)
  const settingsChanged = Boolean(result) && (
    result.limits.max_hops !== limits.max_hops ||
    result.limits.max_paths !== limits.max_paths ||
    result.limits.time_limit_s !== limits.time_limit_s
  )
  const staleReason = conceptsChanged ? 'concepts' : settingsChanged ? 'settings' : null

  function handleViewConnections() {
    const el = channelsRef.current
    if (!el) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
    el.focus({ preventScroll: true })
    setChannelsFlash((n) => n + 1)
  }
  const activePath = useMemo(() => {
    if (!result || activePathIndex === null) return null
    const path = result.paths[activePathIndex]
    return path
      ? { nodeIds: path.nodes.map((n) => String(n.node_id)), edgeIds: path.edges.map((e) => e.edge_id) }
      : null
  }, [result, activePathIndex])

  function handleSelectPath(index) {
    const path = result.paths[index]
    if (!addToGraph(path.nodes, path.edges)) {
      setGraphNotice(`Visible-node cap (${VISIBLE_NODE_CAP}) reached. Clear the graph to display this path.`)
      return
    }
    setGraphNotice(null)
    setActivePathIndex(index)
    // Choosing a path never selects one of its connections; any earlier edge selection is cleared.
    setSelectedEdge(null)
  }

  function handleSelectEdgeFromCard(index, edge) {
    handleSelectPath(index)
    // pathIndex ties the selection to this card; the same edge in other cards stays neutral.
    setSelectedEdge({ sourceId: edge.source_id, targetId: edge.target_id, edgeId: edge.edge_id, pathIndex: index })
  }

  const counts = health?.counts

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>CauseTrace</h1>
          <span className="muted small">Traceable economic cause → effect paths from a claim dataset</span>
        </div>
        {backendError ? (
          <div className="error small">{backendError}</div>
        ) : counts ? (
          <div className="stats small" title="Rows, papers and graph edges are different units.">
            <span><b>{fmt(counts.claim_rows)}</b> claim rows</span>
            <span><b>{fmt(counts.unique_paper_ids)}</b> distinct papers</span>
            <span><b>{fmt(counts.graph_edges)}</b> directed pairs</span>
            <span><b>{fmt(counts.graph_nodes)}</b> concepts</span>
          </div>
        ) : (
          <span className="muted small">Connecting to backend…</span>
        )}
      </header>

      <main className="layout">
        <GraphExplorer
          graph={graph}
          totals={counts}
          selectedNodeId={selectedNodeId}
          activePath={activePath}
          sourceId={source ? source.node_id : null}
          targetId={target ? target.node_id : null}
          topics={topics}
          notice={graphNotice}
          busy={expanding}
          onSelectNode={setSelectedNodeId}
          onSelectEdge={setSelectedEdge}
          onAddNode={handleAddNode}
          onExpand={handleExpand}
          onSetSource={(n) => setSource(n)}
          onSetTarget={(n) => setTarget(n)}
          onClear={handleClear}
        />
        <AskPanel
          key={session}
          source={source}
          target={target}
          onSourceChange={setSource}
          onTargetChange={setTarget}
          onSwap={() => {
            setSource(target)
            setTarget(source)
            setParsed((p) => (p ? { ...p, source: p.target, target: p.source } : p))
          }}
          onRetrieve={() => handleRetrieve()}
          retrieval={retrieval}
          llm={llm}
          onRefreshLlm={refreshLlm}
          parsed={parsed}
          parseState={parseState}
          onAsk={handleAsk}
          onExplain={handleExplain}
          explanation={explanation}
          onCitation={handleCitation}
          suggestions={suggestions}
          onUseSuggestion={handleUseSuggestion}
          limits={limits}
          onLimitsChange={setLimits}
          staleReason={staleReason}
          onViewConnections={handleViewConnections}
          onStartOver={handleStartOver}
        />
        <ChannelsPanel
          panelRef={channelsRef}
          outdated={Boolean(staleReason)}
          retrieval={retrieval}
          flash={channelsFlash}
          result={result}
          activeIndex={activePathIndex}
          selectedEdge={selectedEdge}
          onSelectPath={handleSelectPath}
          onSelectEdge={handleSelectEdgeFromCard}
        />
        <EvidencePanel edge={selectedEdge} />
      </main>
    </div>
  )
}
