import { test, expect } from '@playwright/test';

test('app loads with header and both tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Grid Assignments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid Map Assignment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Low Load, High PV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About the Data' })).toBeVisible();
});

test('about the data tab shows the data notes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About the Data' }).click();
  await expect(page.getByText('Missing or broken meters')).toBeVisible();
});

test('grid map tab shows scenario selector populated from the API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Substation Meter')).toBeVisible();
  // The scenario <select> is populated from /api/scenarios (5 scenarios).
  await expect(page.locator('select').first().locator('option')).toHaveCount(5);
});

test('low load / high pv tab renders charts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Low Load, High PV' }).click();
  await expect(page.getByText('Measure Names')).toBeVisible();
  // react-plotly mounts .js-plotly-plot nodes once kw-data has loaded.
  await expect(page.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 20_000 });
});

test('each circuit chart has a PV vs demand summary line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Low Load, High PV' }).click();
  await expect(page.getByText(/PV (exceeds demand \d|stays below demand)/).first()).toBeVisible({ timeout: 20_000 });
});

test('map legend shows a backflow status per bus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/^(OK|PV > demand)$/).first()).toBeVisible({ timeout: 20_000 });
});

test('health endpoint is reachable', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
});

test('meter search opens that meter', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Find meter').fill('hper_main');
  await expect(page.getByRole('heading', { name: 'hper_main' })).toBeVisible();
});

test('tab and assignment are kept in the URL', async ({ page }) => {
  await page.goto('/?tab=pv&scenario=2026_08_04');
  await expect(page.getByText('Measure Names')).toBeVisible();
  await expect(page.locator('select').first()).toHaveValue('2026_08_04');
  await page.getByRole('button', { name: 'Grid Map Assignment' }).click();
  await expect(page).toHaveURL(/\?tab=map&scenario=2026_08_04$/);
});

test('compare tab lists the meters on a different bus', async ({ page }) => {
  await page.goto('/?tab=compare&scenario=2026_04_11');
  await expect(page.getByText(/^Meters on a different bus \(\d+\)$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Compare with')).toHaveValue('2026_04_23');
});
