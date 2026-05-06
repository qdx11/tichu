import { getSpecialCardDisplay } from '../../game/cardDisplay'

interface ComboReferenceModalProps {
  onClose: () => void
}

const COMBOS = [
  {
    name: '싱글', desc: '카드 1장', example: '아무 카드 1장',
    special: false,
  },
  {
    name: '페어', desc: '같은 숫자 2장', example: '7♦ 7♠',
    special: false,
  },
  {
    name: '트리플', desc: '같은 숫자 3장', example: '9♦ 9♠ 9♣',
    special: false,
  },
  {
    name: '풀하우스', desc: '트리플 + 페어 (5장)', example: 'K K K + 5 5',
    special: false,
  },
  {
    name: '스트레이트', desc: '연속 숫자 5장 이상', example: '5 6 7 8 9',
    special: false,
  },
  {
    name: '계단', desc: '연속된 페어 2쌍 이상', example: '(7 7) (8 8) (9 9)',
    special: false,
  },
  {
    name: '폭탄 (4장)', desc: '같은 숫자 4장 — 어떤 패 위에도 낼 수 있음', example: 'J♦ J♠ J♣ J★',
    special: true,
  },
  {
    name: 'SF 폭탄', desc: '5장 이상 같은 수트 연속 — 4장 폭탄보다 강함', example: '5♦ 6♦ 7♦ 8♦ 9♦',
    special: true,
  },
]

const SPECIAL_CARDS = [
  { key: 'mahjong' as const, name: '🐦 참새 (1)', desc: '게임 시작 카드. 낼 때 숫자 요청 가능 — 해당 숫자 가진 플레이어는 그 숫자를 포함해 내야 함' },
  { key: 'dog' as const, name: '🐕 개', desc: '단독으로만 사용. 팀원에게 선공을 넘김' },
  { key: 'phoenix' as const, name: '🦅 봉황', desc: '어떤 싱글 패도 대체 가능 (현재 패보다 0.5 높음). 스트레이트/계단에서 와일드로 사용 가능. 점수: -25점' },
  { key: 'dragon' as const, name: '🐉 용', desc: '가장 강한 싱글 패. 딴 트릭을 상대팀 중 원하는 플레이어에게 줘야 함. 점수: +25점' },
]

const SCORE_CARDS = [
  { card: '5', pts: '+5점' },
  { card: '10, K', pts: '+10점' },
  { key: 'dragon' as const, card: '🐉 용', pts: '+25점 (상대팀에게)' },
  { key: 'phoenix' as const, card: '🦅 봉황', pts: '-25점' },
]

export function ComboReferenceModal({ onClose }: ComboReferenceModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">족보 참고</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-6">
          {/* 기본 족보 */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">기본 족보</h3>
            <div className="space-y-2">
              {COMBOS.map(combo => (
                <div key={combo.name} className={`flex items-center gap-3 p-3 rounded-xl ${
                  combo.special ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'
                }`}>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${combo.special ? 'text-orange-700' : 'text-gray-800'}`}>
                      {combo.special && '🎆 '}{combo.name}
                    </p>
                    <p className="text-xs text-gray-500">{combo.desc}</p>
                  </div>
                  <div className="text-xs font-mono text-gray-400 text-right">{combo.example}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 특수 카드 */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">특수 카드</h3>
            <div className="space-y-2">
              {SPECIAL_CARDS.map(card => (
                <div key={card.name} className="flex gap-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black"
                    style={{
                      color: getSpecialCardDisplay(card.key)?.textColor,
                      background: getSpecialCardDisplay(card.key)?.background,
                      border: `1px solid ${getSpecialCardDisplay(card.key)?.accent}`,
                    }}
                  >
                    {getSpecialCardDisplay(card.key)?.badge}
                  </span>
                  <div>
                    <p className="font-semibold text-sm text-yellow-800">{card.name}</p>
                    <p className="text-xs text-gray-600">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 점수 */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">점수 카드 (총 100점)</h3>
            <div className="grid grid-cols-2 gap-2">
              {SCORE_CARDS.map(s => (
                <div key={s.card} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{s.card}</span>
                  <span className="text-sm font-bold text-green-700">{s.pts}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 티츄 */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">티츄 선언</h3>
            <div className="space-y-2">
              <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                <p className="font-semibold text-sm text-green-800">티츄</p>
                <p className="text-xs text-gray-600">첫 패 내기 전 선언. 1등 시 +100점, 실패 시 -100점</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <p className="font-semibold text-sm text-yellow-800">그랜드 티츄</p>
                <p className="text-xs text-gray-600">첫 8장만 보고 선언. 1등 시 +200점, 실패 시 -200점</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="font-semibold text-sm text-purple-800">더블 빅티오</p>
                <p className="text-xs text-gray-600">같은 팀이 1등 + 2등 → 즉시 200점 획득 (점수 계산 생략)</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
