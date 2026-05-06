import type { Card, Suit, Rank } from '../types/card'

const SUITS: Suit[] = ['jade', 'sword', 'pagoda', 'star']
const RANKS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export function createDeck(): Card[] {
  const deck: Card[] = []

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank: rank as Rank,
      })
    }
  }

  // 특수 카드 4장
  deck.push({ id: 'mahjong', suit: 'special', rank: 1, special: 'mahjong' })
  deck.push({ id: 'dog', suit: 'special', rank: -1, special: 'dog' })
  deck.push({ id: 'phoenix', suit: 'special', rank: 0, special: 'phoenix' })
  deck.push({ id: 'dragon', suit: 'special', rank: 15, special: 'dragon' })

  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// 4명에게 카드 배분 (그랜드티츄용 8장 or 전체 14장)
export function dealCards(deck: Card[], count: 8 | 14 = 14): Card[][] {
  const shuffled = shuffle(deck)
  const hands: Card[][] = [[], [], [], []]
  for (let i = 0; i < count * 4; i++) {
    hands[i % 4].push(shuffled[i])
  }
  return hands
}

export function getCardById(id: string, deck: Card[]): Card | undefined {
  return deck.find(c => c.id === id)
}

// 카드 값 (족보 비교용)
export function cardValue(card: Card): number {
  if (card.special === 'dragon') return 15
  if (card.special === 'phoenix') return 0  // 상황에 따라 처리
  if (card.special === 'mahjong') return 1
  if (card.special === 'dog') return -1
  return card.rank as number
}

// 점수 카드 계산
export function scoringValue(card: Card): number {
  if (card.special === 'dragon') return 25
  if (card.special === 'phoenix') return -25
  if (card.rank === 5) return 5
  if (card.rank === 10 || card.rank === 13) return 10
  return 0
}
