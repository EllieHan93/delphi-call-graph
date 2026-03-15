import { test, expect } from '@playwright/test'
import path from 'path'

// 샘플 .dpr 절대 경로 (CI와 로컬 모두 동작)
const SAMPLE_DPR = path.resolve(__dirname, '../samples/SampleApp.dpr').replace(/\\/g, '/')

test.describe('Scenario 1: 전체 분석 플로우', () => {
  test('경로 입력 → 분석 실행 → 요약 카드 확인 → 테이블 필터 → 상세 패널', async ({ page }) => {
    await page.goto('/')

    // 1. 초기 빈 상태 확인
    await expect(page.getByText('Delphi 프로젝트를 분석해보세요')).toBeVisible()

    // 2. .dpr 경로 입력 및 분석 실행
    await page.getByLabel('.dpr 파일 경로').fill(SAMPLE_DPR)
    await page.getByRole('button', { name: '분석 실행' }).click()

    // 3. 로딩 중 스켈레톤 표시 (분석 빠를 경우 생략 가능)
    // 분석 완료 대기
    await expect(page.getByRole('heading', { name: '유닛별 메소드 사용률' })).toBeVisible({
      timeout: 15_000,
    })

    // 4. Overview 탭 — 요약 카드 확인
    await expect(page.getByText('총 메소드')).toBeVisible()
    await expect(page.getByText('사용')).toBeVisible()

    // 5. 헤더에 프로젝트명 표시
    await expect(page.getByLabel(/현재 프로젝트/)).toBeVisible()

    // 6. Methods 탭 전환
    await page.getByRole('tab', { name: 'Methods' }).click()
    await expect(page.getByRole('grid')).toBeVisible()

    // 7. 상태 필터 — 미사용 클릭
    await page.getByRole('button', { name: '미사용', pressed: false }).click()
    // 테이블에 미사용 배지만 표시되는지 확인
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    if (count > 0) {
      await expect(rows.first().getByText('미사용')).toBeVisible()
    }

    // 8. 메소드명 검색
    await page.getByLabel('메소드명 검색').fill('Create')
    await expect(page.getByLabel('메소드명 검색')).toHaveValue('Create')

    // 9. 첫 번째 행 클릭 → 상세 패널 열기
    await page.getByLabel('메소드명 검색').fill('')
    await page.getByRole('button', { name: '미사용', pressed: true }).click() // 전체로 돌아가기
    await expect(rows.first()).toBeVisible()
    await rows.first().click()

    // 상세 패널 표시 확인
    await expect(page.getByRole('dialog', { name: '메소드 상세' })).toBeVisible()

    // ESC로 패널 닫기
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '메소드 상세' })).not.toBeVisible()
  })
})

test.describe('Scenario 2: 콜 그래프 조회', () => {
  test('메소드 선택 → 콜 그래프 탭 → depth 변경', async ({ page }) => {
    await page.goto('/')

    // 분석 실행
    await page.getByLabel('.dpr 파일 경로').fill(SAMPLE_DPR)
    await page.getByRole('button', { name: '분석 실행' }).click()
    await expect(page.getByRole('tab', { name: 'Methods' })).toBeVisible({ timeout: 15_000 })

    // Methods 탭으로 이동
    await page.getByRole('tab', { name: 'Methods' }).click()
    await expect(page.getByRole('grid')).toBeVisible()

    // 첫 번째 행의 그래프 보기 버튼 클릭
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toBeVisible()
    const methodName = await firstRow.locator('code').first().textContent()

    const graphBtn = firstRow.getByRole('button', { name: /그래프 보기/ })
    await graphBtn.click()

    // Call Graph 탭으로 자동 전환
    await expect(page.getByRole('tab', { name: 'Call Graph', selected: true })).toBeVisible()

    // 그래프 컨테이너 표시 확인
    const tabPanel = page.getByRole('tabpanel', { name: 'tab-callgraph' }).or(
      page.locator('#tabpanel-callgraph')
    )
    await expect(tabPanel).toBeVisible()

    // depth 슬라이더가 있는지 확인
    await expect(page.getByLabel('탐색 깊이 슬라이더')).toBeVisible({ timeout: 10_000 })

    // depth를 3으로 변경
    await page.getByLabel('탐색 깊이 슬라이더').fill('3')
    await expect(page.getByLabel('탐색 깊이 슬라이더')).toHaveValue('3')

    // 메소드 상세 패널에서 그래프 열기
    await page.getByRole('tab', { name: 'Methods' }).click()
    await firstRow.click()
    await expect(page.getByRole('dialog', { name: '메소드 상세' })).toBeVisible()

    const graphOpenBtn = page.getByRole('button', { name: '콜 그래프 열기' })
    if (await graphOpenBtn.isVisible()) {
      await graphOpenBtn.click()
      await expect(page.getByRole('tab', { name: 'Call Graph', selected: true })).toBeVisible()
    }

    console.log(`테스트 대상 메소드: ${methodName ?? '(unknown)'}`)
  })
})

test.describe('Scenario 3: 에러 시나리오', () => {
  test('잘못된 경로 입력 시 에러 메시지 표시', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('.dpr 파일 경로').fill('C:/not/existing/file.dpr')
    await page.getByRole('button', { name: '분석 실행' }).click()

    // 에러 메시지 표시 확인
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
  })

  test('빈 경로 입력 시 유효성 검증 메시지 표시', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '분석 실행' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveText('.dpr 파일 경로를 입력하세요.')
  })

  test('UnitChart 바 클릭 → Methods 탭 필터 연동', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('.dpr 파일 경로').fill(SAMPLE_DPR)
    await page.getByRole('button', { name: '분석 실행' }).click()
    await expect(page.getByRole('heading', { name: '유닛별 메소드 사용률' })).toBeVisible({
      timeout: 15_000,
    })

    // 첫 번째 유닛 바 클릭
    const firstBar = page.getByRole('listitem').first()
    const unitName = await firstBar.evaluate((el) => {
      const span = el.querySelector('span')
      return span?.textContent?.trim() ?? ''
    })
    await firstBar.click()

    // Methods 탭으로 전환 확인
    await expect(page.getByRole('tab', { name: 'Methods', selected: true })).toBeVisible()

    // 유닛 드롭다운이 해당 유닛으로 필터링됨
    const select = page.getByLabel('유닛 필터')
    await expect(select).toHaveValue(unitName)
  })
})
