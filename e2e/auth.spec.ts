import { expect, test } from '@playwright/test';

test('auth page supports login, signup, and forgot password states', async ({ page }) => {
  await page.goto('/auth');

  await expect(page.getByRole('heading', { name: 'Healytics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByLabel('Full Name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
});

test('reset password route shows expired state without a token', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByText('Invalid or expired reset link.')).toBeVisible();
});

test('login form enforces required fields in the browser', async ({ page }) => {
  await page.goto('/auth');

  await page.getByRole('button', { name: 'Sign In' }).click();

  const email = page.getByLabel('Email');
  const password = page.getByLabel('Password');

  await expect(email).toBeFocused();
  await expect(password).toHaveValue('');
});

test('forgot password mode can return to sign in mode', async ({ page }) => {
  await page.goto('/auth');

  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
