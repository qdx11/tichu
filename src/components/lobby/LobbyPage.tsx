import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureAnonymousAuth } from '../../firebase/auth'
import { createRoom, joinRoom } from '../../firebase/roomService'
import { useGameStore } from '../../store/gameStore'

export function LobbyPage() {
  const navigate = useNavigate()
  const setAuth = useGameStore(s => s.setAuth)
  const setRoomId = useGameStore(s => s.setRoomId)

  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [targetScore, setTargetScore] = useState(1000)
  const [customScore, setCustomScore] = useState('')

  const PRESETS = [500, 1000, 2000]

  const resolvedScore = targetScore === 0 ? (parseInt(customScore) || 1000) : targetScore

  async function handleCreate() {
    if (!nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    if (targetScore === 0 && (!parseInt(customScore) || parseInt(customScore) < 100)) {
      setError('목표 점수는 100 이상 입력해주세요'); return
    }
    setLoading(true); setError('')
    try {
      const user = await ensureAnonymousAuth()
      setAuth(user.uid, nickname.trim())
      localStorage.setItem('tichu_nickname', nickname.trim())
      const roomId = await createRoom(user.uid, nickname.trim(), resolvedScore)
      setRoomId(roomId)
      navigate(`/room/${roomId}`)
    } catch (e: any) {
      console.error('방 만들기 에러:', e)
      setError(`실패: ${e?.message ?? '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    if (!joinCode.trim()) { setError('방 코드를 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      const user = await ensureAnonymousAuth()
      setAuth(user.uid, nickname.trim())
      localStorage.setItem('tichu_nickname', nickname.trim())
      const roomId = await joinRoom(joinCode.trim().toUpperCase(), user.uid, nickname.trim())
      if (!roomId) { setError('존재하지 않거나 꽉 찬 방입니다'); return }
      setRoomId(roomId)
      navigate(`/room/${roomId}`)
    } catch (e: any) {
      console.error('방 입장 에러:', e)
      setError(`실패: ${e?.message ?? '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a4a2e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="mb-3 text-xl font-black tracking-[0.2em] text-green-100">🐦 🐕 🦅 🐉</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">티츄게임</h1>
          <p className="text-green-300 mt-1 text-sm">친구들과 함께하는 티츄</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('create')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'create'
                  ? 'text-green-700 border-b-2 border-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              방 만들기
            </button>
            <button
              onClick={() => setTab('join')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                tab === 'join'
                  ? 'text-green-700 border-b-2 border-green-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              방 입장
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* 닉네임 */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">닉네임</label>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? handleCreate() : handleJoin())}
                placeholder="사용할 닉네임 입력"
                maxLength={10}
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>

            {/* 목표 점수 (방 만들기 탭만) */}
            {tab === 'create' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">목표 점수</label>
                <div className="mt-1 flex gap-2">
                  {PRESETS.map(score => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setTargetScore(score)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        targetScore === score
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTargetScore(0)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                      targetScore === 0
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'
                    }`}
                  >
                    직접
                  </button>
                </div>
                {targetScore === 0 && (
                  <input
                    type="number"
                    value={customScore}
                    onChange={e => setCustomScore(e.target.value)}
                    placeholder="점수 입력 (100 이상)"
                    min={100}
                    className="mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                )}
              </div>
            )}

            {/* 방 코드 (입장 탭) */}
            {tab === 'join' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">방 코드</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6자리 코드 입력"
                  maxLength={6}
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono tracking-widest text-center"
                />
              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}

            <button
              onClick={tab === 'create' ? handleCreate : handleJoin}
              disabled={loading}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors text-sm"
            >
              {loading ? '처리 중...' : tab === 'create' ? '방 만들기' : '입장하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
