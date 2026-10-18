// A "concept" is the graph node currently chosen as source or target.
// `relation` says how it relates to the wording the user gave:
//   'same'      the node has exactly the name the user typed or the model extracted
//   'related'   a different node chosen because it is semantically close (similarity shown)
//   'unchanged' the same node as in the previous search (used by "related concepts" suggestions)
// Nodes picked on the graph have no relation.

export function toConcept(candidate) {
  return {
    node_id: candidate.node_id,
    node: candidate.node,
    out_degree: candidate.out_degree,
    in_degree: candidate.in_degree,
    similarity: candidate.similarity,
    relation: candidate.is_exact ? 'same' : 'related',
  }
}

// One side of a suggested pair from /paths/suggest.
export function suggestionToConcept(side) {
  return {
    node_id: side.node_id,
    node: side.node,
    out_degree: side.out_degree,
    in_degree: side.in_degree,
    similarity: side.similarity,
    relation: side.is_original ? 'unchanged' : 'related',
  }
}

export function relationLabel(concept) {
  if (!concept) return null
  if (concept.relation === 'same') return 'same wording as you typed'
  if (concept.relation === 'unchanged') return 'unchanged from your previous search'
  if (concept.relation === 'related') {
    const sim = concept.similarity !== undefined ? ` (similarity ${concept.similarity.toFixed(2)})` : ''
    return `related concept${sim}, not the same wording`
  }
  return null
}

// Short, rule-based explanation of how an alternative's wording relates to the original node.
// Deliberately only states what can be seen from the strings; it does not claim semantic equivalence.
export function wordingNote(node, originalNode) {
  if (!originalNode || node === originalNode) return null
  if (node === `${originalNode}s` || node === `${originalNode}es`) return `Plural form of “${originalNode}”`
  if (originalNode === `${node}s` || originalNode === `${node}es`) return `Singular form of “${originalNode}”`
  return 'Related wording'
}

