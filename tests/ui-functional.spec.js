import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = pathToFileURL(path.join(process.cwd(), "index.html")).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
});

test("starts balanced across separate income and expense tables", async ({ page }) => {
  await expect(page.locator("#totalIncome")).toHaveText("820");
  await expect(page.locator("#totalExpense")).toHaveText("820");
  await expect(page.locator("#difference")).toHaveText("0");
  await expect(page.locator("#globalStatusText")).toHaveText("成功");
});

test("updates calculated columns and totals on every keystroke", async ({ page }) => {
  const firstIncomeRow = page.locator("#incomeRows .entry-wrap").first();
  const firstExpenseRow = page.locator("#expenseRows .entry-wrap").first();

  await firstIncomeRow.locator(".money-input").fill("10+5");
  await expect(firstIncomeRow.locator(".amount-box")).toHaveText("15");
  await expect(page.locator("#totalIncome")).toHaveText("715");

  await firstExpenseRow.locator(".money-input").fill("10");
  await expect(firstExpenseRow.locator(".amount-box")).toHaveText("10");
  await expect(page.locator("#totalExpense")).toHaveText("710");
  await expect(page.locator("#difference")).toHaveText("5");
});

test("allows income and expense row counts to differ", async ({ page }) => {
  const incomeCount = await page.locator("#incomeRows .entry-wrap").count();
  const expenseCount = await page.locator("#expenseRows .entry-wrap").count();

  await page.locator("#addIncomeBtn").click();

  await expect(page.locator("#incomeRows .entry-wrap")).toHaveCount(incomeCount + 1);
  await expect(page.locator("#expenseRows .entry-wrap")).toHaveCount(expenseCount);
});

test("uses the requested Telegram contacts", async ({ page }) => {
  await expect(page.locator("#telegramUser option")).toHaveText([
    "Lobeng · 6201817840",
    "Ocha · 5817507946",
    "Faisal · 5137608953",
  ]);
});
