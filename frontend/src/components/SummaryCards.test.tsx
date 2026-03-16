import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryCards from './SummaryCards'
import type { SummaryResponse } from '../types'

const baseSummary: SummaryResponse = {
  projectName: 'TestApp',
  totalUnits: 5,
  totalMethods: 42,
  usedCount: 35,
  unusedCount: 7,
  unusedRatio: 16.67,
  cycleCount: 0,
}

describe('SummaryCards', () => {
  it('프로젝트 이름이 표시된다', () => {
    render(<SummaryCards summary={baseSummary} />)
    expect(screen.getByText(/TestApp/)).toBeInTheDocument()
  })

  it('6개의 카드가 모두 렌더링된다', () => {
    render(<SummaryCards summary={baseSummary} />)
    expect(screen.getByText('총 유닛')).toBeInTheDocument()
    expect(screen.getByText('총 메소드')).toBeInTheDocument()
    expect(screen.getByText('사용 메소드')).toBeInTheDocument()
    expect(screen.getByText('미사용 메소드')).toBeInTheDocument()
    expect(screen.getByText('미사용 비율')).toBeInTheDocument()
    expect(screen.getByText('순환 참조')).toBeInTheDocument()
  })

  it('숫자 값이 올바르게 표시된다', () => {
    render(<SummaryCards summary={baseSummary} />)
    expect(screen.getByLabelText(/총 유닛: 5/)).toBeInTheDocument()
    expect(screen.getByLabelText(/총 메소드: 42/)).toBeInTheDocument()
    expect(screen.getByLabelText(/사용 메소드: 35/)).toBeInTheDocument()
    expect(screen.getByLabelText(/미사용 메소드: 7/)).toBeInTheDocument()
  })

  it('미사용 비율이 소수점 1자리로 표시된다', () => {
    render(<SummaryCards summary={baseSummary} />)
    expect(screen.getByLabelText(/미사용 비율: 16.7%/)).toBeInTheDocument()
  })

  it('미사용 비율 30% 미만이면 success 색상 클래스를 갖는다', () => {
    render(<SummaryCards summary={{ ...baseSummary, unusedRatio: 16.67 }} />)
    const card = screen.getByLabelText(/미사용 비율/)
    const valueEl = card.querySelector('p:last-child')
    expect(valueEl).toHaveClass('text-success')
  })

  it('미사용 비율 30% 이상이면 danger 색상 클래스를 갖는다', () => {
    render(<SummaryCards summary={{ ...baseSummary, unusedRatio: 50.0 }} />)
    const card = screen.getByLabelText(/미사용 비율/)
    const valueEl = card.querySelector('p:last-child')
    expect(valueEl).toHaveClass('text-danger')
  })

  it('모든 0인 경우에도 정상 렌더링된다', () => {
    render(
      <SummaryCards
        summary={{ projectName: 'Empty', totalUnits: 0, totalMethods: 0, usedCount: 0, unusedCount: 0, unusedRatio: 0, cycleCount: 0 }}
      />
    )
    expect(screen.getByLabelText(/미사용 비율: 0.0%/)).toBeInTheDocument()
  })
})
