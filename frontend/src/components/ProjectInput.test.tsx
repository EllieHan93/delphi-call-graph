import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectInput from './ProjectInput'
import type { SummaryResponse } from '../types'

const mockSummary: SummaryResponse = {
  projectName: 'TestApp',
  totalUnits: 3,
  totalMethods: 15,
  usedCount: 10,
  unusedCount: 5,
  unusedRatio: 33.33,
  cycleCount: 0,
}

function makeFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
}

function makeFetchError(detail: string, status = 400) {
  return vi.fn().mockResolvedValue({
    ok: false,
    statusText: detail,
    json: () => Promise.resolve({ detail }),
    status,
  })
}

describe('ProjectInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('입력 필드와 분석 버튼이 렌더링된다', () => {
    render(<ProjectInput onAnalysisComplete={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /.dpr 파일 경로/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /분석 실행/i })).toBeInTheDocument()
  })

  it('빈 경로로 제출하면 클라이언트 에러 메시지가 표시된다', async () => {
    render(<ProjectInput onAnalysisComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /분석 실행/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('.dpr 파일 경로를 입력하세요.')
    })
  })

  it('분석 성공 시 onAnalysisComplete가 요약 데이터와 함께 호출된다', async () => {
    vi.stubGlobal('fetch', makeFetchSuccess(mockSummary))
    const onComplete = vi.fn()
    render(<ProjectInput onAnalysisComplete={onComplete} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'C:/App/App.dpr' },
    })
    fireEvent.click(screen.getByRole('button', { name: /분석 실행/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(mockSummary))
  })

  it('API 오류 시 에러 메시지가 표시된다', async () => {
    vi.stubGlobal('fetch', makeFetchError('.dpr 파일을 찾을 수 없습니다'))
    render(<ProjectInput onAnalysisComplete={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '/nonexistent/path.dpr' },
    })
    fireEvent.click(screen.getByRole('button', { name: /분석 실행/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('.dpr 파일을 찾을 수 없습니다')
    })
  })

  it('로딩 중에는 버튼이 비활성화된다', async () => {
    // fetch가 즉시 완료되지 않도록 한다
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ }))
    )
    render(<ProjectInput onAnalysisComplete={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'C:/App/App.dpr' },
    })
    fireEvent.click(screen.getByRole('button', { name: /분석 실행/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /분석 중/i })).toBeDisabled()
    })
  })

  it('Enter 키로 분석을 실행할 수 있다', async () => {
    vi.stubGlobal('fetch', makeFetchSuccess(mockSummary))
    const onComplete = vi.fn()
    render(<ProjectInput onAnalysisComplete={onComplete} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'C:/App/App.dpr' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(mockSummary))
  })

  it('isDisabled=true이면 버튼이 비활성화된다', () => {
    render(<ProjectInput onAnalysisComplete={vi.fn()} isDisabled />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
