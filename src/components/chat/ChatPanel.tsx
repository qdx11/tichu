import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { sendMessage } from '../../firebase/chatService'

export function ChatPanel() {
  const { roomId, uid, nickname, messages } = useGameStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || !roomId || !uid || !nickname) return
    await sendMessage(roomId, uid, nickname, input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map(msg => {
          const isMe = msg.uid === uid
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isMe && (
                <div className="w-7 h-7 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">
                  {msg.nickname[0]}
                </div>
              )}
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && <p className="text-xs text-gray-400 mb-0.5">{msg.nickname}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="메시지를 입력하세요..."
          className="flex-1 px-3 py-2 rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white disabled:bg-gray-300 transition-colors"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
