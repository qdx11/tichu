import { CardComponent } from './Card'
import type { CurrentTrick, TrickPlay } from '../../types/game'
import type { Player } from '../../types/game'
import type { Card } from '../../types/card'

interface TrickAreaProps {
  trick: CurrentTrick | null
  players: Player[]
  phase: string
  mahjongRequest: number | null
}

export function TrickArea({ trick, players, phase, mahjongRequest }: TrickAreaProps) {
  const getPlayerName = (uid: string) => players.find(p => p.uid === uid)?.nickname ?? uid

  if (!trick?.combo) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <p className="text-white/30 text-sm">
            {phase === 'playing' ? '선공 자리' : ''}
          </p>
          {mahjongRequest && (
            <p className="text-yellow-300 text-sm mt-1">
              🐦 소원 · {mahjongRequest}
            </p>
          )}
        </div>
      </div>
    )
  }

  const plays = normalizeTrickPlays(trick.plays)
  const lastPlay = plays[plays.length - 1]

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 누가 냈는지 */}
      <p className="text-white/70 text-xs">
        {lastPlay ? getPlayerName(lastPlay.uid) : ''} · {getComboLabel(trick.combo.type)}
      </p>

      {/* 낸 카드 */}
      <div className="flex gap-1 flex-wrap justify-center">
        {sortComboCards(trick.combo.cards, trick.combo.type).map(card => (
          <CardComponent key={card.id} card={card} size="md" />
        ))}
      </div>

      {mahjongRequest && (
        <p className="text-yellow-300 text-xs">🐦 소원 · {mahjongRequest}</p>
      )}
    </div>
  )
}

function sortComboCards(cards: Card[], type: string): Card[] {
  const phoenix = cards.find(c => c.special === 'phoenix')
  const normals = cards.filter(c => c.special !== 'phoenix')

  switch (type) {
    case 'STRAIGHT':
    case 'STAIRS':
    case 'BOMB_SF':
    case 'BOMB_QUAD':
      return [...cards].sort((a, b) => (a.rank as number) - (b.rank as number))

    case 'FULL_HOUSE': {
      // 같은 숫자끼리 묶고, 트리플(3장)이 먼저 오도록 정렬
      const groups = new Map<number, Card[]>()
      for (const card of normals) {
        const r = card.rank as number
        if (!groups.has(r)) groups.set(r, [])
        groups.get(r)!.push(card)
      }
      // 장수 많은 그룹 먼저, 같은 장수면 숫자 높은 쪽 먼저
      const sortedGroups = [...groups.entries()]
        .sort((a, b) => b[1].length - a[1].length || b[0] - a[0])
      const result = sortedGroups.flatMap(([, g]) => g)
      // 피닉스는 마지막에 (시각적으로 구분)
      return phoenix ? [...result, phoenix] : result
    }

    default:
      return [...cards].sort((a, b) => (a.rank as number) - (b.rank as number))
  }
}

function normalizeTrickPlays(
  plays: CurrentTrick['plays'] | Record<string, TrickPlay> | null | undefined
): TrickPlay[] {
  if (Array.isArray(plays)) return plays
  return Object.values((plays ?? {}) as Record<string, TrickPlay>)
}

function getComboLabel(type: string): string {
  const labels: Record<string, string> = {
    SINGLE: '싱글', PAIR: '페어', TRIPLE: '트리플',
    FULL_HOUSE: '풀하우스', STRAIGHT: '스트레이트',
    STAIRS: '계단', BOMB_QUAD: '폭탄!', BOMB_SF: 'SF폭탄!', DOG: '개',
  }
  return labels[type] ?? type
}
