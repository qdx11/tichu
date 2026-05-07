import type React from 'react'
import { CardBack } from './Card'
import type { Player } from '../../types/game'

interface PlayerSeatProps {
  player: Player | null
  position: 'top' | 'left' | 'right'
  isCurrentTurn: boolean
  teamColor: 'green' | 'red'
}

// 부채꼴 fan 각도 계산
function fanAngle(i: number, total: number, spread: number): number {
  if (total <= 1) return 0
  return ((i / (total - 1)) - 0.5) * spread
}

export function PlayerSeat({ player, position, isCurrentTurn, teamColor }: PlayerSeatProps) {
  if (!player) return null

  const bgColor = teamColor === 'green' ? 'bg-green-700' : 'bg-red-700'
  const ringColor = isCurrentTurn ? 'ring-2 ring-yellow-400' : ''
  const cardCount = player.handCount
  const fanCount = Math.min(cardCount, 12)

  const isVertical = position === 'left' || position === 'right'

  // 위치별 fan 설정
  const fanConfig = {
    top:   { spread: 40, overlap: -16, origin: 'bottom center' },
    left:  { spread: 28, overlap: -36, origin: 'bottom right' },
    right: { spread: 28, overlap: -36, origin: 'bottom left' },
  }[position]

  return (
    <div className={`flex ${isVertical ? 'flex-row' : 'flex-col'} items-center gap-2`}>
      {/* 플레이어 정보 */}
      <div className={`${bgColor} ${ringColor} rounded-xl px-2 py-1.5 flex items-center gap-1.5 shadow`}>
        <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
          {player.nickname[0]}
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-semibold truncate max-w-[72px]">{player.nickname}</p>
          <p className="text-white/60 text-[10px]">{cardCount}장</p>
        </div>
        {player.tichu !== 'none' && (
          <span className={`text-xs font-bold px-1 rounded shrink-0 ${
            player.tichu === 'grand_tichu' ? 'text-yellow-300' : 'text-orange-300'
          }`}>
            {player.tichu === 'grand_tichu' ? 'GT' : 'T'}
          </span>
        )}
        {isCurrentTurn && (
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shrink-0" />
        )}
      </div>

      {/* 카드 뒷면 fan */}
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-end`}>
        {Array.from({ length: fanCount }).map((_, i) => {
          const angle = fanAngle(i, fanCount, fanConfig.spread)
          const style: React.CSSProperties = {
            transform: `rotate(${angle}deg)`,
            transformOrigin: fanConfig.origin,
            zIndex: i,
            ...(isVertical
              ? { marginTop: i > 0 ? fanConfig.overlap : 0 }
              : { marginLeft: i > 0 ? fanConfig.overlap : 0 }),
          }
          return (
            <div key={i} style={style}>
              <CardBack size="sm" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
