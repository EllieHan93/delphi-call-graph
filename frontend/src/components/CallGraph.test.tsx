import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CallGraph from './CallGraph'

// ---------------------------------------------------------------------------
// React Flow 모킹 (jsdom 미지원)
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, onNodeClick, onNodeDoubleClick, nodes }: {
    children?: React.ReactNode
    onNodeClick?: (e: React.MouseEvent, node: { id: string }) => void
    onNodeDoubleClick?: (e: React.MouseEvent, node: { id: string }) => void
    nodes?: { id: string }[]
  }) => (
    <div data-testid="react-flow">
      {children}
      {/* 테스트용 노드 클릭 버튼 노출 */}
      {nodes?.map((n) => (
        <button
          key={n.id}
          data-testid={`node-${n.id}`}
          onClick={(e) => onNodeClick?.(e, n)}
          onDoubleClick={(e) => onNodeDoubleClick?.(e, n)}
        >
          {n.id}
        </button>
      ))}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Background: () => null,
  Controls: () => null,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}))

// ---------------------------------------------------------------------------
// CSS 모킹
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react/dist/style.css', () => ({}))

// ---------------------------------------------------------------------------
// API 모킹
// ---------------------------------------------------------------------------

const mockCallGraph = {
  rootId: 'Unit1.TForm.Create',
  depth: 2,
  nodes: [
    { id: 'Unit1.TForm.Create', unitName: 'Unit1', className: 'TForm', methodName: 'Create', isUsed: true, isRoot: true },
    { id: 'Unit1.TForm.Init', unitName: 'Unit1', className: 'TForm', methodName: 'Init', isUsed: true, isRoot: false },
    { id: 'Utils.Format', unitName: 'Utils', className: null, methodName: 'Format', isUsed: false, isRoot: false },
  ],
  edges: [
    { source: 'Unit1.TForm.Create', target: 'Unit1.TForm.Init' },
    { source: 'Unit1.TForm.Create', target: 'Utils.Format' },
  ],
}

const mockGetCallGraph = vi.fn().mockResolvedValue(mockCallGraph)
const mockGetCycles = vi.fn().mockResolvedValue({ count: 0, cycles: [] })

vi.mock('../hooks/useApi', () => ({
  api: {
    getCallGraph: (...args: unknown[]) => mockGetCallGraph(...args),
    getCycles: (...args: unknown[]) => mockGetCycles(...args),
  },
}))

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('CallGraph', () => {
  beforeEach(() => {
    mockGetCallGraph.mockClear()
    mockGetCycles.mockClear()
  })

  it('methodId가 null이면 모달이 숨김 처리됨', () => {
    render(<CallGraph methodId={null} onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog.className).toContain('opacity-0')
  })

  it('methodId가 있으면 모달이 표시됨', () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('opacity-100')
  })

  it('"콜 그래프" 제목이 렌더링됨', () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    expect(screen.getByRole('heading', { name: '콜 그래프' })).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    render(<CallGraph methodId="Unit1.TForm.Create" onClose={onClose} onMethodDoubleClick={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '그래프 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('오버레이 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    const { container } = render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={onClose} onMethodDoubleClick={vi.fn()} />,
    )
    // 오버레이는 aria-hidden="true" 인 첫 번째 div
    const overlay = container.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ESC 키 누르면 onClose 호출', () => {
    const onClose = vi.fn()
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={onClose} onMethodDoubleClick={vi.fn()} />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('methodId null이면 ESC 키에 onClose 호출 안 됨', () => {
    const onClose = vi.fn()
    render(<CallGraph methodId={null} onClose={onClose} onMethodDoubleClick={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('탐색 깊이 슬라이더가 렌더링됨', async () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByLabelText('탐색 깊이 슬라이더')).toBeInTheDocument(),
    )
  })

  it('슬라이더 기본값이 2임', async () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    const slider = await screen.findByLabelText('탐색 깊이 슬라이더')
    expect((slider as HTMLInputElement).value).toBe('2')
  })

  it('화면 맞추기 버튼이 렌더링됨', async () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '그래프 중심 이동' })).toBeInTheDocument(),
    )
  })

  it('API가 올바른 파라미터로 호출됨 (depth=2)', async () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    await waitFor(() =>
      expect(mockGetCallGraph).toHaveBeenCalledWith('Unit1.TForm.Create', 2),
    )
  })

  it('슬라이더 값 변경 시 API 재호출됨', async () => {
    render(
      <CallGraph methodId="Unit1.TForm.Create" onClose={vi.fn()} onMethodDoubleClick={vi.fn()} />,
    )
    const slider = await screen.findByLabelText('탐색 깊이 슬라이더')

    await act(async () => {
      fireEvent.change(slider, { target: { value: '3' } })
    })

    await waitFor(() =>
      expect(mockGetCallGraph).toHaveBeenCalledWith('Unit1.TForm.Create', 3),
    )
  })
})
