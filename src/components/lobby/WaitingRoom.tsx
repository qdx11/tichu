import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { setPlayerReady, kickPlayer, leaveRoom } from '../../firebase/roomService'
import { startGame } from '../../game/gameFlow'

export function WaitingRoom() {
  const navigate = useNavigate()
  const { roomId, room, uid } = useGameStore()

  const players = room ? Object.values(room.players) : []
  const me = players.find(p => p.uid === uid)
  const isHost = room?.meta.hostUid === uid
  const allReady = players.length === 4 && players.every(p => p.isReady)

  async function handleReady() {
    if (!roomId || !uid) return
    await setPlayerReady(roomId, uid, !me?.isReady)
  }

  async function handleStart() {
    if (!roomId || !room) return
    await startGame(roomId, room)
  }

  async function handleLeave() {
    if (!roomId || !uid || !room) return
    await leaveRoom(roomId, uid, room.meta.code)
    navigate('/')
  }

  async function handleKick(targetUid: string) {
    if (!roomId) return
    await kickPlayer(roomId, targetUid)
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  if (!room || !roomId) return null

  return (
    <div className="min-h-screen bg-[#1a4a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">대기실</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-green-300 text-sm">방 코드</span>
            <span className="bg-green-800 text-white font-mono text-lg px-3 py-1 rounded-lg tracking-widest">
              {room.meta.code}
            </span>
            <button
              onClick={() => copyToClipboard(room.meta.code)}
              className="text-xs text-green-400 hover:text-white transition-colors"
            >
              복사
            </button>
          </div>
          <button
            onClick={() => copyToClipboard(`${window.location.href.split('/room/')[0]}/room/${roomId}`)}
            className="text-xs text-green-500 hover:text-white transition-colors mt-1"
          >
            🔗 초대 링크 복사
          </button>
        </div>

        {/* 팀 구성 */}
        <div className="bg-white/10 rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 팀 A */}
            <div>
              <p className="text-xs font-bold text-green-300 mb-2 text-center">우리팀 A</p>
              {[0, 2].map(seat => {
                const player = players.find(p => p.seatIndex === seat)
                return (
                  <div key={seat} className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${
                    player ? 'bg-white/10' : 'bg-white/5 border border-dashed border-white/20'
                  }`}>
                    {player ? (
                      <>
                        <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {player.nickname[0]}
                        </div>
                        <span className="text-white text-sm flex-1 truncate">{player.nickname}</span>
                        {player.uid === uid && <span className="text-xs text-yellow-300">나</span>}
                        {player.isReady && <span className="text-xs text-green-400">✓</span>}
                        {isHost && player.uid !== uid && (
                          <button
                            onClick={() => handleKick(player.uid)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            강퇴
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-white/30 text-xs mx-auto">빈 자리</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 팀 B */}
            <div>
              <p className="text-xs font-bold text-red-300 mb-2 text-center">상대팀 B</p>
              {[1, 3].map(seat => {
                const player = players.find(p => p.seatIndex === seat)
                return (
                  <div key={seat} className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${
                    player ? 'bg-white/10' : 'bg-white/5 border border-dashed border-white/20'
                  }`}>
                    {player ? (
                      <>
                        <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {player.nickname[0]}
                        </div>
                        <span className="text-white text-sm flex-1 truncate">{player.nickname}</span>
                        {player.uid === uid && <span className="text-xs text-yellow-300">나</span>}
                        {player.isReady && <span className="text-xs text-green-400">✓</span>}
                        {isHost && player.uid !== uid && (
                          <button
                            onClick={() => handleKick(player.uid)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            강퇴
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-white/30 text-xs mx-auto">빈 자리</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="space-y-2">
          {!isHost && (
            <button
              onClick={handleReady}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                me?.isReady
                  ? 'bg-gray-500 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {me?.isReady ? '준비 취소' : '준비 완료'}
            </button>
          )}

          {isHost && (
            <button
              onClick={handleStart}
              disabled={!allReady}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold rounded-xl text-sm transition-all disabled:cursor-not-allowed"
            >
              {allReady ? '게임 시작!' : `대기 중... (${players.length}/4)`}
            </button>
          )}
        </div>

        <button
          onClick={handleLeave}
          className="w-full py-2 text-sm text-white/40 hover:text-white/70 transition-colors mt-1"
        >
          방 나가기
        </button>

        <p className="text-center text-white/40 text-xs mt-2">
          {isHost ? '모든 플레이어가 준비되면 게임을 시작할 수 있습니다' : '호스트가 게임을 시작할 때까지 기다려주세요'}
        </p>
      </div>
    </div>
  )
}
