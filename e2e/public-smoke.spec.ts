import { expect, test } from '@playwright/test';

test('root route redirects unauthenticated users to auth', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/auth$/);
});

test('favicon is exposed as the project branding asset', async ({ page }) => {
  await page.goto('/auth');
  const faviconHref = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(faviconHref).toBe('/icon.png');
});

for (const route of ['/upload', '/records', '/analytics', '/predictions', '/settings']) {
  test(`protected route ${route} redirects unauthenticated users to auth`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth$/);
  });
}

test('auth page exposes project branding and description', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.getByRole('heading', { name: 'Healytics' })).toBeVisible();
  await expect(page.getByText('Sign in to access your medical records')).toBeVisible();
});
