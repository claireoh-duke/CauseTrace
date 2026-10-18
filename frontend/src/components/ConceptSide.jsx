import { useState } from 'react'
import ConceptPicker from './ConceptPicker'

// One side (starting or outcome concept): up to two clickable cards, plus "search another concept".
// A card never switches by itself; only a click changes the selection.
export default function ConceptSide({ title, cards, selectedId, onSelect, onSearchPick, missingMessage, placeholder }) {
  const [searching, setSearching] = useState(false)
  const showSearch = searching || cards.length === 0

  return (
    <section className="side" aria-label={title}>
      <h3 className="side-title">{title}</h3>
      {missingMessage && <div className="warn small">{missingMessage}</div>}

      {cards.length > 0 && (
        <div className="cards" role="group" aria-label={`${title} options`}>
          {cards.map((card) => {
            const selected = card.concept.node_id === selectedId
            return (
              <button
                type="button"
                key={card.concept.node_id}
                aria-pressed={selected}
                className={`concept-card${selected ? ' selected' : ''}`}
                onClick={() => onSelect(card.concept)}
                title={card.title}
              >
                <span className="cc-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                <span className="cc-label">{card.label}</span>
                <span className="cc-name">{card.concept.node}</span>
                {card.hint && (
                  <span className={`cc-hint ${card.hint.tone}`} title={card.hint.title}>{card.hint.text}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {showSearch ? (
        <ConceptPicker
          label={cards.length === 0 ? 'Search for a concept' : 'Search for another concept'}
          value={null}
          onPick={(concept) => {
            onSearchPick(concept)
            setSearching(false)
          }}
          placeholder={placeholder}
        />
      ) : (
        <button type="button" className="link" onClick={() => setSearching(true)}>
          Search for another concept…
        </button>
      )}
    </section>
  )
}
