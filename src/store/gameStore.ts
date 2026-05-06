import { create } from 'zustand'
import type { Room, ChatMessage } from '../types/game'
import type { Card } from '../types/card'

interface GameStore {
  // 인증
  uid: string | null
  nickname: string | null
  setAuth: (uid: string, nickname: string) => void

  // 방
  roomId: string | null
  room: Room | null
  setRoomId: (id: string | null) => void
  setRoom: (room: Room | null) => void

  // 내 손패
  myHand: Card[]
  setMyHand: (hand: Card[]) => void

  // 선택한 카드
  selectedCards: string[]  // card id 배열
  toggleCardSelect: (cardId: string) => void
  clearSelection: () => void

  // 채팅
  messages: ChatMessage[]
  setMessages: (msgs: ChatMessage[]) => void

  // UI 상태
  showComboRef: boolean
  showParticipants: boolean
  setShowComboRef: (v: boolean) => void
  setShowParticipants: (v: boolean) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  uid: null,
  nickname: null,
  setAuth: (uid, nickname) => set({ uid, nickname }),

  roomId: null,
  room: null,
  setRoomId: (id) => set({ roomId: id }),
  setRoom: (room) => set({ room }),

  myHand: [],
  setMyHand: (hand) => set({ myHand: hand }),

  selectedCards: [],
  toggleCardSelect: (cardId) => {
    const { selectedCards } = get()
    if (selectedCards.includes(cardId)) {
      set({ selectedCards: selectedCards.filter(id => id !== cardId) })
    } else {
      set({ selectedCards: [...selectedCards, cardId] })
    }
  },
  clearSelection: () => set({ selectedCards: [] }),

  messages: [],
  setMessages: (msgs) => set({ messages: msgs }),

  showComboRef: false,
  showParticipants: false,
  setShowComboRef: (v) => set({ showComboRef: v }),
  setShowParticipants: (v) => set({ showParticipants: v }),
}))
