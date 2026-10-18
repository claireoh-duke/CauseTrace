// Thin client for the local CauseTrace FastAPI backend.

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options) {
  let response
  try {
    response = await fetch(BASE + path, options)
  } catch {
    throw new ApiError(`Backend is not reachable at ${BASE}. Is it running?`, 0)
  }
  if (!response.ok) {
    let detail = null
    try {
      detail = (await response.json()).detail
    } catch {
      /* body was not JSON */
    }
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join('; ')
          : `Request failed (HTTP ${response.status}).`
    throw new ApiError(message, response.status)
  }
  return response.json()
}

const qs = (params) => new URLSearchParams(params).toString()

export const getHealth = () => request('/health')
export const getOverview = (topN = 10) => request(`/graph/overview?${qs({ top_n: topN })}`)
export const searchNodes = (query, topK = 8) =>
  request(`/nodes/search?${qs({ query, top_k: topK })}`)
export const lookupNode = (name) => request(`/nodes/lookup?${qs({ name })}`)
export const getNeighborhood = (nodeId, direction, limit = 25) =>
  request(`/graph/neighborhood?${qs({ node_id: nodeId, direction, limit })}`)
export const getEdgeEvidence = (sourceId, targetId, limit = 100) =>
  request(`/edges/evidence?${qs({ source_id: sourceId, target_id: targetId, limit })}`)
export const postPaths = (body) =>
  request('/paths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const getLlmStatus = () => request('/llm/status')
export const askParse = (question) =>
  request('/ask/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
export const postExplain = (body) =>
  request('/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
export const suggestPaths = (body) =>
  request('/paths/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
