import { ref, set, update, push, get, onValue, off } from 'firebase/database'
import { db } from './config'
import type { CurrentTrick, GameState } from '../types/game'
import type { Card } from '../types/card'

export async function updateGameState(roomId: string, state: Partial<GameState>) {
  await update(ref(db, `rooms/${roomId}/gameState`), state)
}

export async function setPlayerHand(roomId: string, uid: string, hand: Card[]) {
  await set(ref(db, `rooms/${roomId}/players/${uid}/hand`), hand)
  await update(ref(db, `rooms/${roomId}/players/${uid}`), { handCount: hand.length })
}

export async function updateHandCount(roomId: string, uid: string, count: number) {
  await update(ref(db, `rooms/${roomId}/players/${uid}`), { handCount: count })
}

export async function setCurrentTrick(roomId: string, trick: CurrentTrick | null) {
  await set(ref(db, `rooms/${roomId}/currentTrick`), trick)
}

export async function addTrickPlay(roomId: string, uid: string, cards: Card[]) {
  await update(ref(db, `rooms/${roomId}/currentTrick/plays/${uid}`), {
    cards,
    timestamp: Date.now(),
  })
}

export async function setExchangeCards(
  roomId: string,
  fromUid: string,
  exchanges: Record<string, Card>  // targetUid → card
) {
  for (const [targetUid, card] of Object.entries(exchanges)) {
    await set(ref(db, `rooms/${roomId}/exchanges/${fromUid}/${targetUid}`), card)
  }
  await update(ref(db, `rooms/${roomId}/gameState/exchangeStatus`), { [fromUid]: true })
}

export async function getExchanges(roomId: string): Promise<Record<string, Record<string, Card>>> {
  const snap = await get(ref(db, `rooms/${roomId}/exchanges`))
  return snap.exists() ? snap.val() : {}
}

export async function addWonCards(roomId: string, uid: string, cards: Card[]) {
  const wonRef = push(ref(db, `rooms/${roomId}/wonCards/${uid}`))
  await set(wonRef, cards)
}

export async function getWonCards(roomId: string): Promise<Record<string, Card[][]>> {
  const snap = await get(ref(db, `rooms/${roomId}/wonCards`))
  if (!snap.exists()) return {}
  const raw = snap.val()
  const result: Record<string, Card[][]> = {}
  for (const [uid, val] of Object.entries(raw)) {
    result[uid] = Object.values(val as Record<string, Card[]>)
  }
  return result
}

export async function updateScores(
  roomId: string,
  teamATotal: number,
  teamBTotal: number,
  roundScore: { teamA: number; teamB: number; teamATichuBonus: number; teamBTichuBonus: number }
) {
  const snap = await get(ref(db, `rooms/${roomId}/scores/rounds`))
  const rounds = snap.exists() ? Object.values(snap.val()) : []
  const roundIndex = rounds.length

  await set(ref(db, `rooms/${roomId}/scores/rounds/${roundIndex}`), roundScore)
  await set(ref(db, `rooms/${roomId}/scores/total`), { teamA: teamATotal, teamB: teamBTotal })
}

export async function submitAction(roomId: string, action: object) {
  const actionRef = push(ref(db, `rooms/${roomId}/gameActions`))
  await set(actionRef, { ...action, timestamp: Date.now(), processed: false })
  return actionRef.key
}

export function subscribePlayerHand(
  roomId: string,
  uid: string,
  callback: (hand: Card[]) => void
) {
  const handRef = ref(db, `rooms/${roomId}/players/${uid}/hand`)
  onValue(handRef, snap => {
    callback(snap.exists() ? snap.val() : [])
  })
  return () => off(handRef)
}

export function subscribeActions(
  roomId: string,
  callback: (actions: Record<string, object>) => void
) {
  const actionsRef = ref(db, `rooms/${roomId}/gameActions`)
  onValue(actionsRef, snap => {
    callback(snap.exists() ? snap.val() : {})
  })
  return () => off(actionsRef)
}

export async function markActionProcessed(roomId: string, actionId: string) {
  await update(ref(db, `rooms/${roomId}/gameActions/${actionId}`), { processed: true })
}
