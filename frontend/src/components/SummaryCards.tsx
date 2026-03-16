import type { SummaryResponse } from '../types'

interface Props {
  summary: SummaryResponse
}

const UNUSED_RATIO_THRESHOLD = 30
const CYCLE_WARNING_THRESHOLD = 1

interface CardConfig {
  label: string
  value: string | number
  colorClass: string
  ariaLabel: string
  icon?: string
}

export default function SummaryCards({ summary }: Props) {
  const cards: CardConfig[] = [
    {
      label: '총 유닛',
      value: summary.totalUnits,
      colorClass: 'text-neutral-900',
      ariaLabel: `총 유닛: ${summary.totalUnits}`,
    },
    {
      label: '총 메소드',
      value: summary.totalMethods,
      colorClass: 'text-neutral-900',
      ariaLabel: `총 메소드: ${summary.totalMethods}`,
    },
    {
      label: '사용 메소드',
      value: summary.usedCount,
      colorClass: 'text-success',
      ariaLabel: `사용 메소드: ${summary.usedCount}`,
    },
    {
      label: '미사용 메소드',
      value: summary.unusedCount,
      colorClass: 'text-danger',
      ariaLabel: `미사용 메소드: ${summary.unusedCount}`,
    },
    {
      label: '미사용 비율',
      value: `${summary.unusedRatio.toFixed(1)}%`,
      colorClass:
        summary.unusedRatio >= UNUSED_RATIO_THRESHOLD ? 'text-danger' : 'text-success',
      ariaLabel: `미사용 비율: ${summary.unusedRatio.toFixed(1)}%`,
    },
    {
      label: '순환 참조',
      value: summary.cycleCount,
      colorClass:
        summary.cycleCount >= CYCLE_WARNING_THRESHOLD ? 'text-warning' : 'text-success',
      ariaLabel: `순환 참조: ${summary.cycleCount}개`,
      icon: '⟳',
    },
  ]

  return (
    <section aria-label="분석 요약">
      <h2 className="text-base font-semibold text-neutral-900 mb-3">
        {summary.projectName} — 분석 결과
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <article
            key={card.label}
            aria-label={card.ariaLabel}
            className="bg-neutral-100 rounded-md p-4 shadow-card"
          >
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide flex items-center gap-1">
              {card.icon && <span aria-hidden="true">{card.icon}</span>}
              {card.label}
            </p>
            <p className={`text-3xl font-bold mt-1 ${card.colorClass}`}>{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
