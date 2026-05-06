import type { Card, Combo } from '../types/card'

// 개 카드인지 확인
function isDog(card: Card) { return card.special === 'dog' }
function isPhoenix(card: Card) { return card.special === 'phoenix' }
function isDragon(card: Card) { return card.special === 'dragon' }
function isMahjong(card: Card) { return card.special === 'mahjong' }
function isSpecial(card: Card) { return !!card.special }

// 일반 숫자 카드 값 (마작=1, 드래곤=15, 피닉스 제외)
function normalValue(card: Card): number {
  if (isMahjong(card)) return 1
  if (isDragon(card)) return 15
  return card.rank as number
}

export function identifyCombo(cards: Card[]): Combo | null {
  if (cards.length === 0) return null

  // 개 단독
  if (cards.length === 1 && isDog(cards[0])) {
    return { type: 'DOG', cards, value: -1, length: 1 }
  }

  // 싱글
  if (cards.length === 1) {
    const card = cards[0]
    let value = isPhoenix(card) ? 0 : normalValue(card)
    return { type: 'SINGLE', cards, value, length: 1 }
  }

  // 피닉스가 포함된 경우 별도 처리
  const hasPhoenix = cards.some(isPhoenix)
  const nonSpecialCards = cards.filter(c => !isPhoenix(c) && !isDog(c))
  const hasDragon = cards.some(isDragon)
  // 드래곤은 싱글로만 사용 가능
  if (hasDragon && cards.length > 1) return null

  // 개는 단독으로만
  if (cards.some(isDog) && cards.length > 1) return null

  // 2장: 페어
  if (cards.length === 2) {
    return identifyPair(cards, hasPhoenix, nonSpecialCards)
  }

  // 3장: 트리플
  if (cards.length === 3) {
    return identifyTriple(cards, hasPhoenix, nonSpecialCards)
  }

  // 4장: 폭탄(4장) or 계단(2+2) or 풀하우스(불가)
  if (cards.length === 4) {
    const bomb = identifyBombQuad(cards, hasPhoenix, nonSpecialCards)
    if (bomb) return bomb
    return identifyStairs(cards, hasPhoenix, nonSpecialCards)
  }

  // 5장: 풀하우스, 스트레이트, 폭탄SF, 계단
  if (cards.length === 5) {
    const fh = identifyFullHouse(cards, hasPhoenix, nonSpecialCards)
    if (fh) return fh
  }

  // 5장+: 스트레이트, 계단, 폭탄SF
  if (cards.length >= 5) {
    const bombSF = identifyBombSF(cards)
    if (bombSF) return bombSF
    const straight = identifyStraight(cards, hasPhoenix, nonSpecialCards)
    if (straight) return straight
  }

  if (cards.length >= 4) {
    const stairs = identifyStairs(cards, hasPhoenix, nonSpecialCards)
    if (stairs) return stairs
  }

  return null
}

function identifyPair(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  if (hasPhoenix) {
    if (normals.length !== 1) return null
    if (isSpecial(normals[0])) return null
    const value = normalValue(normals[0])
    return { type: 'PAIR', cards, value, length: 2 }
  }
  if (normals.length !== 2) return null
  if (normalValue(normals[0]) !== normalValue(normals[1])) return null
  return { type: 'PAIR', cards, value: normalValue(normals[0]), length: 2 }
}

function identifyTriple(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  if (hasPhoenix) {
    if (normals.length !== 2) return null
    if (normals.some(isSpecial)) return null
    if (normalValue(normals[0]) !== normalValue(normals[1])) return null
    return { type: 'TRIPLE', cards, value: normalValue(normals[0]), length: 3 }
  }
  if (normals.length !== 3) return null
  const v = normalValue(normals[0])
  if (!normals.every(c => normalValue(c) === v)) return null
  return { type: 'TRIPLE', cards, value: v, length: 3 }
}

function identifyBombQuad(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  // 폭탄은 피닉스 사용 불가
  if (hasPhoenix) return null
  if (cards.length !== 4) return null
  if (normals.some(isSpecial)) return null
  const v = normalValue(normals[0])
  if (!normals.every(c => normalValue(c) === v)) return null
  return { type: 'BOMB_QUAD', cards, value: v, length: 4 }
}

function identifyFullHouse(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  if (cards.length !== 5) return null

  const allCards = [...normals]
  if (hasPhoenix) {
    // 피닉스를 페어 또는 트리플 중 어느 쪽으로 사용할지 시도
    return tryFullHouseWithPhoenix(allCards)
  }

  if (allCards.some(isSpecial)) return null

  const groups = groupByValue(allCards)
  const counts = Object.values(groups).sort((a, b) => a.length - b.length)
  if (counts.length !== 2) return null
  if (counts[0].length !== 2 || counts[1].length !== 3) return null
  const tripleVal = normalValue(counts[1][0])
  return { type: 'FULL_HOUSE', cards, value: tripleVal, length: 5 }
}

function tryFullHouseWithPhoenix(normals: Card[]): Combo | null {
  if (normals.length !== 4) return null
  if (normals.some(isSpecial)) return null

  const groups = groupByValue(normals)
  const entries = Object.entries(groups)

  // 3+1: 피닉스가 페어의 나머지 1장 역할
  for (const [, group] of entries) {
    if (group.length === 3) {
      const others = normals.filter(c => normalValue(c) !== normalValue(group[0]))
      if (others.length === 1) {
        const tripleVal = normalValue(group[0])
        return { type: 'FULL_HOUSE', cards: [...normals], value: tripleVal, length: 5 }
      }
    }
  }

  // 2+2: 피닉스가 트리플의 나머지 1장 역할 → 더 큰 쪽을 트리플로
  if (entries.length === 2 && entries[0][1].length === 2 && entries[1][1].length === 2) {
    const v1 = normalValue(entries[0][1][0])
    const v2 = normalValue(entries[1][1][0])
    const tripleVal = Math.max(v1, v2)
    return { type: 'FULL_HOUSE', cards: [...normals], value: tripleVal, length: 5 }
  }

  return null
}

function identifyStraight(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  if (cards.length < 5) return null

  const allNormals = normals.filter(c => !isSpecial(c) || isMahjong(c))
  const values = allNormals.map(normalValue).sort((a, b) => a - b)

  // 중복 값 있으면 스트레이트 불가
  if (new Set(values).size !== values.length) return null

  const phoenixCount = hasPhoenix ? 1 : 0
  const totalLen = values.length + phoenixCount

  if (totalLen !== cards.length) return null

  // 피닉스 없이 연속 체크
  if (!hasPhoenix) {
    if (!isConsecutive(values)) return null
    return { type: 'STRAIGHT', cards, value: values[values.length - 1], length: cards.length }
  }

  // 피닉스 와일드로 갭 하나 메우기
  const gaps = countGaps(values)
  if (gaps > 1) return null
  const maxVal = values[values.length - 1]
  return { type: 'STRAIGHT', cards, value: maxVal + (gaps === 0 ? 1 : 0), length: cards.length }
}

function identifyStairs(cards: Card[], hasPhoenix: boolean, normals: Card[]): Combo | null {
  if (cards.length < 4) return null
  if (cards.length % 2 !== 0) return null

  const allNormals = normals.filter(c => !isSpecial(c))
  const groups = groupByValue(allNormals)
  const pairs = Object.values(groups).filter(g => g.length === 2)

  if (!hasPhoenix) {
    if (pairs.length !== cards.length / 2) return null
    const pairValues = pairs.map(p => normalValue(p[0])).sort((a, b) => a - b)
    if (!isConsecutive(pairValues)) return null
    return { type: 'STAIRS', cards, value: pairValues[pairValues.length - 1], length: cards.length }
  }

  // 피닉스: 싱글 카드가 1장 있는 경우 그 값의 페어로 간주
  const singles = Object.values(groups).filter(g => g.length === 1)
  if (singles.length !== 1) return null
  const singleVal = normalValue(singles[0][0])

  const pairValues = [...pairs.map(p => normalValue(p[0])), singleVal].sort((a, b) => a - b)
  if (pairValues.length !== cards.length / 2) return null
  if (!isConsecutive(pairValues)) return null
  return { type: 'STAIRS', cards, value: pairValues[pairValues.length - 1], length: cards.length }
}

function identifyBombSF(cards: Card[]): Combo | null {
  if (cards.length < 5) return null
  if (cards.some(isSpecial)) return null

  const suit = cards[0].suit
  if (!cards.every(c => c.suit === suit)) return null

  const values = cards.map(normalValue).sort((a, b) => a - b)
  if (!isConsecutive(values)) return null

  return { type: 'BOMB_SF', cards, value: values[values.length - 1] * 100 + cards.length, length: cards.length }
}

function groupByValue(cards: Card[]): Record<number, Card[]> {
  const groups: Record<number, Card[]> = {}
  for (const card of cards) {
    const v = normalValue(card)
    if (!groups[v]) groups[v] = []
    groups[v].push(card)
  }
  return groups
}

function isConsecutive(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false
  }
  return true
}

function countGaps(sorted: number[]): number {
  let gaps = 0
  for (let i = 1; i < sorted.length; i++) {
    gaps += sorted[i] - sorted[i - 1] - 1
  }
  return gaps
}

// 두 콤보 비교: 낼 수 있는지 (현재 트릭보다 강한지)
export function canBeat(played: Combo, current: Combo): boolean {
  // 봉황 싱글: 드래곤 제외 모든 싱글 이김
  if (played.type === 'SINGLE' && played.cards[0]?.special === 'phoenix') {
    if (current.type !== 'SINGLE') return false
    return current.cards[0]?.special !== 'dragon'
  }

  // 폭탄은 항상 일반 족보 이김
  if (played.type === 'BOMB_SF' || played.type === 'BOMB_QUAD') {
    if (current.type !== 'BOMB_SF' && current.type !== 'BOMB_QUAD') return true
    // 폭탄 vs 폭탄
    if (played.type === 'BOMB_SF' && current.type === 'BOMB_QUAD') return true
    if (played.type === 'BOMB_QUAD' && current.type === 'BOMB_SF') return false
    return played.value > current.value
  }

  // 타입이 다르면 낼 수 없음 (폭탄 제외)
  if (played.type !== current.type) return false

  // 길이가 다르면 낼 수 없음 (스트레이트, 계단)
  if (['STRAIGHT', 'STAIRS'].includes(played.type) && played.length !== current.length) return false

  return played.value > current.value
}
