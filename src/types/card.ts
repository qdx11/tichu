export type Suit = 'jade' | 'sword' | 'pagoda' | 'star' | 'special'

export type Rank =
  | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14  // 2~A
  | 1    // 마작
  | 15   // 드래곤
  | 0    // 피닉스 (값은 상황에 따라 변동)
  | -1   // 개

export type SpecialCard = 'mahjong' | 'dog' | 'phoenix' | 'dragon'

export interface Card {
  id: string        // 예: 'jade_5', 'phoenix'
  suit: Suit
  rank: Rank
  special?: SpecialCard
}

export type ComboType =
  | 'SINGLE'
  | 'PAIR'
  | 'TRIPLE'
  | 'FULL_HOUSE'
  | 'STRAIGHT'
  | 'STAIRS'
  | 'BOMB_QUAD'
  | 'BOMB_SF'
  | 'DOG'

export interface Combo {
  type: ComboType
  cards: Card[]
  value: number   // 비교용 숫자값
  length: number  // STRAIGHT, STAIRS 길이
}
