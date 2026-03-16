import { useState, useEffect, useCallback, memo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import { api } from '../hooks/useApi'
import type { CallGraphResponse, CycleResponse } from '../types'

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

interface MethodNodeData extends Record<string, unknown> {
  methodName: string
  className: string | null
  unitName: string
  isUsed: boolean
  isRoot: boolean
}

// ---------------------------------------------------------------------------
// 레이아웃 (dagre)
// ---------------------------------------------------------------------------

const NODE_WIDTH = 180
const NODE_HEIGHT = 64

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } }
  })
}

// ---------------------------------------------------------------------------
// 커스텀 노드
// ---------------------------------------------------------------------------

const MethodNode = memo(function MethodNode({ data }: NodeProps) {
  const d = data as MethodNodeData

  let containerClass: string
  let labelClass: string
  if (d.isRoot) {
    containerClass = 'border-2 border-primary bg-primary text-white'
    labelClass = 'text-white/70'
  } else if (d.isUsed) {
    containerClass = 'border border-success bg-white text-neutral-900'
    labelClass = 'text-neutral-500'
  } else {
    containerClass = 'border border-danger bg-white text-neutral-900'
    labelClass = 'text-neutral-500'
  }

  return (
    <div
      className={`rounded-md px-3 py-2 shadow-sm ${containerClass}`}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-xs font-mono font-semibold truncate flex-1">
          {d.className ? `${d.className}.${d.methodName}` : d.methodName}
        </span>
        <span
          className={`text-xs flex-shrink-0 ${d.isRoot ? 'text-white/70' : d.isUsed ? 'text-success' : 'text-danger'}`}
          aria-label={d.isUsed ? '사용됨' : '미사용'}
        >
          {d.isUsed ? '✓' : '✗'}
        </span>
      </div>
      <div className={`text-xs truncate ${labelClass}`}>{d.unitName}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />
    </div>
  )
})

const nodeTypes = { method: MethodNode }

// ---------------------------------------------------------------------------
// API 응답 → ReactFlow 노드/엣지 변환
// ---------------------------------------------------------------------------

function buildFlowElements(
  data: CallGraphResponse,
  cycleEdgeSet: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const rawNodes: Node[] = data.nodes.map((n) => ({
    id: n.id,
    type: 'method',
    position: { x: 0, y: 0 },
    data: {
      methodName: n.methodName,
      className: n.className,
      unitName: n.unitName,
      isUsed: n.isUsed,
      isRoot: n.isRoot,
    } satisfies MethodNodeData,
  }))

  const rawEdges: Edge[] = data.edges.map((e, idx) => {
    const key = `${e.source}->${e.target}`
    const isCycle = cycleEdgeSet.has(key)
    return {
      id: `e${idx}-${key}`,
      source: e.source,
      target: e.target,
      markerEnd: { type: MarkerType.ArrowClosed, color: isCycle ? '#dc2626' : '#94a3b8' },
      style: isCycle
        ? { stroke: '#dc2626', strokeDasharray: '5 3' }
        : { stroke: '#94a3b8' },
      animated: isCycle,
    }
  })

  return { nodes: applyDagreLayout(rawNodes, rawEdges), edges: rawEdges }
}

// ---------------------------------------------------------------------------
// 내부 컴포넌트 (ReactFlow 컨텍스트 필요)
// ---------------------------------------------------------------------------

interface InnerProps {
  methodId: string
  onMethodDoubleClick: (id: string) => void
}

function CallGraphInner({ methodId, onMethodDoubleClick }: InnerProps) {
  const [depth, setDepth] = useState(2)
  const [centerId, setCenterId] = useState(methodId)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cycleData, setCycleData] = useState<CycleResponse | null>(null)
  const { fitView } = useReactFlow()

  // methodId prop 변경 시 중심 초기화
  useEffect(() => {
    setCenterId(methodId)
  }, [methodId])

  // 사이클 데이터 로드 (한 번만)
  useEffect(() => {
    api.getCycles().then(setCycleData).catch(() => {})
  }, [])

  // 사이클 엣지 집합 계산
  const cycleEdgeSet = useCallback((): Set<string> => {
    if (!cycleData) return new Set()
    const s = new Set<string>()
    for (const cycle of cycleData.cycles) {
      for (let i = 0; i < cycle.length; i++) {
        s.add(`${cycle[i]}->${cycle[(i + 1) % cycle.length]}`)
      }
    }
    return s
  }, [cycleData])

  // 그래프 데이터 로드
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    api
      .getCallGraph(centerId, depth)
      .then((data) => {
        if (cancelled) return
        const { nodes: n, edges: e } = buildFlowElements(data, cycleEdgeSet())
        setNodes(n)
        setEdges(e)
        // 레이아웃 적용 후 뷰 맞추기
        setTimeout(() => fitView({ padding: 0.2 }), 50)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '그래프를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, depth, cycleData])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setCenterId(node.id)
  }, [])

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onMethodDoubleClick(node.id)
    },
    [onMethodDoubleClick],
  )

  return (
    <div className="flex flex-col h-full">
      {/* 컨트롤 바 */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 flex-shrink-0 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <span>탐색 깊이</span>
          <input
            type="range"
            min={1}
            max={5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-24 accent-primary"
            aria-label="탐색 깊이 슬라이더"
          />
          <span className="w-4 text-center font-mono text-sm tabular-nums">{depth}</span>
        </label>
        {cycleData && cycleData.count > 0 && (
          <button
            onClick={() => {
              const firstCycle = cycleData.cycles[0]
              if (firstCycle?.[0]) setCenterId(firstCycle[0])
            }}
            className="h-8 px-3 text-xs border border-warning text-warning rounded-md hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-warning"
            aria-label="첫 번째 순환 참조 보기"
          >
            ⟳ 순환 참조 보기 ({cycleData.count})
          </button>
        )}
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className="ml-auto h-8 px-3 text-xs border border-neutral-200 rounded-md hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="그래프 중심 이동"
        >
          화면 맞추기
        </button>
      </div>

      {/* 그래프 영역 */}
      <div className="flex-1 relative" aria-label="콜 그래프 시각화">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10" role="status">
            <span className="text-sm text-neutral-500">그래프 불러오는 중...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span role="alert" className="text-sm text-danger">
              {error}
            </span>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 외부 컴포넌트 (모달 래퍼)
// ---------------------------------------------------------------------------

interface Props {
  methodId: string | null
  onClose?: () => void
  /** 노드 더블클릭 시 해당 메소드 상세 패널을 열도록 요청 */
  onMethodDoubleClick: (id: string) => void
  /** true이면 모달 래퍼 없이 인라인 컨테이너로 렌더링 */
  inline?: boolean
}

export default function CallGraph({ methodId, onClose, onMethodDoubleClick, inline = false }: Props) {
  const isOpen = methodId !== null

  // ESC 키로 닫기 (모달 모드에서만)
  useEffect(() => {
    if (inline) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, inline])

  // 인라인 모드: 모달 없이 컨테이너에 직접 렌더링
  if (inline) {
    return (
      <div className="h-full flex flex-col">
        {methodId && (
          <ReactFlowProvider>
            <CallGraphInner methodId={methodId} onMethodDoubleClick={onMethodDoubleClick} />
          </ReactFlowProvider>
        )}
      </div>
    )
  }

  // 모달 모드 (기본)
  return (
    <>
      {/* 오버레이 */}
      <div
        className={[
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={() => onClose?.()}
        aria-hidden="true"
      />

      {/* 그래프 모달 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="콜 그래프"
        className={[
          'fixed inset-4 bg-white rounded-xl shadow-2xl z-50 flex flex-col',
          'transition-all duration-300',
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
        ].join(' ')}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-neutral-900">콜 그래프</h2>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>클릭: 중심 이동 &nbsp;•&nbsp; 더블클릭: 상세 열기</span>
            <button
              onClick={() => onClose?.()}
              aria-label="그래프 닫기"
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ReactFlow 컨테이너 */}
        <div className="flex-1 overflow-hidden">
          {methodId && (
            <ReactFlowProvider>
              <CallGraphInner methodId={methodId} onMethodDoubleClick={onMethodDoubleClick} />
            </ReactFlowProvider>
          )}
        </div>
      </div>
    </>
  )
}
