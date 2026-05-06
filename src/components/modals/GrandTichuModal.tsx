import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../game/Card'
import { submitAction } from '../../firebase/gameService'
import type { Room } from '../../types/game'

interface GrandTichuModalProps {
  room: Room
}

export function GrandTichuModal({ room }: GrandTichuModalProps) {
  const { uid, roomId, myHand } = useGameStore()
  const myStatus = room.gameState.grandTichuStatus?.[uid ?? '']

  if (myStatus !== undefined) return null  // 이미 결정함

  async function handle(call: boolean) {
    if (!roomId || !uid) return
    await submitAction(roomId, { type: 'CALL_GRAND_TICHU', uid, call })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <h2 className="text-xl font-bold text-center text-gray-800 mb-1">그랜드 티츄?</h2>
          <p className="text-sm text-center text-gray-500 mb-5">
            8장을 보고 결정하세요. 성공 +200점 / 실패 -200점
          </p>

          {/* 내 첫 8장 */}
          <div className="flex flex-wrap justify-center gap-1 mb-6">
            {myHand.slice(0, 8).map(card => (
              <CardComponent key={card.id} card={card} size="sm" />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handle(false)}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
            >
              패스
            </button>
            <button
              onClick={() => handle(true)}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl text-sm transition-colors shadow-lg"
            >
              그랜드 티츄!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
