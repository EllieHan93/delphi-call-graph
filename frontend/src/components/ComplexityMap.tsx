import { useState, useEffect } from 'react'
import { api } from '../hooks/useApi'
import type { ComplexityUnit } from '../types'

interface Props {
  onMethodClick?: (id: string) => void
}

// 복잡도 0~100 → Tailwind 배경 클래스
function complexityBg(score: number): string {
  if (score >= 80) return 'bg-red-500'
  if (score >= 60) return 'bg-orange-400'
  if (score >= 40) return 'bg-yellow-300'
  if (score >= 20) return 'bg-green-300'
  return 'bg-green-100'
}

// 복잡도 점수에 따라 텍스트 색상 결정
function complexityText(score: number): string {
  if (score >= 60) return 'text-white'
  return 'text-neutral-800'
}

interface TooltipState {
  x: number
  y: number
  methodName: string
  unitName: string
  score: number
  lineNumber: number
  isUsed: boolean
}

export default function ComplexityMap({ onMethodClick }: Props) {
  const [units, setUnits] = useState<ComplexityUnit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    api
      .getComplexity()
      .then((res) => setUnits(res.units))
      .catch((err) => setError(err instanceof Error ? err.message : '복잡도 데이터를 불러오지 못했습니다.'))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-neutral-500" role="status">
        복잡도 데이터 불러오는 중...
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="text-sm text-danger p-4">
        {error}
      </div>
    )
  }

  if (units.length === 0) return null

  return (
    <section aria-label="코드 복잡도 히트맵" className="relative">
      <h2 className="text-base font-semibold text-neutral-900 mb-3">코드 복잡도 히트맵</h2>
      <p className="text-xs text-neutral-500 mb-4">
        셀 크기는 메소드 비중을 나타냅니다. 색상: 초록(낮음) → 빨강(높음).
        점선 테두리 = 미사용 + 복잡도 ≥ 60 (우선 정리 대상).
      </p>

      <div className="space-y-6">
        {units.map((unit) => {
          const totalMethods = unit.methods.length
          if (totalMethods === 0) return null

          return (
            <div key={unit.unitName}>
              {/* 유닛 헤더 */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-neutral-700 font-mono">
                  {unit.unitName}
                </span>
                <span className="text-xs text-neutral-400">
                  평균 복잡도 {unit.avgComplexity.toFixed(1)}
                </span>
              </div>

              {/* 트리맵 셀들 */}
              <div className="flex flex-wrap gap-1" role="list" aria-label={`${unit.unitName} 메소드 복잡도`}>
                {unit.methods.map((method) => {
                  const isHighRisk = !method.isUsed && method.complexityScore >= 60
                  const cellSize = Math.max(40, Math.min(120, 40 + method.complexityScore * 0.8))

                  return (
                    <button
                      key={method.id}
                      role="listitem"
                      title={`${method.methodName} — 복잡도 ${method.complexityScore}`}
                      onClick={() => onMethodClick?.(method.id)}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          methodName: method.methodName,
                          unitName: unit.unitName,
                          score: method.complexityScore,
                          lineNumber: method.lineNumber,
                          isUsed: method.isUsed,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      className={[
                        'relative rounded-sm flex flex-col items-center justify-center p-1 overflow-hidden',
                        'transition-transform hover:scale-105 hover:z-10 focus:outline-none focus:ring-2 focus:ring-primary',
                        complexityBg(method.complexityScore),
                        isHighRisk ? 'border-2 border-dashed border-warning' : 'border border-transparent',
                      ].join(' ')}
                      style={{ width: cellSize, height: cellSize }}
                      aria-label={`${method.methodName}: 복잡도 ${method.complexityScore}${isHighRisk ? ', 우선 정리 대상' : ''}`}
                    >
                      {isHighRisk && (
                        <span
                          className="absolute top-0.5 right-0.5 text-warning text-xs leading-none"
                          aria-hidden="true"
                        >
                          ⚠
                        </span>
                      )}
                      <span
                        className={`text-xs font-mono font-semibold truncate w-full text-center leading-tight ${complexityText(method.complexityScore)}`}
                        style={{ fontSize: Math.max(9, Math.min(12, cellSize / 8)) }}
                      >
                        {method.methodName.length > 10
                          ? method.methodName.slice(0, 9) + '…'
                          : method.methodName}
                      </span>
                      <span
                        className={`text-xs tabular-nums font-bold ${complexityText(method.complexityScore)}`}
                        style={{ fontSize: Math.max(8, Math.min(11, cellSize / 9)) }}
                      >
                        {method.complexityScore}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 툴팁 */}
      {tooltip && (
        <div
          role="tooltip"
          className="fixed z-50 pointer-events-none bg-neutral-900 text-white text-xs rounded-md px-3 py-2 shadow-panel max-w-xs"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-mono font-semibold">{tooltip.methodName}</p>
          <p className="text-neutral-300">{tooltip.unitName}</p>
          <p>복잡도: <strong>{tooltip.score}</strong></p>
          <p>줄 번호: {tooltip.lineNumber}</p>
          <p>상태: {tooltip.isUsed ? '✓ 사용됨' : '✗ 미사용'}</p>
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <span className="text-xs text-neutral-500">복잡도:</span>
        {[
          { label: '낮음 (0–19)', cls: 'bg-green-100' },
          { label: '20–39', cls: 'bg-green-300' },
          { label: '40–59', cls: 'bg-yellow-300' },
          { label: '60–79', cls: 'bg-orange-400' },
          { label: '높음 (80+)', cls: 'bg-red-500' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1 text-xs text-neutral-600">
            <span className={`inline-block w-3 h-3 rounded-sm ${cls}`} aria-hidden="true" />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-neutral-600 ml-2">
          <span
            className="inline-block w-3 h-3 rounded-sm border-2 border-dashed border-warning"
            aria-hidden="true"
          />
          미사용 + 복잡 (우선 정리)
        </span>
      </div>
    </section>
  )
}
