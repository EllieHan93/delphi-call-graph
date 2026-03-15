// API 응답 타입 정의 — 백엔드 routes.py의 camelCase 응답 모델과 1:1 대응

export type MethodType = 'procedure' | 'function' | 'constructor' | 'destructor'

/** POST /api/analyze 및 GET /api/summary 응답 */
export interface SummaryResponse {
  projectName: string
  totalUnits: number
  totalMethods: number
  usedCount: number
  unusedCount: number
  /** 미사용 비율 (0~100 퍼센트, 백엔드에서 이미 *100 처리) */
  unusedRatio: number
}

/** GET /api/methods 목록 아이템 */
export interface MethodItem {
  id: string
  unitName: string
  className: string | null
  methodName: string
  methodType: MethodType
  signature: string
  lineNumber: number
  callCount: number
  isUsed: boolean
}

/** GET /api/methods 응답 */
export interface MethodListResponse {
  total: number
  page: number
  pageSize: number
  items: MethodItem[]
}

/** callers/callees 참조 아이템 */
export interface MethodRefItem {
  id: string
  unitName: string
  className: string | null
  methodName: string
}

/** GET /api/methods/{id} 응답 */
export interface MethodDetailResponse extends MethodItem {
  callers: MethodRefItem[]
  callees: MethodRefItem[]
  bodyText: string
}

/** GET /api/units 아이템 */
export interface UnitStats {
  unitName: string
  totalMethods: number
  usedMethods: number
  unusedMethods: number
  /** 사용 비율 (0~100 퍼센트) */
  usageRate: number
}

/** GET /api/units 응답 */
export interface UnitStatsResponse {
  total: number
  units: UnitStats[]
}

/** API sortBy 파라미터 타입 */
export type SortByKey = 'method_name' | 'unit_name' | 'call_count' | 'line_number'

/** GET /api/callgraph/{id} 노드 */
export interface CallGraphNode {
  id: string
  unitName: string
  className: string | null
  methodName: string
  isUsed: boolean
  isRoot: boolean
}

/** GET /api/callgraph/{id} 엣지 */
export interface CallGraphEdge {
  source: string
  target: string
}

/** GET /api/callgraph/{id} 응답 */
export interface CallGraphResponse {
  rootId: string
  depth: number
  nodes: CallGraphNode[]
  edges: CallGraphEdge[]
}
