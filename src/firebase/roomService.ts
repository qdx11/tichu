import { ref, set, get, update, push, runTransaction, onValue, off, onDisconnect, remove } from 'firebase/database'
import { db } from './config'
import type { Player, Room, GameState } from '../types/game'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createRoom(hostUid: string, nickname: string, targetScore = 1000): Promise<string> {
  const code = generateCode()
  const roomRef = push(ref(db, 'rooms'))
  const roomId = roomRef.key!

  const host: Player = {
    uid: hostUid,
    nickname,
    seatIndex: 0,
    isReady: true,
    handCount: 0,
    tichu: 'none',
    finishRank: null,
    isOnline: true,
  }

  const initialGameState: GameState = {
    phase: 'waiting',
    currentPlayerUid: null,
    leadPlayerUid: null,
    mahjongRequest: null,
    dragonGiveUid: null,
    grandTichuStatus: {},
    exchangeStatus: {},
    finishOrder: [],
  }

  const room: Room = {
    meta: {
      code,
      hostUid,
      createdAt: Date.now(),
      status: 'waiting',
      currentRound: 0,
      targetScore,
    },
    players: { [hostUid]: host },
    gameState: initialGameState,
    currentTrick: null,
    scores: {
      rounds: [],
      total: { teamA: 0, teamB: 0 },
    },
  }

  await set(roomRef, room)
  await set(ref(db, `roomCodes/${code}`), roomId)
  await set(ref(db, `userRooms/${hostUid}`), roomId)

  return roomId
}

export async function joinRoom(code: string, uid: string, nickname: string): Promise<string | null> {
  // 코드로 roomId 조회
  const codeSnap = await get(ref(db, `roomCodes/${code}`))
  if (!codeSnap.exists()) return null
  const roomId = codeSnap.val() as string

  let joinedSeat: number | null = null

  await runTransaction(ref(db, `rooms/${roomId}`), (room: Room | null) => {
    if (!room) return null

    const players = room.players || {}
    const playerCount = Object.keys(players).length

    if (playerCount >= 4) return  // 인원 초과, 취소
    if (room.meta.status !== 'waiting') return  // 이미 시작됨

    // 이미 참가한 경우
    if (players[uid]) return room

    // 빈 자리 배정 (0,1,2,3)
    const taken = new Set(Object.values(players).map(p => p.seatIndex))
    let seat = -1
    for (let i = 0; i < 4; i++) {
      if (!taken.has(i as 0|1|2|3)) { seat = i; break }
    }
    if (seat === -1) return  // 자리 없음

    joinedSeat = seat
    players[uid] = {
      uid,
      nickname,
      seatIndex: seat as 0|1|2|3,
      isReady: false,
      handCount: 0,
      tichu: 'none',
      finishRank: null,
      isOnline: true,
    }
    room.players = players
    return room
  })

  if (joinedSeat === null) return null

  await set(ref(db, `userRooms/${uid}`), roomId)
  return roomId
}

export async function getRoomIdByCode(code: string): Promise<string | null> {
  const snap = await get(ref(db, `roomCodes/${code}`))
  return snap.exists() ? snap.val() : null
}

export async function getUserRoom(uid: string): Promise<string | null> {
  const snap = await get(ref(db, `userRooms/${uid}`))
  return snap.exists() ? snap.val() : null
}

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void) {
  const roomRef = ref(db, `rooms/${roomId}`)
  onValue(roomRef, snap => {
    callback(snap.exists() ? snap.val() : null)
  })
  return () => off(roomRef)
}

export async function setPlayerReady(roomId: string, uid: string, ready: boolean) {
  await update(ref(db, `rooms/${roomId}/players/${uid}`), { isReady: ready })
}

export async function setPlayerOnline(roomId: string, uid: string, online: boolean) {
  await update(ref(db, `rooms/${roomId}/players/${uid}`), { isOnline: online })
}

export async function transferHost(roomId: string, newHostUid: string) {
  await update(ref(db, `rooms/${roomId}/meta`), { hostUid: newHostUid })
}

export async function kickPlayer(roomId: string, uid: string) {
  await set(ref(db, `rooms/${roomId}/players/${uid}`), null)
  await set(ref(db, `userRooms/${uid}`), null)
}

// 접속 시 online 표시 + 끊김 시 offline 표시 등록
export async function setupDisconnectCleanup(roomId: string, uid: string) {
  const playerRef = ref(db, `rooms/${roomId}/players/${uid}`)
  const userRoomRef = ref(db, `userRooms/${uid}`)

  // 현재 온라인 표시
  await update(playerRef, { isOnline: true })

  // 끊기면 offline 표시 (방에서 제거 X - 게임 진행 유지)
  onDisconnect(playerRef).update({ isOnline: false })
  onDisconnect(userRoomRef).remove()
}

// 방 전체 삭제 (플레이어 0명일 때)
export async function deleteRoom(roomId: string, roomCode: string) {
  await remove(ref(db, `rooms/${roomId}`))
  await remove(ref(db, `roomCodes/${roomCode}`))
}

// 방 나가기 (수동)
export async function leaveRoom(roomId: string, uid: string, roomCode: string) {
  await remove(ref(db, `rooms/${roomId}/players/${uid}`))
  await remove(ref(db, `userRooms/${uid}`))

  // 남은 플레이어 확인 후 0명이면 방 삭제
  const snap = await get(ref(db, `rooms/${roomId}/players`))
  if (!snap.exists() || Object.keys(snap.val()).length === 0) {
    await deleteRoom(roomId, roomCode)
  }
}
