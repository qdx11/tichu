import { useMemo, useState } from 'react'
import { CardComponent } from './Card'
import { useGameStore } from '../../store/gameStore'
import { identifyCombo } from '../../game/combo'
import { getValidCombos } from '../../game/validator'
import type { Card, Suit } from '../../types/card'

type SortMode = 'rank_asc' | 'rank_desc' | 'suit'

const SUIT_ORDER: Suit[] = ['jade', 'sword', 'pagoda', 'star', 'special']

const SORT_BUTTONS: { mode: SortMode; label: string }[] = [
  { mode: 'rank_asc', label: '숫자↑' },
  { mode: 'rank_desc', label: '숫자↓' },
  { mode: 'suit', label: '문양' },
]

interface CardHandProps {
  cards: Card[]
  currentTrick: import('../../types/card').Combo | null
  isMyTurn: boolean
}

export function CardHand({ cards, currentTrick, isMyTurn }: CardHandProps) {
  const { selectedCards, toggleCardSelect } = useGameStore()
  const [sortMode, setSortMode] = useState<SortMode>('rank_asc')

  const sortedCards = useMemo(() => {
    const sorted = [...cards]
    if (sortMode === 'rank_asc') {
      sorted.sort((a, b) => {
        if (a.special && !b.special) return -1
        if (!a.special && b.special) return 1
        return (a.rank as number) - (b.rank as number)
      })
    } else if (sortMode === 'rank_desc') {
      sorted.sort((a, b) => {
        if (a.special && !b.special) return -1
        if (!a.special && b.special) return 1
        return (b.rank as number) - (a.rank as number)
      })
    } else {
      // 문양별: suit 그룹 → 같은 문양 내 숫자 오름차순, 특수 카드 맨 앞
      sorted.sort((a, b) => {
        if (a.special && !b.special) return -1
        if (!a.special && b.special) return 1
        const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
        if (suitDiff !== 0) return suitDiff
        return (a.rank as number) - (b.rank as number)
      })
    }
    return sorted
  }, [cards, sortMode])

  // 현재 낼 수 있는 카드 하이라이트
  const validCombos = useMemo(() => {
    if (!isMyTurn) return []
    return getValidCombos(cards, currentTrick)
  }, [cards, currentTrick, isMyTurn])

  const highlightedCardIds = useMemo(() => {
    const ids = new Set<string>()
    for (const combo of validCombos) {
      for (const card of combo.cards) ids.add(card.id)
    }
    return ids
  }, [validCombos])

  // 선택된 카드들이 유효한 족보 형성 여부
  const selectedCardObjects = cards.filter(c => selectedCards.includes(c.id))
  const selectedCombo = selectedCardObjects.length > 0 ? identifyCombo(selectedCardObjects) : null

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 정렬 버튼 + 족보 힌트 */}
      <div className="flex items-center gap-2 w-full justify-between px-1">
        <div className="flex gap-1">
          {SORT_BUTTONS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                sortMode === mode
                  ? 'bg-white/30 text-white font-semibold'
                  : 'bg-white/10 text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {isMyTurn && selectedCombo && (
          <div className="bg-black/40 text-white text-xs px-3 py-1 rounded-full">
            {getComboLabel(selectedCombo.type)} {selectedCombo.value > 0 ? `(${selectedCombo.value})` : ''}
          </div>
        )}
      </div>

      {/* 카드 목록 - 모바일: 2행 그리드(7열), 데스크톱: flex wrap */}
      <div className="lg:hidden grid grid-cols-7 gap-1 pt-3">
        {sortedCards.map(card => (
          <CardComponent
            key={card.id}
            card={card}
            selected={selectedCards.includes(card.id)}
            highlight={isMyTurn && !selectedCards.includes(card.id) && highlightedCardIds.has(card.id)}
            onClick={() => isMyTurn && toggleCardSelect(card.id)}
            size="sm"
          />
        ))}
      </div>
      <div className="hidden lg:flex flex-wrap justify-center gap-1">
        {sortedCards.map(card => (
          <CardComponent
            key={card.id}
            card={card}
            selected={selectedCards.includes(card.id)}
            highlight={isMyTurn && !selectedCards.includes(card.id) && highlightedCardIds.has(card.id)}
            onClick={() => isMyTurn && toggleCardSelect(card.id)}
            size="md"
          />
        ))}
      </div>
    </div>
  )
}

function getComboLabel(type: string): string {
  const labels: Record<string, string> = {
    SINGLE: '싱글', PAIR: '페어', TRIPLE: '트리플',
    FULL_HOUSE: '풀하우스', STRAIGHT: '스트레이트',
    STAIRS: '계단', BOMB_QUAD: '🎆 폭탄', BOMB_SF: '🎆 SF폭탄', DOG: '개',
  }
  return labels[type] ?? type
}
