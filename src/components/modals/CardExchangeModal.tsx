import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../game/Card'
import { setExchangeCards } from '../../firebase/gameService'
import type { Room } from '../../types/game'
import type { Card } from '../../types/card'

const EXCHANGE_TIMEOUT = 60

interface CardExchangeModalProps {
  room: Room
}

export function CardExchangeModal({ room }: CardExchangeModalProps) {
  const { uid, roomId, myHand } = useGameStore()
  const [assignments, setAssignments] = useState<Record<string, Card>>({})
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [timer, setTimer] = useState(EXCHANGE_TIMEOUT)
  const submittedRef = useRef(false)

  const myStatus = room.gameState.exchangeStatus?.[uid ?? '']

  const otherPlayers = Object.values(room.players).filter(p => p.uid !== uid)

  // 자동 제출 함수 (타이머 만료 시 미배정 카드 랜덤 자동 배정 후 제출)
  async function autoSubmit(currentAssignments: Record<string, Card>) {
    if (!roomId || !uid || submittedRef.current) return
    submittedRef.current = true

    const assigned = { ...currentAssignments }
    const assignedCardIds = new Set(Object.values(assigned).map(c => c.id))
    const unassignedPlayers = otherPlayers.filter(p => !assigned[p.uid])
    const availableCards = myHand.filter(c => !assignedCardIds.has(c.id))

    for (let i = 0; i < unassignedPlayers.length && i < availableCards.length; i++) {
      assigned[unassignedPlayers[i].uid] = availableCards[i]
    }

    if (Object.keys(assigned).length === 3) {
      await setExchangeCards(roomId, uid, assigned)
    }
  }

  useEffect(() => {
    if (myStatus) return
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(interval)
          setAssignments(prev => { autoSubmit(prev); return prev })
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [myStatus])

  if (myStatus) return null

  const assignedCardIds = new Set(Object.values(assignments).map(c => c.id))
  const canSubmit = Object.keys(assignments).length === 3

  function handleCardClick(card: Card) {
    if (assignedCardIds.has(card.id)) {
      // 이미 배정된 카드 → 배정 취소
      const newAssignments = { ...assignments }
      for (const [k, v] of Object.entries(newAssignments)) {
        if (v.id === card.id) delete newAssignments[k]
      }
      setAssignments(newAssignments)
      setSelectedCard(null)
    } else {
      setSelectedCard(prev => prev?.id === card.id ? null : card)
    }
  }

  function handlePlayerClick(targetUid: string) {
    if (!selectedCard) return
    setAssignments(prev => {
      const next = { ...prev }
      // 이미 같은 카드가 다른 플레이어에 배정됐으면 제거
      for (const [k, v] of Object.entries(next)) {
        if (v.id === selectedCard.id) delete next[k]
      }
      next[targetUid] = selectedCard
      return next
    })
    setSelectedCard(null)
  }

  async function handleSubmit() {
    if (!canSubmit || !roomId || !uid || submittedRef.current) return
    submittedRef.current = true
    await setExchangeCards(roomId, uid, assignments)
  }

  const timerColor = timer <= 10 ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-5">
          <div className="flex items-center justify-center gap-3 mb-1">
            <h2 className="text-lg font-bold text-gray-800">패 교환</h2>
            <span className={`text-sm font-mono font-bold ${timerColor}`}>{timer}초</span>
          </div>
          <p className="text-xs text-center text-gray-400 mb-4">
            카드를 선택한 후 보낼 플레이어를 누르세요
          </p>

          {/* 내 패 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">내 패 (선택 중: {selectedCard ? selectedCard.id : '없음'})</p>
            <div className="flex flex-wrap gap-1 justify-center">
              {[...myHand].sort((a, b) => (a.rank as number) - (b.rank as number)).map(card => {
                const isAssigned = assignedCardIds.has(card.id)
                const isSelected = selectedCard?.id === card.id
                return (
                  <div key={card.id} onClick={() => handleCardClick(card)} className="relative cursor-pointer">
                    <CardComponent
                      card={card}
                      selected={isSelected}
                      disabled={false}
                      size="sm"
                    />
                    {isAssigned && (
                      <div className="absolute inset-0 bg-green-500/30 rounded-lg flex items-center justify-center">
                        <span className="text-green-700 font-bold text-xs">✓</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 플레이어 배정 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              {selectedCard ? '보낼 플레이어 선택' : '플레이어 선택 (카드를 먼저 고르세요)'}
            </p>
            <div className="flex gap-2 justify-center">
              {otherPlayers.map(player => {
                const assignedCard = assignments[player.uid]
                const isTeammate = player.seatIndex % 2 === (room.players[uid ?? '']?.seatIndex ?? 0) % 2
                return (
                  <button
                    key={player.uid}
                    onClick={() => handlePlayerClick(player.uid)}
                    disabled={!selectedCard}
                    className={`flex-1 rounded-xl border-2 p-2 transition-all text-left
                      ${selectedCard ? 'cursor-pointer hover:border-green-400 hover:bg-green-50' : 'cursor-not-allowed opacity-60'}
                      ${assignedCard ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}
                    `}
                  >
                    <div className="text-xs font-bold text-gray-700 truncate">{player.nickname}</div>
                    <div className={`text-[10px] mb-1 ${isTeammate ? 'text-green-500' : 'text-red-400'}`}>
                      {isTeammate ? '팀원' : '상대'}
                    </div>
                    {assignedCard ? (
                      <div className="flex justify-center mt-1">
                        <CardComponent card={assignedCard} size="sm" />
                      </div>
                    ) : (
                      <div className="h-[52px] flex items-center justify-center text-gray-300 text-xs border border-dashed border-gray-200 rounded-lg mt-1">
                        미선택
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition-colors"
          >
            {canSubmit ? '교환 완료' : `${3 - Object.keys(assignments).length}명에게 더 배정하세요`}
          </button>
        </div>
      </div>
    </div>
  )
}
