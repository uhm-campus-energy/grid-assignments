import { test, expect, Page } from '@playwright/test';
import { TEST_USER, TEST_PASS } from '../playwright.config';

// Logging in succeeds only once the authed app renders — keyed off the logout
// button, which (unlike the "Grid Assignments" heading) exists only post-login.
async function login(page: Page) {
  await page.goto('/');
  await page.getByTestId('login-username').fill(TEST_USER);
  await page.getByTestId('login-password').fill(TEST_PASS);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('logout')).toBeVisible();
}

test('login page renders and rejects bad credentials', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await page.getByTestId('login-username').fill('nope');
  await page.getByTestId('login-password').fill('wrong');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toBeVisible();
  // Still on the login screen (no app chrome).
  await expect(page.getByTestId('logout')).toHaveCount(0);
});

test('valid login loads the app with both tabs', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: 'Grid Map Assignment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Low Load, High PV' })).toBeVisible();
});

test('grid map tab shows scenario selector populated from the API', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Substation Meter')).toBeVisible();
  // The scenario <select> is populated from /api/scenarios (4 scenarios).
  await expect(page.locator('select').first().locator('option')).toHaveCount(4);
});

test('low load / high pv tab renders charts', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Low Load, High PV' }).click();
  await expect(page.getByText('Measure Names')).toBeVisible();
  // react-plotly mounts .js-plotly-plot nodes once kw-data has loaded.
  await expect(page.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 20_000 });
});

test('data API requires auth (401 without token), health is public', async ({ request }) => {
  const data = await request.get('/api/grid-assignments?scenario=2026_04_11');
  expect(data.status()).toBe(401);
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
});
