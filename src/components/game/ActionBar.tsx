import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { identifyCombo, canBeat } from '../../game/combo'
import { submitAction } from '../../firebase/gameService'
import type { Room } from '../../types/game'

interface ActionBarProps {
  room: Room
  isMyTurn: boolean
  canCallTichu: boolean
}

const RANK_LABELS: Record<number, string> = {
  2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9', 10:'10',
  11:'J', 12:'Q', 13:'K', 14:'A'
}

export function ActionBar({ room, isMyTurn, canCallTichu }: ActionBarProps) {
  const { uid, roomId, myHand, selectedCards, clearSelection } = useGameStore()
  const [timer, setTimer] = useState(30)
  const [showWishPicker, setShowWishPicker] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // stale closure 방지: 항상 최신 값을 참조
  const roomRef = useRef(room)
  const uidRef = useRef(uid)
  const roomIdRef = useRef(roomId)
  roomRef.current = room
  uidRef.current = uid
  roomIdRef.current = roomId

  useEffect(() => {
    if (!isMyTurn) { setTimer(30); return }
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // 선공(트릭 없음)이면 패스 불가 → 타이머만 리셋
          if (roomRef.current.currentTrick?.combo) {
            const rId = roomIdRef.current
            const u = uidRef.current
            if (rId && u) submitAction(rId, { type: 'PASS', uid: u })
          }
          return 30
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isMyTurn])

  const selectedCardObjects = myHand.filter(c => selectedCards.includes(c.id))
  const selectedCombo = selectedCardObjects.length > 0 ? identifyCombo(selectedCardObjects) : null
  const currentTrick = room.currentTrick
  const hasMahjong = selectedCardObjects.some(c => c.special === 'mahjong')

  const canPlay = isMyTurn && selectedCombo && (
    !currentTrick?.combo || canBeat(selectedCombo, currentTrick.combo)
  )

  const isBomb = selectedCombo?.type === 'BOMB_QUAD' || selectedCombo?.type === 'BOMB_SF'
  const canBombOutOfTurn = !isMyTurn && isBomb && !!currentTrick?.combo &&
    !!selectedCombo && canBeat(selectedCombo, currentTrick.combo)

  async function handlePlay() {
    if ((!canPlay && !canBombOutOfTurn) || !roomId || !uid) return
    if (hasMahjong) {
      setShowWishPicker(true)
      return
    }
    await submitAction(roomId, { type: 'PLAY_CARDS', uid, cards: selectedCardObjects })
    clearSelection()
  }

  async function handlePlayWithWish(wish: number | null) {
    if (!roomId || !uid) return
    setShowWishPicker(false)
    await submitAction(roomId, {
      type: 'PLAY_CARDS', uid, cards: selectedCardObjects,
      ...(wish ? { wish } : {}),
    })
    clearSelection()
  }

  async function handlePass() {
    if (!roomId || !uid || isSubmitting) return
    setIsSubmitting(true)
    try {
      await submitAction(roomId, { type: 'PASS', uid })
      clearSelection()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTichu() {
    if (!roomId || !uid) return
    await submitAction(roomId, { type: 'CALL_TICHU', uid })
  }

  const timerColor = timer <= 10 ? 'text-red-400' : 'text-green-400'
  const playEnabled = canPlay || canBombOutOfTurn

  return (
    <>
      {/* 플로팅 패내기/패스 버튼 (카드 영역 우측, 위아래 배치) */}
      <div className="absolute top-10 right-3 flex flex-col gap-2 z-10">
        <button
          onClick={handlePlay}
          disabled={!playEnabled}
          className={`w-20 py-4 font-bold rounded-xl text-base transition-all shadow-lg ${
            playEnabled
              ? canBombOutOfTurn
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse active:scale-95'
                : 'bg-white text-green-800 hover:bg-gray-100 active:scale-95'
              : 'bg-white/20 text-white/40 cursor-not-allowed'
          }`}
        >
          {canBombOutOfTurn ? '💣' : '패 내기'}
        </button>

        <button
          onClick={handlePass}
          disabled={!isMyTurn || !currentTrick?.combo || isSubmitting}
          className={`w-20 py-4 font-bold rounded-xl text-base transition-all shadow-lg ${
            isMyTurn && currentTrick?.combo
              ? 'bg-white/25 text-white hover:bg-white/35 active:scale-95'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          패스
        </button>
      </div>

      {/* 인라인: 티츄 버튼 + 타이머 */}
      <div className="flex items-center gap-1.5">
        {canCallTichu && (
          <button
            onClick={handleTichu}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs transition-all shadow"
          >
            티츄!
          </button>
        )}

        {isMyTurn && (
          <div className={`text-xs font-mono font-bold ${timerColor} min-w-[28px] text-center`}>
            {timer}초
          </div>
        )}
      </div>

      {/* 소원 선택 모달 */}
      {showWishPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <h3 className="text-base font-bold text-center text-gray-800 mb-1">소원 선택</h3>
            <p className="text-xs text-center text-gray-400 mb-4">
              🐦를 내면서 특정 숫자를 지정할 수 있습니다<br/>
              다음 플레이어는 해당 숫자를 낼 수 있으면 반드시 내야 합니다
            </p>
            <div className="grid grid-cols-7 gap-1 mb-3">
              {[2,3,4,5,6,7,8,9,10,11,12,13,14].map(rank => (
                <button
                  key={rank}
                  onClick={() => handlePlayWithWish(rank)}
                  className="py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm"
                >
                  {RANK_LABELS[rank]}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePlayWithWish(null)}
              className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 font-semibold rounded-xl text-sm"
            >
              소원 없이 내기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
