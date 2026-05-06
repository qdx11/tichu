import { useGameStore } from '../../store/gameStore'
import { startNextRound } from '../../game/gameFlow'
import type { Room } from '../../types/game'

interface RoundEndModalProps {
  room: Room
}

export function RoundEndModal({ room }: RoundEndModalProps) {
  const { uid, roomId } = useGameStore()
  const isHost = room.meta.hostUid === uid
  const isFinished = room.meta.status === 'finished'

  const { total, rounds } = room.scores
  const lastRound = rounds[rounds.length - 1]

  async function handleNext() {
    if (!roomId) return
    await startNextRound(roomId, room)
  }

  const teamAWin = total.teamA >= room.meta.targetScore
  const winnerText = teamAWin ? '팀 A 승리!' : '팀 B 승리!'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6">
          <h2 className="text-xl font-bold text-center text-gray-800 mb-1">
            {isFinished ? '🏆 게임 종료' : '라운드 종료'}
          </h2>

          {isFinished && (
            <p className="text-center text-2xl font-bold text-green-600 mb-4">{winnerText}</p>
          )}

          {/* 이번 라운드 결과 */}
          {lastRound && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 mb-2 text-center">이번 라운드</p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">팀 A</p>
                  <p className="text-2xl font-bold text-green-700">{lastRound.teamA}</p>
                  {lastRound.teamATichuBonus !== 0 && (
                    <p className={`text-xs ${lastRound.teamATichuBonus > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      티츄 {lastRound.teamATichuBonus > 0 ? '+' : ''}{lastRound.teamATichuBonus}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">팀 B</p>
                  <p className="text-2xl font-bold text-red-700">{lastRound.teamB}</p>
                  {lastRound.teamBTichuBonus !== 0 && (
                    <p className={`text-xs ${lastRound.teamBTichuBonus > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      티츄 {lastRound.teamBTichuBonus > 0 ? '+' : ''}{lastRound.teamBTichuBonus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 누적 점수 */}
          <div className="flex justify-between items-center bg-green-50 rounded-xl p-4 mb-5">
            <div className="text-center">
              <p className="text-xs text-gray-500">팀 A 총점</p>
              <p className="text-3xl font-bold text-green-700">{total.teamA}</p>
            </div>
            <p className="text-gray-300 text-2xl">:</p>
            <div className="text-center">
              <p className="text-xs text-gray-500">팀 B 총점</p>
              <p className="text-3xl font-bold text-red-700">{total.teamB}</p>
            </div>
          </div>

          {isHost && !isFinished && (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm"
            >
              다음 라운드
            </button>
          )}

          {!isHost && !isFinished && (
            <p className="text-center text-gray-400 text-sm">호스트가 다음 라운드를 시작하면 계속됩니다</p>
          )}
        </div>
      </div>
    </div>
  )
}
