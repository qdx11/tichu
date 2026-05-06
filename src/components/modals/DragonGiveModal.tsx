import { useGameStore } from '../../store/gameStore'
import { submitAction } from '../../firebase/gameService'
import type { Room } from '../../types/game'

interface DragonGiveModalProps {
  room: Room
}

export function DragonGiveModal({ room }: DragonGiveModalProps) {
  const { uid, roomId } = useGameStore()

  // 드래곤 낸 사람만 모달 표시
  if (room.gameState.dragonGiveUid !== uid) return null

  const me = room.players[uid ?? '']
  const opponents = Object.values(room.players).filter(p => {
    if (!me) return false
    return (p.seatIndex + me.seatIndex) % 2 !== 0 && p.uid !== uid
  })

  async function handleGive(targetUid: string) {
    if (!roomId || !uid) return
    await submitAction(roomId, { type: 'DRAGON_GIVE', uid, targetUid })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
        <div className="p-6 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl font-black text-emerald-700">🐉</div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">🐉 트릭</h2>
          <p className="text-sm text-gray-500 mb-5">
            용으로 딴 트릭을 상대팀 플레이어에게 넘겨야 합니다
          </p>
          <div className="flex gap-3 justify-center">
            {opponents.map(p => (
              <button
                key={p.uid}
                onClick={() => handleGive(p.uid)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                {p.nickname}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
