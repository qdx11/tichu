import type { Card } from '../types/card'
import type { Player, TichuCall } from '../types/game'
import { scoringValue } from './deck'

export interface RoundResult {
  teamAPoints: number
  teamBPoints: number
  teamATichuBonus: number
  teamBTichuBonus: number
  isDoubleBigTichu: boolean
  winnerTeam: 'A' | 'B' | null
}

// 트릭에서 점수 합산
export function calcTrickScore(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + scoringValue(card), 0)
}

// 라운드 점수 계산
export function calcRoundResult(
  wonCards: Record<string, Card[]>,   // uid → 가져간 카드들
  players: Player[],
  finishOrder: string[],              // 1등~4등 uid 순서
  tichuCalls: Record<string, TichuCall>,
): RoundResult {
  const teamAPlayers = players.filter(p => p.seatIndex === 0 || p.seatIndex === 2).map(p => p.uid)
  const teamBPlayers = players.filter(p => p.seatIndex === 1 || p.seatIndex === 3).map(p => p.uid)

  // 더블 빅티오 체크 (같은 팀이 1,2등)
  const first = finishOrder[0]
  const second = finishOrder[1]
  const firstTeamA = teamAPlayers.includes(first)
  const secondTeamA = teamAPlayers.includes(second)

  if (firstTeamA === secondTeamA) {
    const winnerTeam = firstTeamA ? 'A' : 'B'

    // 더블 빅티오에도 티츄 선언 결과는 별도 적용
    let teamATichuBonus = 0
    let teamBTichuBonus = 0
    for (const [uid, call] of Object.entries(tichuCalls)) {
      if (call === 'none') continue
      const bonus = call === 'grand_tichu' ? 200 : 100
      const succeeded = finishOrder[0] === uid
      const delta = succeeded ? bonus : -bonus
      if (teamAPlayers.includes(uid)) teamATichuBonus += delta
      else teamBTichuBonus += delta
    }

    return {
      teamAPoints: firstTeamA ? 200 : 0,
      teamBPoints: firstTeamA ? 0 : 200,
      teamATichuBonus,
      teamBTichuBonus,
      isDoubleBigTichu: true,
      winnerTeam,
    }
  }

  // 일반 점수 계산
  let teamAPoints = 0
  let teamBPoints = 0

  for (const uid of teamAPlayers) {
    const cards = wonCards[uid] || []
    teamAPoints += calcTrickScore(cards)
  }
  for (const uid of teamBPlayers) {
    const cards = wonCards[uid] || []
    teamBPoints += calcTrickScore(cards)
  }

  // 꼴찌(4등) 패널티 (tichu 규칙):
  // - 꼴찌의 손패는 이미 finishRound에서 상대팀에게 wonCards로 처리됨
  // - 꼴찌가 가져간 트릭 점수는 1등에게
  const last = finishOrder[3]
  if (last && first) {
    const lastWonScore = calcTrickScore(wonCards[last] || [])
    const lastTeamA = teamAPlayers.includes(last)
    const firstTeamA = teamAPlayers.includes(first)
    // 꼴찌 팀에서 제거
    if (lastTeamA) teamAPoints -= lastWonScore
    else teamBPoints -= lastWonScore
    // 1등 팀에 추가
    if (firstTeamA) teamAPoints += lastWonScore
    else teamBPoints += lastWonScore
  }

  // 티츄 보너스/페널티
  let teamATichuBonus = 0
  let teamBTichuBonus = 0

  for (const [uid, call] of Object.entries(tichuCalls)) {
    if (call === 'none') continue
    const bonus = call === 'grand_tichu' ? 200 : 100
    const succeeded = finishOrder[0] === uid
    const delta = succeeded ? bonus : -bonus
    if (teamAPlayers.includes(uid)) {
      teamATichuBonus += delta
    } else {
      teamBTichuBonus += delta
    }
  }

  const winnerTeam = teamAPoints + teamATichuBonus > teamBPoints + teamBTichuBonus ? 'A' : 'B'

  return {
    teamAPoints,
    teamBPoints,
    teamATichuBonus,
    teamBTichuBonus,
    isDoubleBigTichu: false,
    winnerTeam,
  }
}
