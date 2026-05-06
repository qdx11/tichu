import type { Card, Combo } from './card'

export type GamePhase =
  | 'waiting'
  | 'grand_tichu'
  | 'card_exchange'
  | 'playing'
  | 'dragon_giveaway'
  | 'round_end'

export type TichuCall = 'none' | 'tichu' | 'grand_tichu'

export type SeatIndex = 0 | 1 | 2 | 3  // 0,2 = 팀A / 1,3 = 팀B

export interface Player {
  uid: string
  nickname: string
  seatIndex: SeatIndex
  isReady: boolean
  handCount: number
  tichu: TichuCall
  finishRank: number | null
  isOnline: boolean
}

export interface TrickPlay {
  uid: string
  cards: Card[]
  timestamp: number
}

export interface CurrentTrick {
  leadUid: string
  combo: Combo | null
  plays: TrickPlay[]
  passCount: number
}

export interface RoundScore {
  teamA: number
  teamB: number
  teamATichuBonus: number
  teamBTichuBonus: number
}

export interface GameState {
  phase: GamePhase
  currentPlayerUid: string | null
  leadPlayerUid: string | null
  mahjongRequest: number | null
  dragonGiveUid: string | null  // 드래곤 트릭 받을 플레이어 선택 중
  grandTichuStatus: Record<string, boolean | null>
  exchangeStatus: Record<string, boolean>
  finishOrder: string[]  // 순서대로 uid
}

export interface Room {
  meta: {
    code: string
    hostUid: string
    createdAt: number
    status: 'waiting' | 'playing' | 'finished'
    currentRound: number
    targetScore: number
  }
  players: Record<string, Player>
  gameState: GameState
  currentTrick: CurrentTrick | null
  scores: {
    rounds: RoundScore[]
    total: { teamA: number; teamB: number }
  }
}

export interface ChatMessage {
  id: string
  uid: string
  nickname: string
  message: string
  timestamp: number
}

export type GameAction =
  | { type: 'PLAY_CARDS'; uid: string; cards: Card[]; wish?: number }
  | { type: 'PASS'; uid: string }
  | { type: 'CALL_TICHU'; uid: string }
  | { type: 'CALL_GRAND_TICHU'; uid: string; call: boolean }
  | { type: 'EXCHANGE_CARDS'; uid: string; exchanges: Record<string, string> }
  | { type: 'DRAGON_GIVE'; uid: string; targetUid: string }
  | { type: 'REQUEST_MAHJONG'; uid: string; rank: number }
