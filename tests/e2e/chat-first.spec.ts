import { expect, test } from '@playwright/test';

test('opens a minimal dark chat even when the system prefers light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: 'What are you looking for?' })).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900);
});

test('keeps both exchanges when a natural followup changes the budget', async ({ page }) => {
  await page.goto('/');
  const composer = page.getByLabel('Message', { exact: true });
  await composer.fill('Headphones under SGD500');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('[data-active="true"] .product-card')).toHaveCount(3);
  await composer.fill('under SGD200');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByTestId('conversation-turn')).toHaveCount(2);
  await expect(page.getByTestId('user-message').first()).toContainText('Headphones under SGD500');
  await expect(page.getByTestId('assistant-message').first()).toContainText('leading sample match');
  await expect(page.locator('[data-active="true"] .product-card')).toHaveCount(1);
  await expect(page.locator('[data-testid="conversation-turn"][data-active="true"]')).toContainText('S$149');
  await expect(page.getByTestId('conversation-turn').first().getByRole('button', { name: 'Select this product' })).toHaveCount(0);
});
