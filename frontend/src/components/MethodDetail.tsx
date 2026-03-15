import { useState, useEffect, useRef } from 'react'
import { api } from '../hooks/useApi'
import StatusBadge from './StatusBadge'
import type { MethodDetailResponse, MethodRefItem } from '../types'

interface Props {
  methodId: string | null
  onClose: () => void
  onMethodSelect: (id: string) => void
  onGraphOpen: (id: string) => void
}

export default function MethodDetail({ methodId, onClose, onMethodSelect, onGraphOpen }: Props) {
  const [detail, setDetail] = useState<MethodDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!methodId) {
      setDetail(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    api
      .getMethodDetail(methodId)
      .then((data) => setDetail(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [methodId])

  // 패널이 열릴 때 닫기 버튼으로 포커스 이동
  useEffect(() => {
    if (methodId) {
      closeBtnRef.current?.focus()
    }
  }, [methodId])

  // Escape 키로 패널 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && methodId) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [methodId, onClose])

  const isOpen = methodId !== null

  return (
    <>
      {/* 오버레이 */}
      <div
        className={[
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 슬라이드오버 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="메소드 상세"
        className={[
          'fixed right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-panel z-50',
          'transform transition-transform duration-300 flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">메소드 상세</h2>
          <div className="flex items-center gap-2">
            {methodId && (
              <button
                onClick={() => onGraphOpen(methodId)}
                aria-label="콜 그래프 열기"
                title="그래프 보기"
                className="h-8 px-2 text-xs rounded-md border border-neutral-200 text-neutral-600 hover:text-primary hover:border-primary hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              >
                그래프 보기
              </button>
            )}
            <button
              ref={closeBtnRef}
              onClick={onClose}
              aria-label="패널 닫기"
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading && (
            <p className="text-neutral-500 text-sm" role="status" aria-live="polite">
              불러오는 중...
            </p>
          )}

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          {detail && (
            <>
              {/* 시그니처 & 기본 정보 */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge isUsed={detail.isUsed} />
                  <span className="text-xs text-neutral-500">
                    {detail.unitName}
                    {detail.className ? `.${detail.className}` : ''}
                  </span>
                  <span className="text-xs text-neutral-500">L{detail.lineNumber}</span>
                </div>
                <pre className="font-mono text-sm bg-neutral-100 px-3 py-2 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                  {detail.signature}
                </pre>
              </section>

              {/* Callers */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">
                  Callers ({detail.callers.length})
                </h3>
                {detail.callers.length === 0 ? (
                  <p className="text-sm text-neutral-500">호출하는 메소드 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.callers.map((item) => (
                      <MethodRefButton
                        key={item.id}
                        item={item}
                        onClick={() => onMethodSelect(item.id)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* Callees */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">
                  Callees ({detail.callees.length})
                </h3>
                {detail.callees.length === 0 ? (
                  <p className="text-sm text-neutral-500">호출되는 메소드 없음</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.callees.map((item) => (
                      <MethodRefButton
                        key={item.id}
                        item={item}
                        onClick={() => onMethodSelect(item.id)}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {/* 소스 코드 */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-800 mb-2">소스 코드</h3>
                {detail.bodyText ? (
                  <pre className="font-mono text-xs bg-neutral-100 p-4 rounded-md overflow-auto max-h-80 whitespace-pre-wrap">
                    {detail.bodyText}
                  </pre>
                ) : (
                  <p className="text-sm text-neutral-500">코드 본문을 불러올 수 없습니다.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function MethodRefButton({
  item,
  onClick,
}: {
  item: MethodRefItem
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="text-sm text-primary hover:underline text-left font-mono focus:outline-none focus:ring-2 focus:ring-primary rounded"
      >
        {item.unitName}
        {item.className ? `.${item.className}` : ''}.{item.methodName}
      </button>
    </li>
  )
}
