import type {
  CallGraphResponse,
  ComplexityResponse,
  CycleResponse,
  MethodDetailResponse,
  MethodListResponse,
  SortByKey,
  SummaryResponse,
  UnitStatsResponse,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

interface ApiError {
  detail: string
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as ApiError).detail ?? '알 수 없는 오류가 발생했습니다.')
  }

  return res.json() as Promise<T>
}

export interface GetMethodsParams {
  unit?: string
  status?: 'used' | 'unused'
  search?: string
  sortBy?: SortByKey
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export const api = {
  analyze: (dprPath: string): Promise<SummaryResponse> =>
    apiFetch<SummaryResponse>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ dprPath }),
    }),

  getSummary: (): Promise<SummaryResponse> => apiFetch<SummaryResponse>('/api/summary'),

  getMethods: (params: GetMethodsParams = {}): Promise<MethodListResponse> => {
    const qs = new URLSearchParams()
    if (params.unit) qs.set('unit', params.unit)
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortDir) qs.set('sortDir', params.sortDir)
    if (params.page != null) qs.set('page', String(params.page))
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize))
    return apiFetch<MethodListResponse>(`/api/methods?${qs.toString()}`)
  },

  getMethodDetail: (id: string): Promise<MethodDetailResponse> =>
    apiFetch<MethodDetailResponse>(`/api/methods/${encodeURIComponent(id)}`),

  getUnits: (): Promise<UnitStatsResponse> => apiFetch<UnitStatsResponse>('/api/units'),

  getCallGraph: (id: string, depth?: number): Promise<CallGraphResponse> => {
    const qs = new URLSearchParams()
    if (depth != null) qs.set('depth', String(depth))
    return apiFetch<CallGraphResponse>(`/api/callgraph/${encodeURIComponent(id)}?${qs.toString()}`)
  },

  getCycles: (): Promise<CycleResponse> => apiFetch<CycleResponse>('/api/cycles'),

  getComplexity: (): Promise<ComplexityResponse> =>
    apiFetch<ComplexityResponse>('/api/complexity'),
}
