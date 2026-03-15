import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // E2E 실행 전 백엔드+프론트엔드 서버 기동 (CI 환경)
  // 로컬에서는 직접 서버를 올린 후 테스트 실행
  webServer: process.env.CI
    ? [
        {
          command: 'uvicorn backend.main:app --port 8000',
          port: 8000,
          cwd: '..',
          reuseExistingServer: false,
          timeout: 30_000,
        },
        {
          command: 'npm run preview --prefix frontend',
          port: 5173,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ]
    : undefined,
})
