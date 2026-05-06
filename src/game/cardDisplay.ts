import type { SpecialCard } from '../types/card'

export interface SpecialCardDisplay {
  name: string
  badge: string
  accent: string
  background: string
  textColor: string
}

const SPECIAL_CARD_DISPLAYS: Record<SpecialCard, SpecialCardDisplay> = {
  mahjong: {
    name: '🐦',
    badge: '🐦',
    accent: '#d97706',
    background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
    textColor: '#92400e',
  },
  dog: {
    name: '🐕',
    badge: '🐕',
    accent: '#57534e',
    background: 'linear-gradient(180deg, #fafaf9 0%, #e7e5e4 100%)',
    textColor: '#44403c',
  },
  phoenix: {
    name: '🦅',
    badge: '🦅',
    accent: '#ea580c',
    background: 'linear-gradient(180deg, #fff7ed 0%, #fed7aa 100%)',
    textColor: '#9a3412',
  },
  dragon: {
    name: '🐉',
    badge: '🐉',
    accent: '#047857',
    background: 'linear-gradient(180deg, #ecfdf5 0%, #a7f3d0 100%)',
    textColor: '#065f46',
  },
}

export function getSpecialCardDisplay(special?: SpecialCard): SpecialCardDisplay | null {
  return special ? SPECIAL_CARD_DISPLAYS[special] : null
}
