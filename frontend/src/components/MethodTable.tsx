import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { api } from '../hooks/useApi'
import { useDebounce } from '../hooks/useDebounce'
import StatusBadge from './StatusBadge'
import type { MethodItem, SortByKey } from '../types'

// 그래프 아이콘 (인라인 SVG)
function GraphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="12" r="3" />
      <circle cx="19" cy="5" r="3" />
      <circle cx="19" cy="19" r="3" />
      <line x1="8" y1="11" x2="16" y2="6.5" />
      <line x1="8" y1="13" x2="16" y2="17.5" />
    </svg>
  )
}

const PAGE_SIZE = 20

const COLUMN_TO_SORT_KEY: Record<string, SortByKey> = {
  unitName: 'unit_name',
  methodName: 'method_name',
  callCount: 'call_count',
  lineNumber: 'line_number',
}

const columnHelper = createColumnHelper<MethodItem>()

interface UnitFilterOverride {
  unit: string
  trigger: number
}

interface Props {
  units: string[]
  onRowClick: (id: string) => void
  onGraphClick: (id: string) => void
  /** 외부(UnitChart 등)에서 유닛 필터를 강제 적용할 때 사용 */
  unitFilterOverride?: UnitFilterOverride
}

export default function MethodTable({ units, onRowClick, onGraphClick, unitFilterOverride }: Props) {
  const [items, setItems] = useState<MethodItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [unitFilter, setUnitFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'used' | 'unused' | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(searchInput, 300)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 외부에서 유닛 필터 강제 적용 (UnitChart 바 클릭 등)
  useEffect(() => {
    if (unitFilterOverride) {
      setUnitFilter(unitFilterOverride.unit)
      setPage(1)
    }
  }, [unitFilterOverride?.trigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortKey = (sorting[0]
    ? COLUMN_TO_SORT_KEY[sorting[0].id] ?? 'method_name'
    : 'method_name') as SortByKey
  const sortDir = sorting[0]?.desc ? 'desc' : 'asc'

  const fetchMethods = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getMethods({
        unit: unitFilter || undefined,
        status: (statusFilter as 'used' | 'unused') || undefined,
        search: debouncedSearch || undefined,
        sortBy: sortKey,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [unitFilter, statusFilter, debouncedSearch, sortKey, sortDir, page])

  useEffect(() => {
    void fetchMethods()
  }, [fetchMethods])

  // 필터 변경 시 첫 페이지로 이동
  const handleUnitChange = (val: string) => {
    setUnitFilter(val)
    setPage(1)
  }
  const handleStatusChange = (val: 'used' | 'unused' | '') => {
    setStatusFilter(val)
    setPage(1)
  }
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    setPage(1)
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('unitName', {
        header: '유닛',
        enableSorting: true,
      }),
      columnHelper.accessor('className', {
        header: '클래스',
        enableSorting: false,
        cell: (info) => info.getValue() ?? <span className="text-neutral-500">—</span>,
      }),
      columnHelper.accessor('methodName', {
        header: '메소드',
        enableSorting: true,
        cell: (info) => (
          <code className="font-mono text-sm text-neutral-800">{info.getValue()}</code>
        ),
      }),
      columnHelper.accessor('callCount', {
        header: '호출수',
        enableSorting: true,
        cell: (info) => (
          <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('isUsed', {
        header: '상태',
        enableSorting: false,
        cell: (info) => <StatusBadge isUsed={info.getValue()} />,
      }),
      columnHelper.display({
        id: 'graph',
        header: '',
        cell: (info) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onGraphClick(info.row.original.id)
            }}
            aria-label={`${info.row.original.methodName} 그래프 보기`}
            title="그래프 보기"
            className="p-1 rounded text-neutral-400 hover:text-primary hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            <GraphIcon />
          </button>
        ),
      }),
    ],
    [onGraphClick]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    onSortingChange: (updater) => {
      setSorting(updater)
      setPage(1)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section aria-label="메소드 목록">
      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* 유닛 드롭다운 */}
        <select
          value={unitFilter}
          onChange={(e) => handleUnitChange(e.target.value)}
          aria-label="유닛 필터"
          className="h-9 border border-neutral-200 rounded-md px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">전체 유닛</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        {/* 상태 필터 버튼 */}
        <div role="group" aria-label="상태 필터" className="flex gap-1">
          {(['', 'used', 'unused'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              aria-pressed={statusFilter === s}
              className={[
                'h-9 px-3 rounded-md text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
              ].join(' ')}
            >
              {s === '' ? '전체' : s === 'used' ? '사용' : '미사용'}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="메소드명 검색..."
          aria-label="메소드명 검색"
          className="h-9 border border-neutral-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48"
        />

        <span className="ml-auto text-sm text-neutral-500">
          {isLoading ? '불러오는 중...' : `총 ${total}개`}
        </span>
      </div>

      {/* 에러 */}
      {error && <p role="alert" className="text-danger text-sm mb-3">{error}</p>}

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <table className="w-full text-sm" role="grid">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-neutral-100 border-b border-neutral-200">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const ariaSort = sorted === 'asc'
                    ? 'ascending'
                    : sorted === 'desc'
                    ? 'descending'
                    : 'none'

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? ariaSort : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={[
                        'px-4 py-3 text-left font-semibold text-neutral-800 select-none',
                        canSort ? 'cursor-pointer hover:text-primary' : '',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-neutral-400 text-xs" aria-hidden="true">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
                          </span>
                        )}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-neutral-500"
                >
                  {isLoading ? '데이터를 불러오는 중...' : '메소드가 없습니다.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onRowClick(row.original.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowClick(row.original.id)
                    }
                  }}
                  className={[
                    'border-b border-neutral-100 cursor-pointer',
                    'hover:bg-blue-50 focus:bg-blue-50 focus:outline-none',
                    idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white',
                  ].join(' ')}
                  style={{ height: '44px' }}
                  aria-label={`${row.original.unitName}.${row.original.methodName} 상세 보기`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || isLoading}
          className="h-8 px-3 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="이전 페이지"
        >
          ← 이전
        </button>
        <span className="text-sm text-neutral-500" aria-live="polite">
          {page} / {totalPages} 페이지
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || isLoading}
          className="h-8 px-3 text-sm border border-neutral-200 rounded-md disabled:opacity-40 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="다음 페이지"
        >
          다음 →
        </button>
      </div>
    </section>
  )
}
