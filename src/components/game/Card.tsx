import type { Card as CardType } from '../../types/card'
import { getSpecialCardDisplay } from '../../game/cardDisplay'

const SUIT_COLORS: Record<string, string> = {
  jade: '#22c55e',
  sword: '#3b82f6',
  pagoda: '#a855f7',
  star: '#f97316',
  special: '#eab308',
}

const SUIT_SYMBOLS: Record<string, string> = {
  jade: '♦',
  sword: '♠',
  pagoda: '♣',
  star: '★',
  special: '✦',
}

const RANK_LABELS: Record<number, string> = {
  1: '1', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  15: '15', 0: '0', '-1': '-1',
}

function getRankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank)
}

interface CardProps {
  card: CardType
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  highlight?: boolean
}

export function CardComponent({ card, selected, onClick, size = 'md', disabled, highlight }: CardProps) {
  const specialDisplay = getSpecialCardDisplay(card.special)
  const color = specialDisplay?.textColor ?? SUIT_COLORS[card.suit] ?? '#888'
  const symbol = SUIT_SYMBOLS[card.suit] ?? ''
  const label = getRankLabel(card.rank as number)
  const cornerLabel = specialDisplay?.badge ?? label

  const sizeClass = {
    sm: { w: 'w-9', h: 'h-[52px]', rank: 'text-[10px]', suit: 'text-[8px]', center: 'text-base', specialName: 'text-[8px]', specialMeta: 'text-[7px]' },
    md: { w: 'w-11', h: 'h-[64px]', rank: 'text-xs', suit: 'text-[9px]', center: 'text-lg', specialName: 'text-[10px]', specialMeta: 'text-[8px]' },
    lg: { w: 'w-14', h: 'h-[80px]', rank: 'text-sm', suit: 'text-[10px]', center: 'text-2xl', specialName: 'text-xs', specialMeta: 'text-[10px]' },
  }[size]

  const surfaceClass = selected
    ? 'border-yellow-400 bg-yellow-50 -translate-y-3 shadow-lg shadow-yellow-200'
    : highlight
    ? 'border-blue-400 bg-blue-50 shadow-md shadow-blue-200'
    : specialDisplay
    ? 'shadow-sm hover:-translate-y-0.5'
    : 'border-gray-200 bg-white hover:border-gray-400'

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        ${sizeClass.w} ${sizeClass.h} relative rounded-lg border-2 select-none overflow-hidden
        flex flex-col items-center justify-between py-0.5 px-0.5
        transition-all duration-150 cursor-pointer
        ${surfaceClass}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      style={{
        borderColor: selected || highlight ? undefined : specialDisplay?.accent,
        background: selected || highlight ? undefined : specialDisplay?.background,
      }}
    >
      {/* 왼쪽 상단 */}
      <div className="self-start leading-none z-10">
        <div className={`font-bold leading-none ${sizeClass.rank}`} style={{ color }}>{cornerLabel}</div>
        {!specialDisplay && (
          <div className={`leading-none ${sizeClass.suit}`} style={{ color }}>{symbol}</div>
        )}
      </div>

      {/* 중앙 심볼 */}
      {specialDisplay ? (
        <div className="flex-1 flex flex-col items-center justify-center z-10 px-0.5 text-center leading-none">
          <div className={`font-black tracking-tight ${sizeClass.specialName}`} style={{ color }}>
            {specialDisplay.name}
          </div>
          {card.special === 'mahjong' && (
            <div className={`mt-0.5 font-semibold ${sizeClass.specialMeta}`} style={{ color }}>
              (1)
            </div>
          )}
        </div>
      ) : (
        <div className={`${sizeClass.center} leading-none`} style={{ color }}>
          {symbol}
        </div>
      )}

      {/* 오른쪽 하단 (뒤집기) */}
      <div className="self-end leading-none rotate-180 z-10">
        <div className={`font-bold leading-none ${sizeClass.rank}`} style={{ color }}>{cornerLabel}</div>
      </div>
    </div>
  )
}

// 카드 뒷면
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-9 h-[52px]',
    md: 'w-12 h-[68px]',
    lg: 'w-14 h-[80px]',
  }[size]

  return (
    <div className={`${sizeClass} rounded-lg border-2 border-green-600 bg-green-700
      flex items-center justify-center`}>
      <div className="w-[85%] h-[85%] rounded border border-green-500
        flex items-center justify-center text-green-500 text-xs font-bold">
        T
      </div>
    </div>
  )
}
