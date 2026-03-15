import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import UnitChart from './UnitChart'

// ---------------------------------------------------------------------------
// API 모킹
// ---------------------------------------------------------------------------

const mockUnits = [
  { unitName: 'Utils', totalMethods: 10, usedMethods: 9, unusedMethods: 1, usageRate: 90 },
  { unitName: 'DataModule', totalMethods: 8, usedMethods: 4, unusedMethods: 4, usageRate: 50 },
  { unitName: 'MainUnit', totalMethods: 5, usedMethods: 3, unusedMethods: 2, usageRate: 60 },
]

const mockGetUnits = vi.fn().mockResolvedValue({ total: 3, units: mockUnits })

vi.mock('../hooks/useApi', () => ({
  api: {
    getUnits: () => mockGetUnits(),
  },
}))

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('UnitChart', () => {
  beforeEach(() => {
    mockGetUnits.mockClear()
  })

  it('유닛 목록이 렌더링됨', async () => {
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Utils')).toBeInTheDocument()
      expect(screen.getByText('DataModule')).toBeInTheDocument()
      expect(screen.getByText('MainUnit')).toBeInTheDocument()
    })
  })

  it('"유닛별 메소드 사용률" 제목이 렌더링됨', async () => {
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '유닛별 메소드 사용률' })).toBeInTheDocument(),
    )
  })

  it('미사용률 높은 유닛이 상단에 정렬됨', async () => {
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() => {
      const items = screen.getAllByRole('listitem')
      // DataModule: 50% usage (50% unused) > MainUnit: 60% usage > Utils: 90% usage
      expect(items[0]).toHaveTextContent('DataModule')
      expect(items[1]).toHaveTextContent('MainUnit')
      expect(items[2]).toHaveTextContent('Utils')
    })
  })

  it('사용률 수치가 표시됨', async () => {
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() => {
      // Utils: 90% (9/10)
      expect(screen.getByText(/90%.*\(9\/10\)/)).toBeInTheDocument()
    })
  })

  it('바 클릭 시 onUnitClick 호출', async () => {
    const onUnitClick = vi.fn()
    render(<UnitChart onUnitClick={onUnitClick} />)
    await waitFor(() => screen.getByText('Utils'))
    fireEvent.click(screen.getByRole('listitem', { name: /Utils/ }))
    expect(onUnitClick).toHaveBeenCalledWith('Utils')
  })

  it('키보드 Enter로 바 클릭 가능', async () => {
    const onUnitClick = vi.fn()
    render(<UnitChart onUnitClick={onUnitClick} />)
    await waitFor(() => screen.getByText('DataModule'))
    fireEvent.keyDown(screen.getByRole('listitem', { name: /DataModule/ }), { key: 'Enter' })
    expect(onUnitClick).toHaveBeenCalledWith('DataModule')
  })

  it('키보드 Space로 바 클릭 가능', async () => {
    const onUnitClick = vi.fn()
    render(<UnitChart onUnitClick={onUnitClick} />)
    await waitFor(() => screen.getByText('MainUnit'))
    fireEvent.keyDown(screen.getByRole('listitem', { name: /MainUnit/ }), { key: ' ' })
    expect(onUnitClick).toHaveBeenCalledWith('MainUnit')
  })

  it('API 오류 시 에러 메시지 표시', async () => {
    mockGetUnits.mockRejectedValueOnce(new Error('서버 오류'))
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('서버 오류'),
    )
  })

  it('범례(사용/미사용)가 표시됨', async () => {
    render(<UnitChart onUnitClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('사용')).toBeInTheDocument()
      expect(screen.getByText('미사용')).toBeInTheDocument()
    })
  })
})
