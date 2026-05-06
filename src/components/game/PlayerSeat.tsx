import { CardBack } from './Card'
import type { Player } from '../../types/game'

interface PlayerSeatProps {
  player: Player | null
  position: 'top' | 'left' | 'right'
  isCurrentTurn: boolean
  teamColor: 'green' | 'red'
}

export function PlayerSeat({ player, position, isCurrentTurn, teamColor }: PlayerSeatProps) {
  if (!player) return null

  const bgColor = teamColor === 'green' ? 'bg-green-700' : 'bg-red-700'
  const ringColor = isCurrentTurn ? 'ring-2 ring-yellow-400' : ''

  const cardCount = player.handCount

  // 카드 뒷면 배열 방향
  const isVertical = position === 'left' || position === 'right'

  return (
    <div className={`flex ${isVertical ? 'flex-row' : 'flex-col'} items-center gap-2`}>
      {/* 플레이어 정보 */}
      <div className={`${bgColor} ${ringColor} rounded-xl px-3 py-2 flex items-center gap-2 min-w-[100px] shadow`}>
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {player.nickname[0]}
        </div>
        <div>
          <p className="text-white text-xs font-semibold">{player.nickname}</p>
          <p className="text-white/60 text-xs">{cardCount}장</p>
        </div>
        {player.tichu !== 'none' && (
          <span className={`text-xs font-bold px-1 rounded ${
            player.tichu === 'grand_tichu' ? 'text-yellow-300' : 'text-orange-300'
          }`}>
            {player.tichu === 'grand_tichu' ? 'GT' : 'T'}
          </span>
        )}
        {isCurrentTurn && (
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse ml-auto" />
        )}
      </div>

      {/* 카드 뒷면 */}
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-[-6px]`}>
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
          <div key={i} style={isVertical ? { marginTop: i > 0 ? -42 : 0 } : { marginLeft: i > 0 ? -30 : 0 }}>
            <CardBack size="sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
