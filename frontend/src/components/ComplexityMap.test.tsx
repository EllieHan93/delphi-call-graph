import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ComplexityMap from './ComplexityMap'
import type { ComplexityResponse } from '../types'

const mockData: ComplexityResponse = {
  units: [
    {
      unitName: 'MainUnit',
      avgComplexity: 30,
      methods: [
        { id: 'MainUnit.Create', methodName: 'Create', complexityScore: 10, isUsed: true, lineNumber: 5 },
        { id: 'MainUnit.Destroy', methodName: 'Destroy', complexityScore: 65, isUsed: false, lineNumber: 20 },
        { id: 'MainUnit.Update', methodName: 'Update', complexityScore: 85, isUsed: true, lineNumber: 40 },
      ],
    },
    {
      unitName: 'Utils',
      avgComplexity: 5,
      methods: [
        { id: 'Utils.Log', methodName: 'Log', complexityScore: 5, isUsed: true, lineNumber: 1 },
      ],
    },
  ],
}

const emptyData: ComplexityResponse = { units: [] }

function makeFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
}

describe('ComplexityMap', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchSuccess(mockData))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('유닛 이름이 표시된다', async () => {
    render(<ComplexityMap />)
    await waitFor(() => {
      expect(screen.getByText('MainUnit')).toBeInTheDocument()
      expect(screen.getByText('Utils')).toBeInTheDocument()
    })
  })

  it('메소드 이름이 셀에 표시된다', async () => {
    render(<ComplexityMap />)
    await waitFor(() => {
      expect(screen.getByText('Create')).toBeInTheDocument()
      expect(screen.getByText('Log')).toBeInTheDocument()
    })
  })

  it('미사용+복잡(≥60) 메소드에 경고 아이콘이 표시된다', async () => {
    render(<ComplexityMap />)
    await waitFor(() => {
      // Destroy: isUsed=false, complexityScore=65 → 경고 아이콘 ⚠
      const destroyBtn = screen.getByLabelText(/Destroy.*우선 정리/)
      expect(destroyBtn).toBeInTheDocument()
    })
  })

  it('사용중+복잡 메소드에는 경고 아이콘이 없다', async () => {
    render(<ComplexityMap />)
    await waitFor(() => {
      // Update: isUsed=true, complexityScore=85 → 경고 아이콘 없음
      const updateBtn = screen.queryByLabelText(/Update.*우선 정리/)
      expect(updateBtn).toBeNull()
    })
  })

  it('셀 클릭 시 onMethodClick이 호출된다', async () => {
    const onMethodClick = vi.fn()
    render(<ComplexityMap onMethodClick={onMethodClick} />)
    await waitFor(() => screen.getByText('Create'))
    fireEvent.click(screen.getByLabelText(/Create.*복잡도/))
    expect(onMethodClick).toHaveBeenCalledWith('MainUnit.Create')
  })

  it('빈 데이터일 때 아무것도 렌더링하지 않는다', async () => {
    vi.stubGlobal('fetch', makeFetchSuccess(emptyData))
    const { container } = render(<ComplexityMap />)
    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull()
    })
  })

  it('로딩 중 상태가 표시된다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ }))
    )
    render(<ComplexityMap />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('API 오류 시 에러 메시지가 표시된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
      json: () => Promise.resolve({ detail: '서버 오류' }),
    }))
    render(<ComplexityMap />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('범례가 렌더링된다', async () => {
    render(<ComplexityMap />)
    await waitFor(() => {
      expect(screen.getByText('복잡도:')).toBeInTheDocument()
      expect(screen.getByText('미사용 + 복잡 (우선 정리)')).toBeInTheDocument()
    })
  })
})
