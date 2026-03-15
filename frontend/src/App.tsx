import { useState, useEffect } from 'react'
import ProjectInput from './components/ProjectInput'
import SummaryCards from './components/SummaryCards'
import MethodTable from './components/MethodTable'
import MethodDetail from './components/MethodDetail'
import CallGraph from './components/CallGraph'
import UnitChart from './components/UnitChart'
import { api } from './hooks/useApi'
import type { SummaryResponse } from './types'

type TabId = 'overview' | 'methods' | 'callgraph'

interface UnitFilterOverride {
  unit: string
  trigger: number
}

// ---------------------------------------------------------------------------
// 로딩 스켈레톤
// ---------------------------------------------------------------------------

function AnalysisSkeleton() {
  return (
    <div aria-label="분석 중..." aria-busy="true" className="space-y-8">
      {/* 카드 스켈레톤 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
            <div className="h-3 w-20 bg-neutral-200 rounded animate-pulse" />
            <div className="h-7 w-12 bg-neutral-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* 테이블 스켈레톤 */}
      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-neutral-100">
            <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-neutral-200 rounded animate-pulse" />
            <div className="h-4 w-8 bg-neutral-200 rounded animate-pulse ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 빈 상태
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">⎇</div>
      <h2 className="text-lg font-semibold text-neutral-700 mb-2">Delphi 프로젝트를 분석해보세요</h2>
      <p className="text-sm text-neutral-500 max-w-sm">
        위 입력창에 <code className="font-mono text-xs bg-neutral-100 px-1 rounded">.dpr</code> 파일 경로를 입력하고
        <strong> 분석 실행</strong> 버튼을 누르면 메소드 호출 관계를 시각화합니다.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 앱 루트
// ---------------------------------------------------------------------------

export default function App() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [units, setUnits] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null)
  const [graphMethodId, setGraphMethodId] = useState<string | null>(null)
  const [unitFilterOverride, setUnitFilterOverride] = useState<UnitFilterOverride | undefined>(undefined)

  useEffect(() => {
    if (!summary) return
    api
      .getUnits()
      .then((res) => setUnits(res.units.map((u) => u.unitName)))
      .catch(() => {
        // 유닛 목록 로드 실패 시 무시 (드롭다운이 비어있을 뿐)
      })
  }, [summary])

  const handleGraphOpen = (id: string) => {
    setGraphMethodId(id)
    setActiveTab('callgraph')
  }

  const handleUnitBarClick = (unitName: string) => {
    setUnitFilterOverride({ unit: unitName, trigger: Date.now() })
    setActiveTab('methods')
  }

  const handleAnalysisComplete = (s: SummaryResponse) => {
    setSummary(s)
    setIsAnalyzing(false)
    setActiveTab('overview')
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'methods', label: 'Methods' },
    { id: 'callgraph', label: 'Call Graph' },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Delphi Call Graph Analyzer</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Delphi 프로젝트의 메소드 호출 관계를 정적 분석합니다
            </p>
          </div>
          {/* 분석 완료 후 프로젝트명 표시 */}
          {summary && (
            <span
              className="text-sm font-mono text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full"
              aria-label={`현재 프로젝트: ${summary.projectName}`}
            >
              {summary.projectName}
            </span>
          )}
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 프로젝트 입력 */}
        <div className="mb-8">
          <ProjectInput
            onAnalysisStart={() => setIsAnalyzing(true)}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </div>

        {/* 분석 중 */}
        {isAnalyzing && <AnalysisSkeleton />}

        {/* 분석 전 빈 상태 */}
        {!isAnalyzing && !summary && <EmptyState />}

        {/* 분석 결과 */}
        {!isAnalyzing && summary && (
          <>
            {/* 탭 네비게이션 */}
            <div className="flex border-b border-neutral-200 mb-6" role="tablist" aria-label="뷰 선택">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Overview 탭 */}
            <div
              id="tabpanel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              hidden={activeTab !== 'overview'}
              className="space-y-8"
            >
              <SummaryCards summary={summary} />
              <UnitChart onUnitClick={handleUnitBarClick} />
            </div>

            {/* Methods 탭 */}
            <div
              id="tabpanel-methods"
              role="tabpanel"
              aria-labelledby="tab-methods"
              hidden={activeTab !== 'methods'}
            >
              <MethodTable
                units={units}
                onRowClick={setSelectedMethodId}
                onGraphClick={handleGraphOpen}
                unitFilterOverride={unitFilterOverride}
              />
            </div>

            {/* Call Graph 탭 */}
            <div
              id="tabpanel-callgraph"
              role="tabpanel"
              aria-labelledby="tab-callgraph"
              hidden={activeTab !== 'callgraph'}
              className="h-[640px] border border-neutral-200 rounded-lg overflow-hidden bg-white"
            >
              {graphMethodId ? (
                <CallGraph
                  methodId={graphMethodId}
                  onMethodDoubleClick={setSelectedMethodId}
                  inline
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                  <div className="text-3xl text-neutral-300" aria-hidden="true">⎇</div>
                  <p className="text-sm text-neutral-500">
                    Methods 탭에서 메소드의 그래프 아이콘을 클릭하면 이곳에 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 메소드 상세 패널 (탭에 무관하게 슬라이드오버) */}
      <MethodDetail
        methodId={selectedMethodId}
        onClose={() => setSelectedMethodId(null)}
        onMethodSelect={setSelectedMethodId}
        onGraphOpen={handleGraphOpen}
      />
    </div>
  )
}
