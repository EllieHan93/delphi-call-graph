import { useEffect, useState } from 'react'
import { api } from '../hooks/useApi'
import type { UnitStats } from '../types'

interface Props {
  /** 바 클릭 시 해당 유닛 이름을 전달 */
  onUnitClick: (unitName: string) => void
}

export default function UnitChart({ onUnitClick }: Props) {
  const [units, setUnits] = useState<UnitStats[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    api
      .getUnits()
      .then((res) => {
        // 미사용 비율 내림차순 정렬 (문제 유닛 상단)
        const sorted = [...res.units].sort((a, b) => b.unusedMethods / b.totalMethods - a.unusedMethods / a.totalMethods)
        setUnits(sorted)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '유닛 데이터를 불러오지 못했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <section aria-label="유닛별 메소드 사용률" aria-busy="true">
        <div className="h-5 w-48 bg-neutral-200 rounded animate-pulse mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 mb-2">
            <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
            <div className="h-6 flex-1 bg-neutral-200 rounded animate-pulse" />
          </div>
        ))}
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="유닛별 메소드 사용률">
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      </section>
    )
  }

  if (units.length === 0) return null

  const maxMethods = Math.max(...units.map((u) => u.totalMethods))

  return (
    <section aria-label="유닛별 메소드 사용률">
      <h2 className="text-base font-semibold text-neutral-800 mb-4">유닛별 메소드 사용률</h2>
      <div className="space-y-2" role="list">
        {units.map((unit) => (
          <UnitBar key={unit.unitName} unit={unit} maxMethods={maxMethods} onClick={() => onUnitClick(unit.unitName)} />
        ))}
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-4 mt-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-success inline-block" aria-hidden="true" />
          사용
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-danger inline-block" aria-hidden="true" />
          미사용
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 유닛 바 컴포넌트
// ---------------------------------------------------------------------------

function UnitBar({
  unit,
  maxMethods,
  onClick,
}: {
  unit: UnitStats
  maxMethods: number
  onClick: () => void
}) {
  const usedPct = maxMethods > 0 ? (unit.usedMethods / maxMethods) * 100 : 0
  const unusedPct = maxMethods > 0 ? (unit.unusedMethods / maxMethods) * 100 : 0

  return (
    <div
      role="listitem"
      className="flex items-center gap-3 group cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      aria-label={`${unit.unitName} — 사용 ${unit.usedMethods}, 미사용 ${unit.unusedMethods}, 사용률 ${unit.usageRate.toFixed(0)}%. 클릭하면 테이블 필터가 적용됩니다.`}
    >
      {/* 유닛명 */}
      <span className="text-sm text-neutral-700 w-28 truncate flex-shrink-0 group-hover:text-primary group-focus:text-primary focus:outline-none">
        {unit.unitName}
      </span>

      {/* 스택 바 */}
      <div className="flex-1 flex h-6 rounded overflow-hidden bg-neutral-100" aria-hidden="true">
        {unit.usedMethods > 0 && (
          <div
            className="bg-success h-full transition-all duration-300"
            style={{ width: `${usedPct}%` }}
            title={`사용: ${unit.usedMethods}개`}
          />
        )}
        {unit.unusedMethods > 0 && (
          <div
            className="bg-danger/70 h-full transition-all duration-300"
            style={{ width: `${unusedPct}%` }}
            title={`미사용: ${unit.unusedMethods}개`}
          />
        )}
      </div>

      {/* 수치 */}
      <span className="text-xs text-neutral-500 w-28 flex-shrink-0 tabular-nums">
        {unit.usageRate.toFixed(0)}% ({unit.usedMethods}/{unit.totalMethods})
      </span>
    </div>
  )
}
