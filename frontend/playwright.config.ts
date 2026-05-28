import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 4173;

// E2E test credentials — must match the env passed to the backend webServer below.
export const TEST_USER = 'testuser';
export const TEST_PASS = 'testpass';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Backend on the CSV backend, pointed at a throwaway copy so e2e writes
      // never touch the real data file (see memory: csv-is-sole-data-copy).
      // cwd is the repo root; assumes the project venv at .venv/.
      command:
        'cp data/grid_assignments.csv /tmp/grid_e2e.csv && ' +
        `DATA_BACKEND=csv GRID_CSV_PATH=/tmp/grid_e2e.csv ` +
        `APP_USERNAME=${TEST_USER} APP_PASSWORD=${TEST_PASS} AUTH_SECRET=e2e-secret ` +
        `.venv/bin/uvicorn backend.main:app --port ${BACKEND_PORT}`,
      cwd: '..',
      port: BACKEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Build then serve the production bundle; preview proxies /api to backend.
      command: 'npm run build && npm run preview',
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
