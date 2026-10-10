import { expect, test } from '@playwright/test';
import { mockAuthenticatedSession } from './helpers/authenticated';

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page);
});

test('authenticated user can open dashboard and see reminders', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Welcome back, Sona/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible();
  await expect(page.getByText('Repeat HbA1c test')).toBeVisible();
});

test('authenticated user can open predictions page', async ({ page }) => {
  await page.goto('/predictions');

  await expect(page.getByRole('heading', { name: 'Health Insights' })).toBeVisible();
  await expect(page.getByText('Backend Model')).toBeVisible();
  await expect(page.getByText('Cardiovascular Risk')).toBeVisible();
});

test('authenticated user can update settings and add a reminder', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByLabel('Display Name').fill('Sona QA');
  await page.getByRole('button', { name: 'Save Profile' }).click();

  await page.getByLabel('Reminder Title').fill('Take evening medication');
  await page.getByLabel('When').fill('2026-04-20T19:30');
  await page.getByLabel('Notes').fill('After dinner with water.');
  await page.getByRole('button', { name: 'Add Reminder' }).click();

  await expect(page.getByText('Take evening medication').first()).toBeVisible();
});

test('authenticated user can access records and analytics routes directly', async ({ page }) => {
  await page.goto('/records');
  await expect(page.getByRole('heading', { name: 'Medical Records' })).toBeVisible();
  await expect(page.getByText('Quarterly Lab Review')).toBeVisible();

  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Health Analytics' })).toBeVisible();
});
