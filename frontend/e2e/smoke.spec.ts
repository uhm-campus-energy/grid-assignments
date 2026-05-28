import { test, expect } from '@playwright/test';

test('app loads with header and both tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Grid Assignments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid Map Assignment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Low Load, High PV' })).toBeVisible();
});

test('grid map tab shows scenario selector populated from the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Substation Meter')).toBeVisible();
  // The scenario <select> is populated from /api/scenarios (4 scenarios).
  await expect(page.locator('select').first().locator('option')).toHaveCount(4);
});

test('low load / high pv tab renders charts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Low Load, High PV' }).click();
  await expect(page.getByText('Measure Names')).toBeVisible();
  // react-plotly mounts .js-plotly-plot nodes once kw-data has loaded.
  await expect(page.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 20_000 });
});

test('health endpoint is reachable', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
});
