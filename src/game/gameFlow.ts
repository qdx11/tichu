import { ref, update, set, get } from 'firebase/database'
import { db } from '../firebase/config'
import { updateGameState, setPlayerHand, setCurrentTrick, addWonCards, getWonCards, getExchanges, updateScores } from '../firebase/gameService'
import { createDeck, shuffle } from './deck'
import { identifyCombo, canBeat } from './combo'
import { mustPlayMahjongRequest } from './validator'
import { calcRoundResult } from './scoring'
import type { Room, CurrentTrick, Player, TrickPlay } from '../types/game'
import type { Card } from '../types/card'

// 게임 시작 (호스트가 호출)
export async function startGame(roomId: string, room: Room) {
  const deck = createDeck()
  const shuffled = shuffle(deck)
  const players = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex)

  // 각 플레이어에게 8장씩 배분 (그랜드 티츄 단계)
  const hands: Card[][] = [[], [], [], []]
  for (let i = 0; i < 8 * 4; i++) {
    hands[i % 4].push(shuffled[i])
  }

  // 나머지 24장 저장해두기
  const remaining = shuffled.slice(32)

  for (let i = 0; i < 4; i++) {
    await setPlayerHand(roomId, players[i].uid, hands[i])
  }

  await set(ref(db, `rooms/${roomId}/remainingDeck`), remaining)

  await updateGameState(roomId, {
    phase: 'grand_tichu',
    grandTichuStatus: {},
    finishOrder: [],
    exchangeStatus: {},
    mahjongRequest: null,
  })

  await update(ref(db, `rooms/${roomId}/meta`), { status: 'playing', currentRound: 1 })
}

// 그랜드 티츄 결정 후 나머지 6장 배분
export async function resolveGrandTichu(roomId: string, room: Room) {
  const players = Object.values(room.players).sort((a, b) => a.seatIndex - b.seatIndex)
  const remainingSnap = await get(ref(db, `rooms/${roomId}/remainingDeck`))
  const remaining: Card[] = remainingSnap.val()

  for (let i = 0; i < 4; i++) {
    const uid = players[i].uid
    const currentHandSnap = await get(ref(db, `rooms/${roomId}/players/${uid}/hand`))
    const currentHand: Card[] = currentHandSnap.val() || []
    const extra = remaining.slice(i * 6, i * 6 + 6)
    await setPlayerHand(roomId, uid, [...currentHand, ...extra])
  }

  const exchangeStatus: Record<string, boolean> = {}
  for (const p of players) exchangeStatus[p.uid] = false

  await updateGameState(roomId, { phase: 'card_exchange', exchangeStatus })
}

// 패 교환 완료 후 실제 교환 적용
export async function resolveExchange(roomId: string, room: Room) {
  const players = Object.values(room.players)
  const exchanges = await getExchanges(roomId)

  const handUpdates: Record<string, Card[]> = {}
  for (const p of players) {
    const snap = await get(ref(db, `rooms/${roomId}/players/${p.uid}/hand`))
    handUpdates[p.uid] = snap.val() || []
  }

  // 교환 카드 제거 후 추가
  for (const [fromUid, targets] of Object.entries(exchanges)) {
    for (const [toUid, card] of Object.entries(targets as Record<string, Card>)) {
      // fromUid 손패에서 제거
      handUpdates[fromUid] = handUpdates[fromUid].filter(c => c.id !== card.id)
      // toUid 손패에 추가
      handUpdates[toUid] = [...handUpdates[toUid], card]
    }
  }

  for (const [uid, hand] of Object.entries(handUpdates)) {
    await setPlayerHand(roomId, uid, hand)
  }

  // 마작 소지자가 선공
  let firstPlayer = ''
  for (const [uid, hand] of Object.entries(handUpdates)) {
    if (hand.some(c => c.special === 'mahjong')) {
      firstPlayer = uid
      break
    }
  }

  await setCurrentTrick(roomId, null)
  await updateGameState(roomId, {
    phase: 'playing',
    currentPlayerUid: firstPlayer,
    leadPlayerUid: firstPlayer,
  })
}

// 카드 내기 처리 (호스트가 검증)
export async function processPlay(
  roomId: string,
  room: Room,
  uid: string,
  cards: Card[],
  wish?: number
) {
  let combo = identifyCombo(cards)
  if (!combo) return false

  // 최신 trick 상태를 Firebase에서 읽어 stale 방지
  const trickSnap = await get(ref(db, `rooms/${roomId}/currentTrick`))
  const currentTrick: CurrentTrick | null = trickSnap.exists() ? trickSnap.val() : null

  // 선공이거나 낼 수 있는 경우
  if (currentTrick?.combo && !canBeat(combo, currentTrick.combo)) return false

  // 봉황 싱글 실제 값 설정: 직전 카드 + 0.5, 선공이면 1.5 (tichu 규칙)
  if (combo.type === 'SINGLE' && combo.cards[0]?.special === 'phoenix') {
    const baseValue = currentTrick?.combo?.value ?? 1
    combo = { ...combo, value: baseValue + 0.5 }
  }

  // 마작 소원 강제 적용 (이 카드들에 소원 rank가 없으면 거절)
  const state = room.gameState
  if (state.mahjongRequest) {
    const satisfiesWish = cards.some(c => !c.special && (c.rank as number) === state.mahjongRequest)
    if (!satisfiesWish) {
      const invalid = await shouldEnforceWish(roomId, uid, currentTrick, state.mahjongRequest)
      if (invalid) return false
    }
  }

  // 개 카드: 팀원에게 선공 넘기기 (선공일 때만 가능)
  if (combo.type === 'DOG') {
    if (currentTrick?.combo) return false  // 개는 선공(빈 트릭)일 때만
    const me = room.players[uid]

    const dogPlayersSnap = await get(ref(db, `rooms/${roomId}/players`))
    const dogPlayers: Player[] = dogPlayersSnap.exists()
      ? Object.values(dogPlayersSnap.val() as Record<string, Player>)
      : Object.values(room.players)

    const teammate = dogPlayers.find(
      p => p.uid !== uid && (p.seatIndex + me.seatIndex) % 2 === 0
    )

    // 파트너가 이미 나갔으면 파트너 다음 순서 상대방에게 (tichu 규칙)
    let leadUid: string
    if (teammate && teammate.handCount > 0) {
      leadUid = teammate.uid
    } else {
      const teammateSeat = teammate?.seatIndex ?? me.seatIndex
      const active = dogPlayers.filter(p => p.handCount > 0).sort((a, b) => a.seatIndex - b.seatIndex)
      const nextAfter = active.find(p => p.seatIndex > teammateSeat) ?? active[0]
      leadUid = nextAfter?.uid ?? uid
    }

    await updateGameState(roomId, { currentPlayerUid: leadUid, leadPlayerUid: leadUid })
    await setCurrentTrick(roomId, null)
    await removeCardsFromHand(roomId, uid, cards)
    return true
  }

  // 손패에서 카드 제거
  await removeCardsFromHand(roomId, uid, cards)

  // 트릭 업데이트 (패스한 플레이어 목록은 유지 - 티추 규칙상 한번 패스하면 해당 트릭 참가 불가)
  const newTrick: CurrentTrick = {
    leadUid: currentTrick?.leadUid ?? uid,
    combo,
    plays: [
      ...normalizeTrickPlays(currentTrick?.plays),
      { uid, cards, timestamp: Date.now() }
    ],
    passCount: 0,
    passedUids: currentTrick?.passedUids ?? [],
  }
  await setCurrentTrick(roomId, newTrick)

  // 카드 낸 후 최신 플레이어 데이터 읽기 (handCount 반영)
  const freshPlayersSnap = await get(ref(db, `rooms/${roomId}/players`))
  const freshPlayers: Player[] = freshPlayersSnap.exists()
    ? Object.values(freshPlayersSnap.val() as Record<string, Player>)
    : Object.values(room.players)

  // 다음 플레이어
  const nextUid = getNextPlayer(freshPlayers, uid)

  // 마작 소원 처리
  const hasMahjong = cards.some(c => c.special === 'mahjong')
  if (hasMahjong && wish) {
    await updateGameState(roomId, { currentPlayerUid: nextUid, mahjongRequest: wish })
  } else if (state.mahjongRequest && cards.some(c => !c.special && (c.rank as number) === state.mahjongRequest)) {
    // 소원 충족 → 해제
    await updateGameState(roomId, { currentPlayerUid: nextUid, mahjongRequest: null })
  } else {
    await updateGameState(roomId, { currentPlayerUid: nextUid })
  }

  // 라운드 진행 체크
  await checkRoundProgress(roomId, room, uid)

  return true
}

// 마작 소원 강제 여부 확인: true면 이 play는 거절해야 함
async function shouldEnforceWish(
  roomId: string, uid: string,
  currentTrick: CurrentTrick | null, wishRank: number
): Promise<boolean> {
  const snap = await get(ref(db, `rooms/${roomId}/players/${uid}/hand`))
  const hand: Card[] = snap.val() || []
  return mustPlayMahjongRequest(hand, currentTrick?.combo ?? null, wishRank)
}

// 패스 처리
export async function processPass(roomId: string, room: Room, uid: string) {
  // 항상 Firebase에서 직접 읽어 stale 데이터 방지
  const [trickSnap, playersSnap, currentPlayerSnap, wishSnap] = await Promise.all([
    get(ref(db, `rooms/${roomId}/currentTrick`)),
    get(ref(db, `rooms/${roomId}/players`)),
    get(ref(db, `rooms/${roomId}/gameState/currentPlayerUid`)),
    get(ref(db, `rooms/${roomId}/gameState/mahjongRequest`)),
  ])

  // 현재 차례 플레이어만 패스 가능 — 연타 방지
  const currentPlayerUid = currentPlayerSnap.val()
  if (currentPlayerUid !== uid) return

  const trick: CurrentTrick | null = trickSnap.exists() ? trickSnap.val() : null
  if (!trick) return

  // 소원 강제: 낼 수 있는 조합이 있으면 패스 불가
  const wishRank: number | null = wishSnap.val()
  if (wishRank) {
    const handSnap = await get(ref(db, `rooms/${roomId}/players/${uid}/hand`))
    const hand: Card[] = handSnap.val() || []
    if (mustPlayMahjongRequest(hand, trick.combo ?? null, wishRank)) return
  }

  const playersData = playersSnap.exists() ? playersSnap.val() : {}
  const activePlayers = Object.values(playersData as Record<string, { handCount: number }>)
    .filter(p => p.handCount > 0).length

  const newPassCount = (trick.passCount || 0) + 1
  const newPassedUids = [...(trick.passedUids ?? []), uid]

  // 트릭 선공 제외 모두 패스 → 트릭 종료
  if (activePlayers > 0 && newPassCount >= activePlayers - 1) {
    await resolveTrick(roomId, room, trick)
    return
  }

  const playersRaw: Player[] = Object.values(playersData as Record<string, Player>)
  // 이미 패스한 플레이어는 건너뜀
  const nextUid = getNextPlayer(playersRaw, uid, newPassedUids)
  await update(ref(db, `rooms/${roomId}/currentTrick`), { passCount: newPassCount, passedUids: newPassedUids })
  await updateGameState(roomId, { currentPlayerUid: nextUid })
}

// 트릭 종료 처리
async function resolveTrick(roomId: string, room: Room, trick: CurrentTrick) {
  const plays = normalizeTrickPlays(trick.plays)
  const lastPlay = plays[plays.length - 1]
  const winnerUid = lastPlay.uid

  // 드래곤 처리
  const allCards = plays.flatMap(p => p.cards)
  if (allCards.some(c => c.special === 'dragon')) {
    await addWonCards(roomId, 'dragon_pending', allCards)
    await updateGameState(roomId, {
      phase: 'dragon_giveaway',
      dragonGiveUid: winnerUid,
      currentPlayerUid: winnerUid,
      mahjongRequest: null,
    })
    await setCurrentTrick(roomId, null)
    return
  }

  await addWonCards(roomId, winnerUid, allCards)
  await setCurrentTrick(roomId, null)

  // 최신 handCount 읽기 (방금 카드 낸 플레이어 반영)
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`))
  const freshPlayers: Player[] = playersSnap.exists()
    ? Object.values(playersSnap.val() as Record<string, Player>)
    : Object.values(room.players)
  const remainingPlayers = freshPlayers.filter(p => p.handCount > 0)

  if (remainingPlayers.length <= 1) {
    await finishRound(roomId, room)
    return
  }

  // 트릭 이긴 플레이어가 패를 다 냈으면 남은 플레이어 중 첫 번째에게 선공
  const winnerHasCards = freshPlayers.find(p => p.uid === winnerUid)?.handCount ?? 0
  const leadUid = winnerHasCards > 0 ? winnerUid : remainingPlayers[0].uid

  await updateGameState(roomId, {
    currentPlayerUid: leadUid,
    leadPlayerUid: leadUid,
    mahjongRequest: null,
  })
}

// 드래곤 트릭 상대팀에 넘기기
export async function processDragonGive(roomId: string, room: Room, giverUid: string, targetUid: string) {
  const pendingSnap = await get(ref(db, `rooms/${roomId}/wonCards/dragon_pending`))
  if (!pendingSnap.exists()) return

  const cards = Object.values(pendingSnap.val() as Record<string, Card[]>).flat()
  await set(ref(db, `rooms/${roomId}/wonCards/dragon_pending`), null)
  await addWonCards(roomId, targetUid, cards)

  const dgPlayersSnap = await get(ref(db, `rooms/${roomId}/players`))
  const dgPlayers: Player[] = dgPlayersSnap.exists()
    ? Object.values(dgPlayersSnap.val() as Record<string, Player>)
    : Object.values(room.players)
  const remainingPlayers = dgPlayers.filter(p => p.handCount > 0)

  if (remainingPlayers.length <= 1) {
    await finishRound(roomId, room)
    return
  }

  const giverHasCards = dgPlayers.find(p => p.uid === giverUid)?.handCount ?? 0
  const dgLeadUid = giverHasCards > 0 ? giverUid : remainingPlayers[0].uid

  await updateGameState(roomId, {
    phase: 'playing',
    dragonGiveUid: null,
    currentPlayerUid: dgLeadUid,
    leadPlayerUid: dgLeadUid,
  })
}

// 라운드 종료
async function finishRound(roomId: string, room: Room) {
  // 티츄 선언 여부는 항상 Firebase에서 직접 읽어야 함 (stale snapshot 방지)
  const freshPlayersSnap = await get(ref(db, `rooms/${roomId}/players`))
  const freshPlayersMap: Record<string, import('../types/game').Player> = freshPlayersSnap.exists()
    ? freshPlayersSnap.val()
    : room.players
  const players = Object.values(freshPlayersMap)
  const wonCards = await getWonCards(roomId)
  const finishOrder = room.gameState.finishOrder ?? []

  const tichuCalls: Record<string, import('../types/game').TichuCall> = {}
  for (const p of players) tichuCalls[p.uid] = p.tichu

  // 꼴찌 패 처리 (아직 패 있는 플레이어)
  const lastPlayer = players.find(p => p.handCount > 0)
  if (lastPlayer) {
    const handSnap = await get(ref(db, `rooms/${roomId}/players/${lastPlayer.uid}/hand`))
    const lastHand: Card[] = handSnap.val() || []
    // 꼴찌의 손패 → 상대팀에게 (tichu 규칙)
    const opponent = players.find(p => p.uid !== lastPlayer.uid && p.seatIndex % 2 !== lastPlayer.seatIndex % 2)
    const handRecipient = opponent?.uid ?? finishOrder[0]
    await addWonCards(roomId, handRecipient, lastHand)
    await setPlayerHand(roomId, lastPlayer.uid, [])
  }

  const result = calcRoundResult(
    Object.fromEntries(
      Object.entries(wonCards).map(([uid, tricks]) => [uid, tricks.flat()])
    ),
    players,
    finishOrder,
    tichuCalls,
  )

  const totalA = room.scores.total.teamA + result.teamAPoints + result.teamATichuBonus
  const totalB = room.scores.total.teamB + result.teamBPoints + result.teamBTichuBonus

  await updateScores(roomId, totalA, totalB, {
    teamA: result.teamAPoints,
    teamB: result.teamBPoints,
    teamATichuBonus: result.teamATichuBonus,
    teamBTichuBonus: result.teamBTichuBonus,
  })

  // 게임 종료 체크
  if (totalA >= room.meta.targetScore || totalB >= room.meta.targetScore) {
    await update(ref(db, `rooms/${roomId}/meta`), { status: 'finished' })
    await updateGameState(roomId, { phase: 'round_end' })
    return
  }

  // 다음 라운드
  await update(ref(db, `rooms/${roomId}/meta`), {
    currentRound: room.meta.currentRound + 1,
  })
  await set(ref(db, `rooms/${roomId}/wonCards`), null)
  await set(ref(db, `rooms/${roomId}/exchanges`), null)
  await updateGameState(roomId, { phase: 'round_end' })
}

// 라운드 종료 후 다음 라운드 시작
export async function startNextRound(roomId: string, room: Room) {
  const players = Object.values(room.players)
  for (const p of players) {
    await update(ref(db, `rooms/${roomId}/players/${p.uid}`), {
      tichu: 'none',
      finishRank: null,
      handCount: 0,
    })
  }
  await startGame(roomId, room)
}

async function checkRoundProgress(roomId: string, room: Room, lastPlayedUid: string) {
  const handSnap = await get(ref(db, `rooms/${roomId}/players/${lastPlayedUid}/hand`))
  const hand: Card[] = handSnap.val() || []

  if (hand.length === 0) {
    const currentOrder = room.gameState.finishOrder ?? []
    const newOrder = [...currentOrder, lastPlayedUid]
    await updateGameState(roomId, { finishOrder: newOrder })

    if (newOrder.length >= 3) {
      // 3명이 다 내면 라운드 종료
      await finishRound(roomId, { ...room, gameState: { ...room.gameState, finishOrder: newOrder } })
    }
  }
}

async function removeCardsFromHand(roomId: string, uid: string, cardsToRemove: Card[]) {
  const snap = await get(ref(db, `rooms/${roomId}/players/${uid}/hand`))
  const hand: Card[] = snap.val() || []
  const removeIds = new Set(cardsToRemove.map(c => c.id))
  const newHand = hand.filter(c => !removeIds.has(c.id))
  await setPlayerHand(roomId, uid, newHand)
}

function normalizeTrickPlays(
  plays: CurrentTrick['plays'] | Record<string, TrickPlay> | null | undefined
): TrickPlay[] {
  if (Array.isArray(plays)) return plays
  return Object.values((plays ?? {}) as Record<string, TrickPlay>)
}

function getNextPlayer(players: Player[], currentUid: string, passedUids: string[] = []): string {
  const active = players
    .filter(p => p.handCount > 0 && !passedUids.includes(p.uid))
    .sort((a, b) => a.seatIndex - b.seatIndex)

  if (active.length === 0) return currentUid
  const currentIndex = active.findIndex(p => p.uid === currentUid)
  // currentUid가 방금 패를 다 냈거나 이미 패스했으면 → 첫 번째 활성 플레이어
  if (currentIndex === -1) return active[0].uid
  return active[(currentIndex + 1) % active.length].uid
}
