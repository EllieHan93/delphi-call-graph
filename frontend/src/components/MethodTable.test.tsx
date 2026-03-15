import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MethodTable from './MethodTable'
import type { MethodListResponse } from '../types'

const mockListData: MethodListResponse = {
  total: 2,
  page: 1,
  pageSize: 20,
  items: [
    {
      id: 'MainUnit.TMainForm.FormCreate',
      unitName: 'MainUnit',
      className: 'TMainForm',
      methodName: 'FormCreate',
      methodType: 'procedure',
      signature: 'procedure TMainForm.FormCreate(Sender: TObject);',
      lineNumber: 10,
      callCount: 3,
      isUsed: true,
    },
    {
      id: 'Utils.TUtils.OldHelper',
      unitName: 'Utils',
      className: 'TUtils',
      methodName: 'OldHelper',
      methodType: 'procedure',
      signature: 'procedure TUtils.OldHelper;',
      lineNumber: 50,
      callCount: 0,
      isUsed: false,
    },
  ],
}

const emptyListData: MethodListResponse = {
  total: 0,
  page: 1,
  pageSize: 20,
  items: [],
}

function makeSuccessFetch(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
}

describe('MethodTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockListData))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('로드 후 메소드 행이 렌더링된다', async () => {
    render(<MethodTable units={['MainUnit', 'Utils']} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('FormCreate')).toBeInTheDocument()
      expect(screen.getByText('OldHelper')).toBeInTheDocument()
    })
  })

  it('빈 데이터일 때 빈 메시지가 표시된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(emptyListData))
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('메소드가 없습니다.')).toBeInTheDocument()
    })
  })

  it('행 클릭 시 onRowClick이 메소드 id와 함께 호출된다', async () => {
    const onRowClick = vi.fn()
    render(<MethodTable units={['MainUnit']} onRowClick={onRowClick} onGraphClick={vi.fn()} />)

    await waitFor(() => screen.getByText('FormCreate'))
    const row = screen.getByText('FormCreate').closest('tr')
    expect(row).not.toBeNull()
    fireEvent.click(row as HTMLElement)
    expect(onRowClick).toHaveBeenCalledWith('MainUnit.TMainForm.FormCreate')
  })

  it('키보드 Enter로 행을 선택할 수 있다', async () => {
    const onRowClick = vi.fn()
    render(<MethodTable units={['MainUnit']} onRowClick={onRowClick} onGraphClick={vi.fn()} />)

    await waitFor(() => screen.getByText('FormCreate'))
    const row = screen.getByText('FormCreate').closest('tr')
    expect(row).not.toBeNull()
    fireEvent.keyDown(row as HTMLElement, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith('MainUnit.TMainForm.FormCreate')
  })

  it('상태 필터 버튼 클릭 시 fetch URL에 status 파라미터가 포함된다', async () => {
    const fetchMock = makeSuccessFetch(emptyListData)
    vi.stubGlobal('fetch', fetchMock)
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)

    await waitFor(() => screen.getByRole('group', { name: /상태 필터/i }))
    fireEvent.click(screen.getByRole('button', { name: '미사용' }))

    await waitFor(() => {
      const calls = fetchMock.mock.calls
      const lastUrl = calls[calls.length - 1][0] as string
      expect(lastUrl).toContain('status=unused')
    })
  })

  it('유닛 드롭다운 변경 시 fetch URL에 unit 파라미터가 포함된다', async () => {
    const fetchMock = makeSuccessFetch(emptyListData)
    vi.stubGlobal('fetch', fetchMock)
    render(<MethodTable units={['MainUnit', 'Utils']} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)

    await waitFor(() => screen.getByRole('combobox', { name: /유닛 필터/i }))
    fireEvent.change(screen.getByRole('combobox', { name: /유닛 필터/i }), {
      target: { value: 'MainUnit' },
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls
      const lastUrl = calls[calls.length - 1][0] as string
      expect(lastUrl).toContain('unit=MainUnit')
    })
  })

  it('사용 상태 배지가 표시된다', async () => {
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByLabelText('사용 중')).toBeInTheDocument()
      expect(screen.getByLabelText('미사용')).toBeInTheDocument()
    })
  })

  it('정렬 가능한 컬럼 헤더에 aria-sort 속성이 있다', async () => {
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => screen.getAllByRole('columnheader'))
    const unitHeader = screen.getByRole('columnheader', { name: /유닛/i })
    expect(unitHeader).toHaveAttribute('aria-sort')
  })

  it('th에 scope="col" 속성이 있다', async () => {
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => screen.getAllByRole('columnheader'))
    const headers = screen.getAllByRole('columnheader')
    headers.forEach((th) => expect(th).toHaveAttribute('scope', 'col'))
  })

  it('총 개수가 표시된다', async () => {
    render(<MethodTable units={[]} onRowClick={vi.fn()} onGraphClick={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/총 2개/)).toBeInTheDocument()
    })
  })
})
