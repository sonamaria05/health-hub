import { expect, test } from '@playwright/test';
import { mockAuthenticatedSession } from './helpers/authenticated';

test('patient role is redirected to a 403 on the clinician-only route', async ({ page }) => {
  await mockAuthenticatedSession(page, ['patient']);
  await page.goto('/clinician');

  await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible();
});

test('clinician role can access the clinician-only route', async ({ page }) => {
  await mockAuthenticatedSession(page, ['patient', 'clinician']);
  await page.goto('/clinician');

  await expect(page.getByRole('heading', { name: /clinician dashboard/i })).toBeVisible();
});

test('admin role can access the clinician-only route', async ({ page }) => {
  await mockAuthenticatedSession(page, ['patient', 'admin']);
  await page.goto('/clinician');

  await expect(page.getByRole('heading', { name: /clinician dashboard/i })).toBeVisible();
});

test('unverified email is blocked from every protected route with a verification screen', async ({ page }) => {
  await mockAuthenticatedSession(page, ['patient']);
  // Override the mocked /auth/v1/user response so email_confirmed_at is null.
  await page.route('**/auth/v1/user', async (route) => {
    const json = await route.fetch().then((r) => r.json()).catch(() => ({ user: {} }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...json, user: { ...json.user, email_confirmed_at: null } }),
    });
  });

  await page.goto('/records');
  await expect(page.getByText(/verify your email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /resend verification/i })).toBeVisible();
});

test('settings page walks through TOTP enrollment up to the QR/verify step', async ({ page }) => {
  await mockAuthenticatedSession(page, ['patient']);

  await page.route('**/auth/v1/factors', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totp: [], phone: [] }) });
      return;
    }
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'factor-e2e-1',
          type: 'totp',
          totp: { qr_code: '<svg></svg>', secret: 'MOCKSECRET1234', uri: 'otpauth://totp/mock' },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /enable two-factor authentication/i })).toBeVisible();
  await page.getByRole('button', { name: /enable two-factor authentication/i }).click();

  await expect(page.getByLabel(/6-digit code/i)).toBeVisible();
  await expect(page.getByText(/MOCKSECRET1234/)).toBeVisible();
});
