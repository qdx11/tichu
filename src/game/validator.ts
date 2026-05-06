import type { Card, Combo } from '../types/card'
import { identifyCombo, canBeat } from './combo'

// 손패에서 만들 수 있는 모든 유효한 콤보 반환
export function getValidCombos(hand: Card[], currentTrick: Combo | null): Combo[] {
  const combos: Combo[] = []
  const n = hand.length

  // 선공이면 모든 유효 족보 가능
  const targetLength = currentTrick?.length ?? null

  // 개 카드 단독 (선공일 때만)
  if (!currentTrick) {
    const dog = hand.find(c => c.special === 'dog')
    if (dog) {
      const combo = identifyCombo([dog])
      if (combo) combos.push(combo)
    }
  }

  // 1~5장 조합 생성 (6장 이상은 스트레이트/계단/폭탄SF만)
  for (let size = 1; size <= Math.min(n, 14); size++) {
    // 길이가 맞지 않는 경우 스킵 (폭탄 제외)
    if (targetLength && size !== targetLength) {
      // 폭탄은 항상 허용
      if (size !== 4 && size < 5) continue
    }

    const subsets = getSubsets(hand, size)
    for (const subset of subsets) {
      const combo = identifyCombo(subset)
      if (!combo) continue

      // 선공이면 모든 유효 족보 추가 (DOG 제외 - 이미 처리)
      if (!currentTrick) {
        if (combo.type !== 'DOG') combos.push(combo)
        continue
      }

      // 낼 수 있는지 확인
      if (canBeat(combo, currentTrick)) {
        combos.push(combo)
      }
    }
  }

  // 중복 제거 (카드 조합 기준)
  return deduplicateCombos(combos)
}

// 현재 선택한 카드가 유효한 족보인지 + 낼 수 있는지
export function canPlayCards(selected: Card[], currentTrick: Combo | null): boolean {
  const combo = identifyCombo(selected)
  if (!combo) return false
  if (!currentTrick) return combo.type !== 'DOG' || selected.length === 1
  return canBeat(combo, currentTrick)
}

// 마작 요청 제약: 요청된 숫자를 낼 수 있는지
export function mustPlayMahjongRequest(
  hand: Card[],
  currentTrick: Combo | null,
  requestedRank: number,
): boolean {
  const hasRank = hand.some(c => (c.rank as number) === requestedRank && !c.special)
  if (!hasRank) return false

  const validCombos = getValidCombos(hand, currentTrick)
  return validCombos.some(combo => combo.cards.some(c => (c.rank as number) === requestedRank))
}

function getSubsets(arr: Card[], size: number): Card[][] {
  if (size === 0) return [[]]
  if (size > arr.length) return []
  if (size === arr.length) return [arr]

  const result: Card[][] = []

  function backtrack(start: number, current: Card[]) {
    if (current.length === size) {
      result.push([...current])
      return
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }

  backtrack(0, [])
  return result
}

function deduplicateCombos(combos: Combo[]): Combo[] {
  const seen = new Set<string>()
  return combos.filter(combo => {
    const key = combo.cards.map(c => c.id).sort().join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
