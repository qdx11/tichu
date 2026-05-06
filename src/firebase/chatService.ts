import { ref, push, set, onValue, off, query, limitToLast } from 'firebase/database'
import { db } from './config'
import type { ChatMessage } from '../types/game'

export async function sendMessage(roomId: string, uid: string, nickname: string, message: string) {
  const msgRef = push(ref(db, `rooms/${roomId}/chat`))
  const msg: Omit<ChatMessage, 'id'> = { uid, nickname, message, timestamp: Date.now() }
  await set(msgRef, msg)
}

export function subscribeChat(
  roomId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const chatRef = query(ref(db, `rooms/${roomId}/chat`), limitToLast(100))
  onValue(chatRef, snap => {
    if (!snap.exists()) { callback([]); return }
    const msgs: ChatMessage[] = Object.entries(snap.val()).map(([id, val]) => ({
      id,
      ...(val as Omit<ChatMessage, 'id'>),
    }))
    callback(msgs.sort((a, b) => a.timestamp - b.timestamp))
  })
  return () => off(ref(db, `rooms/${roomId}/chat`))
}
