import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MethodDetail from './MethodDetail'
import type { MethodDetailResponse } from '../types'

const mockDetail: MethodDetailResponse = {
  id: 'MainUnit.TMainForm.FormCreate',
  unitName: 'MainUnit',
  className: 'TMainForm',
  methodName: 'FormCreate',
  methodType: 'procedure',
  signature: 'procedure TMainForm.FormCreate(Sender: TObject);',
  lineNumber: 10,
  callCount: 2,
  isUsed: true,
  callers: [
    { id: 'App.__entrypoint__', unitName: 'App', className: null, methodName: 'Initialize' },
  ],
  callees: [
    { id: 'Utils.TUtils.LogMessage', unitName: 'Utils', className: 'TUtils', methodName: 'LogMessage' },
  ],
  bodyText: 'begin\n  FData := TData.Create;\nend;',
}

function makeSuccessFetch(data: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) })
}

describe('MethodDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('methodId가 null이면 패널이 화면 밖에 있다 (translate-x-full)', () => {
    render(<MethodDetail methodId={null} onClose={vi.fn()} onMethodSelect={vi.fn()} onGraphOpen={vi.fn()} />)
    const panel = screen.getByRole('dialog', { name: /메소드 상세/i })
    expect(panel).toHaveClass('translate-x-full')
  })

  it('methodId가 설정되면 패널이 열린다 (translate-x-0)', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveClass('translate-x-0')
  })

  it('methodId가 설정되면 API를 호출하고 상세 정보를 표시한다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/FormCreate/)).toBeInTheDocument()
    })
    expect(screen.getByText(/procedure TMainForm.FormCreate/)).toBeInTheDocument()
  })

  it('callers 목록이 표시된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Callers/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Initialize/)).toBeInTheDocument()
  })

  it('callees 목록이 표시된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/LogMessage/)).toBeInTheDocument()
    })
  })

  it('callee 버튼 클릭 시 onMethodSelect가 호출된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    const onMethodSelect = vi.fn()
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={onMethodSelect}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => screen.getByText(/LogMessage/))
    fireEvent.click(screen.getByText(/LogMessage/))
    expect(onMethodSelect).toHaveBeenCalledWith('Utils.TUtils.LogMessage')
  })

  it('닫기 버튼 클릭 시 onClose가 호출된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    const onClose = vi.fn()
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={onClose}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /패널 닫기/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape 키로 패널을 닫을 수 있다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    const onClose = vi.fn()
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={onClose}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('body_text가 코드 블록으로 표시된다', async () => {
    vi.stubGlobal('fetch', makeSuccessFetch(mockDetail))
    render(
      <MethodDetail
        methodId="MainUnit.TMainForm.FormCreate"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => screen.getByText(/FData\s*:=\s*TData/))
  })

  it('API 오류 시 에러 메시지가 표시된다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: () => Promise.resolve({ detail: '메소드를 찾을 수 없습니다' }),
    }))
    render(
      <MethodDetail
        methodId="NonExistent.Method"
        onClose={vi.fn()}
        onMethodSelect={vi.fn()}
        onGraphOpen={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('메소드를 찾을 수 없습니다')
    })
  })
})
