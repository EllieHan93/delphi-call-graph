import { useState, type KeyboardEvent } from 'react'
import { api } from '../hooks/useApi'
import type { SummaryResponse } from '../types'

interface Props {
  onAnalysisComplete: (summary: SummaryResponse) => void
  onAnalysisStart?: () => void
  isDisabled?: boolean
}

export default function ProjectInput({ onAnalysisComplete, onAnalysisStart, isDisabled = false }: Props) {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setError('.dpr 파일 경로를 입력하세요.')
      return
    }

    setError(null)
    setIsLoading(true)
    onAnalysisStart?.()

    try {
      const summary = await api.analyze(trimmed)
      onAnalysisComplete(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && !isDisabled) {
      void handleAnalyze()
    }
  }

  const disabled = isLoading || isDisabled

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1 flex flex-col gap-1">
          <label htmlFor="dpr-path-input" className="text-sm font-medium text-neutral-800">
            .dpr 파일 경로
          </label>
          <input
            id="dpr-path-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: C:/Projects/MyApp/MyApp.dpr"
            disabled={disabled}
            aria-describedby={`dpr-path-hint${error ? ' dpr-path-error' : ''}`}
            aria-invalid={error ? 'true' : undefined}
            className={[
              'h-10 border rounded-md px-3 text-sm w-full',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-danger' : 'border-neutral-200',
            ].join(' ')}
          />
          <p id="dpr-path-hint" className="text-xs text-neutral-500 mt-0.5">
            절대 경로를 입력하세요 (예: C:\Projects\MyApp.dpr 또는 /home/user/MyApp.dpr)
          </p>
        </div>
        <button
          onClick={() => void handleAnalyze()}
          disabled={disabled}
          className={[
            'h-10 mt-6 bg-primary hover:bg-primary-hover text-white',
            'px-5 rounded-md text-sm font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {isLoading ? '분석 중...' : '분석 실행'}
        </button>
      </div>

      <div role="status" aria-live="polite" className="min-h-[1.25rem]">
        {error && (
          <p id="dpr-path-error" role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        {isLoading && (
          <p className="text-neutral-500 text-sm">프로젝트를 분석하고 있습니다...</p>
        )}
      </div>
    </div>
  )
}
