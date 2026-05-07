import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { subscribeRoom, setupDisconnectCleanup, leaveRoom } from '../../firebase/roomService'
import { subscribePlayerHand, subscribeActions, setExchangeCards } from '../../firebase/gameService'
import { subscribeChat } from '../../firebase/chatService'
import { ensureAnonymousAuth } from '../../firebase/auth'
import { WaitingRoom } from '../lobby/WaitingRoom'
import { PlayerSeat } from '../game/PlayerSeat'
import { CardHand } from '../game/CardHand'
import { TrickArea } from '../game/TrickArea'
import { ActionBar } from '../game/ActionBar'
import { ChatPanel } from '../chat/ChatPanel'
import { MobilePlayButtons } from '../game/MobilePlayButtons'
import { GrandTichuModal } from '../modals/GrandTichuModal'
import { CardExchangeModal } from '../modals/CardExchangeModal'
import { DragonGiveModal } from '../modals/DragonGiveModal'
import { RoundEndModal } from '../modals/RoundEndModal'
import { ComboReferenceModal } from '../modals/ComboReferenceModal'
import { processPlay, processPass, processDragonGive, resolveGrandTichu, resolveExchange } from '../../game/gameFlow'
import { update, ref, get } from 'firebase/database'
import { db } from '../../firebase/config'
import type { Room } from '../../types/game'
import type { Card } from '../../types/card'

export function GameLayout() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { uid, setAuth, setRoomId, setRoom, room, myHand, setMyHand, setMessages, showComboRef, setShowComboRef } = useGameStore()
  const [chatOpen, setChatOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'log'>('chat')

  // 인증 복원
  useEffect(() => {
    ensureAnonymousAuth().then(user => {
      const saved = localStorage.getItem('tichu_nickname')
      if (saved) setAuth(user.uid, saved)
      else navigate('/')
    })
  }, [])

  useEffect(() => {
    if (!roomId) return
    setRoomId(roomId)

    const unsubRoom = subscribeRoom(roomId, (r) => {
      if (!r) { navigate('/'); return }
      const currentUid = useGameStore.getState().uid

      // 플레이어 0명이면 방 삭제
      if (r.players && Object.keys(r.players).length === 0) {
        import('../../firebase/roomService').then(({ deleteRoom }) => {
          deleteRoom(roomId, r.meta.code)
        })
        navigate('/')
        return
      }

      if (currentUid && r.meta.status === 'waiting' && !r.players[currentUid]) {
        navigate('/')
        return
      }
      setRoom(r)

      // 호스트 게임 흐름 처리
      if (r.meta.hostUid === currentUid) {
        handleHostLogic(r, roomId)
      }
    })

    return () => { unsubRoom() }
  }, [roomId])

  useEffect(() => {
    if (!roomId || !uid) return
    const unsubHand = subscribePlayerHand(roomId, uid, setMyHand)
    const unsubChat = subscribeChat(roomId, setMessages)
    return () => { unsubHand(); unsubChat() }
  }, [roomId, uid])

  // 연결 끊김 자동 정리 등록 (room이 로드된 후 1회만)
  useEffect(() => {
    if (!roomId || !uid || !room) return
    setupDisconnectCleanup(roomId, uid)
  }, [roomId, uid])

  // 뒤로가기 감지 → 대기실이면 방 나가기
  useEffect(() => {
    const handlePopState = () => {
      const r = useGameStore.getState().room
      const currentUid = useGameStore.getState().uid
      if (r?.meta.status === 'waiting' && currentUid && roomId) {
        leaveRoom(roomId, currentUid, r.meta.code)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [roomId])

  // 호스트 액션 처리 (room 의존성 제거 - double-processing 방지, 항상 최신 room 사용)
  useEffect(() => {
    if (!roomId || !uid) return
    const unsubActions = subscribeActions(roomId, async (actions) => {
      const currentRoom = useGameStore.getState().room
      if (!currentRoom || currentRoom.meta.hostUid !== uid) return
      for (const [actionId, action] of Object.entries(actions)) {
        const a = action as any
        if (a.processed) continue
        await processAction(roomId, currentRoom, actionId, a)
      }
    })
    return () => { unsubActions() }
  }, [roomId, uid])

  if (!room) return <div className="min-h-screen bg-[#1a4a2e] flex items-center justify-center text-white">로딩 중...</div>

  const phase = room.gameState.phase

  if (phase === 'waiting') return <WaitingRoom />

  const players = Object.values(room.players)
  const me = players.find(p => p.uid === uid)
  if (!me) return null

  // 좌석 기준 상대방 배치
  const seatToPos = getSeatPositions(me.seatIndex)
  const topPlayer = players.find(p => p.seatIndex === seatToPos.top) ?? null
  const leftPlayer = players.find(p => p.seatIndex === seatToPos.left) ?? null
  const rightPlayer = players.find(p => p.seatIndex === seatToPos.right) ?? null

  const isMyTurn = room.gameState.currentPlayerUid === uid
  // 스몰 티츄: 자신의 첫 번째 카드를 내기 전까지만 가능 (handCount === 14 = 아직 한 장도 안 낸 상태)
  const canCallTichu = phase === 'playing' && me.tichu === 'none' && me.handCount === 14 && !(room.gameState.finishOrder ?? []).includes(uid ?? '')
  const myTeam = me.seatIndex % 2 === 0 ? 'A' : 'B'

  function getPlayerTeam(player: typeof me | null) {
    if (!player) return 'green' as const
    return player.seatIndex % 2 === 0 ? 'green' as const : 'red' as const
  }

  return (
    <div className="min-h-screen bg-[#1a4a2e] flex flex-col">
      {/* 헤더 */}
      <div className="bg-black/20 px-3 py-2 flex items-center justify-between text-white text-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-green-300 font-semibold hidden sm:inline">🐦 · 🐕 · 🦅 · 🐉</span>
          <span className="text-white/50 hidden sm:inline">|</span>
          <span className="shrink-0">방 <span className="font-mono font-bold">{room.meta.code}</span></span>
          <span className="text-white/50 hidden sm:inline">|</span>
          <span className="hidden sm:inline shrink-0">라운드 {room.meta.currentRound}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-green-300">{room.scores.total.teamA}</span>
          <span className="text-white/50 text-xs">vs</span>
          <span className="font-bold text-red-300">{room.scores.total.teamB}</span>
          <span className="text-white/50 text-xs ml-1">R{room.meta.currentRound}</span>
        </div>
      </div>

      {/* 게임판 + 사이드 패널 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 데스크톱 왼쪽 패널 */}
        <div className="hidden lg:flex lg:flex-col w-56 bg-black/20 p-3 gap-3">
          <div className="bg-black/20 rounded-xl p-3">
            <p className="text-xs font-bold text-white/50 mb-2">우리팀 ({myTeam === 'A' ? 'A' : 'B'})</p>
            {players.filter(p => p.seatIndex % 2 === me.seatIndex % 2).map(p => (
              <div key={p.uid} className="flex items-center gap-2 py-1">
                <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                <span className="text-white text-xs">{p.nickname}</span>
                {p.uid === uid && <span className="text-yellow-300 text-xs">나</span>}
                <span className="ml-auto text-white/50 text-xs">{room.scores.total[myTeam === 'A' ? 'teamA' : 'teamB']}</span>
              </div>
            ))}
          </div>
          <div className="bg-black/20 rounded-xl p-3">
            <p className="text-xs font-bold text-white/50 mb-2">상대팀</p>
            {players.filter(p => p.seatIndex % 2 !== me.seatIndex % 2).map(p => (
              <div key={p.uid} className="flex items-center gap-2 py-1">
                <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                <span className="text-white text-xs">{p.nickname}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="mt-auto text-xs text-white/50 hover:text-white/80 transition-colors text-left"
          >
            🔗 초대 링크 복사
          </button>
        </div>

        {/* 중앙 게임판 */}
        <div className="flex-1 flex flex-col relative">
          {/* 상단 플레이어 */}
          <div className="flex justify-center pt-3">
            <PlayerSeat
              player={topPlayer}
              position="top"
              isCurrentTurn={room.gameState.currentPlayerUid === topPlayer?.uid}
              teamColor={getPlayerTeam(topPlayer)}
            />
          </div>

          {/* 중간 영역 */}
          <div className="flex flex-1 items-center">
            {/* 왼쪽 플레이어 */}
            <div className="pl-3">
              <PlayerSeat
                player={leftPlayer}
                position="left"
                isCurrentTurn={room.gameState.currentPlayerUid === leftPlayer?.uid}
                teamColor={getPlayerTeam(leftPlayer)}
              />
            </div>

            {/* 트릭 영역 */}
            <div className="flex-1 flex items-center justify-center min-h-32">
              <TrickArea
                trick={room.currentTrick}
                players={players}
                phase={phase}
                mahjongRequest={room.gameState.mahjongRequest}
              />
            </div>

            {/* 오른쪽 플레이어 */}
            <div className="pr-3">
              <PlayerSeat
                player={rightPlayer}
                position="right"
                isCurrentTurn={room.gameState.currentPlayerUid === rightPlayer?.uid}
                teamColor={getPlayerTeam(rightPlayer)}
              />
            </div>
          </div>

          {/* 내 정보 + 손패 */}
          <div className="relative bg-white/5 rounded-t-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-700 rounded-full px-3 py-1 flex items-center gap-2">
                <span className="text-white text-xs font-bold">{me.nickname}</span>
                {me.tichu !== 'none' && (
                  <span className="text-yellow-300 text-xs">{me.tichu === 'grand_tichu' ? 'GT' : 'T'}</span>
                )}
                {isMyTurn && <span className="text-yellow-400 text-xs animate-pulse">●</span>}
              </div>
              <span className="text-white/50 text-xs">{myHand.length}장</span>

              <div className="ml-auto flex items-center gap-2">
                {/* 액션 버튼 (패 내기 / 패스) */}
                <ActionBar room={room} isMyTurn={isMyTurn} canCallTichu={canCallTichu} />

                {/* 족보 참고 버튼 */}
                <button
                  onClick={() => setShowComboRef(true)}
                  className="text-xs text-white/50 hover:text-white transition-colors bg-white/10 px-2 py-1 rounded-lg"
                >
                  📋 족보
                </button>

                {/* 모바일 채팅 토글 */}
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="lg:hidden text-xs text-white/50 hover:text-white transition-colors bg-white/10 px-2 py-1 rounded-lg"
                >
                  💬
                </button>
              </div>
            </div>

            {/* 소원 안내 */}
            {room.gameState.mahjongRequest && phase === 'playing' && (
              <div className="bg-yellow-500/20 border border-yellow-400/40 px-3 py-1 text-yellow-300 text-xs text-center mb-2 rounded-lg">
                🐦 소원: <span className="font-bold">
                  {({11:'J',12:'Q',13:'K',14:'A'} as Record<number,string>)[room.gameState.mahjongRequest] ?? room.gameState.mahjongRequest}
                </span> 를 포함한 조합을 내야 합니다
              </div>
            )}

            {/* 모바일: 카드(좌) + 버튼(우) 나란히, 데스크톱: 카드만 */}
            <div className="lg:hidden flex gap-2 items-stretch">
              <div className="flex-1 min-w-0">
                <CardHand
                  cards={myHand}
                  currentTrick={room.currentTrick?.combo ?? null}
                  isMyTurn={isMyTurn}
                />
              </div>
              <MobilePlayButtons room={room} isMyTurn={isMyTurn} />
            </div>
            <div className="hidden lg:block">
              <CardHand
                cards={myHand}
                currentTrick={room.currentTrick?.combo ?? null}
                isMyTurn={isMyTurn}
              />
            </div>
          </div>
        </div>

        {/* 데스크톱 오른쪽 채팅 패널 */}
        <div className="hidden lg:flex lg:flex-col w-72 bg-white border-l border-gray-100">
          <div className="flex border-b border-gray-100">
            {(['chat', 'log'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  activeTab === t ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-400'
                }`}
              >
                {t === 'chat' ? '채팅' : '기록'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </div>

      {/* 모바일 채팅 드로어 */}
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setChatOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-gray-100 flex justify-between items-center">
              <span className="font-bold text-gray-700">채팅</span>
              <button onClick={() => setChatOpen(false)} className="text-gray-400">✕</button>
            </div>
            <div className="h-[calc(100%-52px)]">
              <ChatPanel />
            </div>
          </div>
        </div>
      )}

      {/* 모달들 */}
      {phase === 'grand_tichu' && <GrandTichuModal room={room} />}
      {phase === 'card_exchange' && <CardExchangeModal room={room} />}
      {phase === 'dragon_giveaway' && <DragonGiveModal room={room} />}
      {(phase === 'round_end') && <RoundEndModal room={room} />}
      {showComboRef && <ComboReferenceModal onClose={() => setShowComboRef(false)} />}
    </div>
  )
}

function getSeatPositions(mySeat: number): { top: number; left: number; right: number } {
  const map: Record<number, { top: number; left: number; right: number }> = {
    0: { top: 2, left: 3, right: 1 },
    1: { top: 3, left: 0, right: 2 },
    2: { top: 0, left: 1, right: 3 },
    3: { top: 1, left: 2, right: 0 },
  }
  return map[mySeat] ?? { top: 2, left: 3, right: 1 }
}

let resolvingGrandTichu = false
let resolvingExchange = false
let offlineAutoPassTimer: ReturnType<typeof setTimeout> | null = null
const autoExchangingUids = new Set<string>()

async function handleHostLogic(room: Room, roomId: string) {
  const state = room.gameState
  const players = Object.values(room.players)
  const playerCount = players.length

  // 그랜드 티츄: 오프라인 미결정 플레이어 자동으로 패스 처리
  if (state.phase === 'grand_tichu') {
    const decidedStatus = state.grandTichuStatus ?? {}
    for (const p of players) {
      if (!p.isOnline && !(p.uid in decidedStatus)) {
        await update(ref(db, `rooms/${roomId}/gameState/grandTichuStatus`), { [p.uid]: false })
      }
    }

    if (!resolvingGrandTichu) {
      const decidedCount = Object.keys(state.grandTichuStatus ?? {}).length
      if (decidedCount === playerCount) {
        resolvingGrandTichu = true
        await resolveGrandTichu(roomId, room)
        resolvingGrandTichu = false
      }
    }
  }

  // 패 교환: 오프라인 미완료 플레이어 자동 랜덤 교환
  if (state.phase === 'card_exchange') {
    const exchangeStatus = state.exchangeStatus ?? {}
    for (const p of players) {
      if (!p.isOnline && !exchangeStatus[p.uid] && !autoExchangingUids.has(p.uid)) {
        autoExchangingUids.add(p.uid)
        await autoExchangeForOfflinePlayer(roomId, room, p.uid)
        autoExchangingUids.delete(p.uid)
      }
    }

    if (!resolvingExchange) {
      const allDone = Object.values(exchangeStatus).length === playerCount &&
        Object.values(exchangeStatus).every(Boolean)
      if (allDone) {
        resolvingExchange = true
        await resolveExchange(roomId, room)
        resolvingExchange = false
      }
    }
  }

  // 플레이 중: 오프라인 플레이어 차례이면 10초 후 자동 패스
  if (state.phase === 'playing' && state.currentPlayerUid) {
    const currentPlayer = room.players[state.currentPlayerUid]
    if (currentPlayer && !currentPlayer.isOnline) {
      if (!offlineAutoPassTimer) {
        const timerUid = state.currentPlayerUid
        offlineAutoPassTimer = setTimeout(async () => {
          offlineAutoPassTimer = null
          const latestRoom = useGameStore.getState().room
          if (!latestRoom) return
          if (latestRoom.gameState.currentPlayerUid !== timerUid) return
          const latestPlayer = latestRoom.players[timerUid]
          if (latestPlayer && !latestPlayer.isOnline) {
            await processPass(roomId, latestRoom, timerUid)
          }
        }, 10000)
      }
    } else {
      if (offlineAutoPassTimer) {
        clearTimeout(offlineAutoPassTimer)
        offlineAutoPassTimer = null
      }
    }
  }
}

async function autoExchangeForOfflinePlayer(roomId: string, room: Room, offlineUid: string) {
  const snap = await get(ref(db, `rooms/${roomId}/players/${offlineUid}/hand`))
  const hand: Card[] = snap.val() || []
  if (hand.length < 3) return

  const others = Object.values(room.players).filter(p => p.uid !== offlineUid)
  const exchanges: Record<string, Card> = {}
  for (let i = 0; i < others.length; i++) {
    exchanges[others[i].uid] = hand[i]
  }
  await setExchangeCards(roomId, offlineUid, exchanges)
}

async function processAction(roomId: string, room: Room, actionId: string, action: any) {
  try {
    switch (action.type) {
      case 'PLAY_CARDS':
        await processPlay(roomId, room, action.uid, action.cards, action.wish)
        break
      case 'PASS':
        await processPass(roomId, room, action.uid)
        break
      case 'CALL_TICHU': {
        const playerSnap = await get(ref(db, `rooms/${roomId}/players/${action.uid}`))
        const playerData = playerSnap.exists() ? playerSnap.val() : null
        if (playerData?.tichu === 'none' && playerData?.handCount === 14) {
          await update(ref(db, `rooms/${roomId}/players/${action.uid}`), { tichu: 'tichu' })
        }
        break
      }
      case 'CALL_GRAND_TICHU':
        await update(ref(db, `rooms/${roomId}/gameState/grandTichuStatus`), { [action.uid]: action.call })
        if (action.call) {
          await update(ref(db, `rooms/${roomId}/players/${action.uid}`), { tichu: 'grand_tichu' })
        }
        break
      case 'EXCHANGE_CARDS':
        // exchangeService에서 처리됨
        break
      case 'DRAGON_GIVE':
        await processDragonGive(roomId, room, action.uid, action.targetUid)
        break
    }
  } finally {
    await update(ref(db, `rooms/${roomId}/gameActions/${actionId}`), { processed: true })
  }
}
