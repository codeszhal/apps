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
  await expect(page.locator("#globalStatus")).toHaveClass(/ok/);
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

test("main toolbar uses language, save report, and settings cards", async ({ page }) => {
  await expect(page.locator("#calcToolbar")).toHaveCount(0);
  await expect(page.locator(".toolbar-card")).toHaveCount(3);
  await expect(page.locator("#languageButtonLabel")).toHaveText("中文");
  await expect(page.locator("#saveImageBtn")).toContainText("保存报表");
  await expect(page.locator("#settingsBtn")).toContainText("设置");
});

test("language dropdown updates only the toolbar label for MVP", async ({ page }) => {
  await page.locator("#languageSelect").selectOption("English");
  await expect(page.locator("#languageButtonLabel")).toHaveText("English");
  await expect(page.locator("#appTitle")).toHaveText("收支核对");

  await page.reload();
  await expect(page.locator("#languageButtonLabel")).toHaveText("English");
});

test("settings button opens the MVP settings panel", async ({ page }) => {
  await page.locator("#settingsBtn").click();

  await expect(page.locator("#settingsDialog")).toBeVisible();
  await expect(page.locator("#settingsDialog")).toContainText("主题模式");
  await expect(page.locator("#settingsDialog")).toContainText("合计货币");
  await expect(page.locator("#settingsDialog")).toContainText("数字格式");
  await expect(page.locator("#settingsDialog")).toContainText("紧凑模式");
  await expect(page.locator("#settingsDialog")).toContainText("自动保存");
  await expect(page.locator("#backupBtn")).toHaveText("导出");
  await expect(page.locator("label.import-btn")).toContainText("导入");
  await expect(page.locator("#resetLocalDataBtn")).toHaveText("重置本地数据");
  await expect(page.locator("#updateVersionBtn")).toHaveText("检查更新");
});

test("settings dark mode applies a non-clashing visual theme", async ({ page }) => {
  await page.locator("#settingsBtn").click();
  await page.locator('[data-setting="theme"][data-value="dark"]').click();

  await expect(page.locator("body")).toHaveClass(/theme-dark/);
  await expect(page.locator("#settingsDialog .settings-panel")).toHaveCSS("background-color", "rgb(17, 24, 39)");
});

test("amount cell owns the row action and the separate action column is removed", async ({ page }) => {
  await expect(page.locator("#incomeTable .ledger-head div")).toHaveText([
    "",
    "名",
    "金额",
    "合计",
  ]);
  await expect(page.locator("#incomeRows .entry-wrap").first().locator(".ledger-row > .cell")).toHaveCount(4);
  await expect(page.locator("#incomeRows .entry-wrap").first().locator(".money-wrap .amount-action-btn")).toHaveCount(1);
  await expect(page.locator("#incomeRows .entry-wrap").first().locator(".amount-action-btn img")).toHaveAttribute("src", "assets/icons/broom.svg");
  await expect(page.locator("#incomeRows .entry-wrap").first().locator(".action-cell")).toHaveCount(0);
});

test("amount column stays wider after moving the action into the amount cell", async ({ page }) => {
  const widths = await page.locator("#incomeTable .ledger-head div").evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().width))
  );

  expect(widths).toHaveLength(4);
  expect(widths[2] / widths[1]).toBeGreaterThan(3);
});

test("tapping the broom action empties only the amount cell", async ({ page }) => {
  const firstIncomeRow = page.locator("#incomeRows .entry-wrap").first();
  const initialCount = await page.locator("#incomeRows .entry-wrap").count();

  await firstIncomeRow.locator(".amount-action-btn").click();

  await expect(page.locator("#incomeRows .entry-wrap")).toHaveCount(initialCount);
  await expect(firstIncomeRow.locator(".money-input")).toHaveValue("");
  await expect(firstIncomeRow.locator(".amount-box")).toHaveText("0");
  await expect(page.locator("#totalIncome")).toHaveText("700");
});

test("long pressing the broom action opens delete popover and delete row uses snackbar undo", async ({ page }) => {
  let dialogSeen = false;
  page.on("dialog", async (dialog) => {
    dialogSeen = true;
    await dialog.dismiss();
  });

  const firstButton = page.locator("#incomeRows .entry-wrap").first().locator(".amount-action-btn");
  await firstButton.dispatchEvent("pointerdown", { pointerType: "touch", button: 0 });
  await page.waitForTimeout(650);
  await expect(page.locator("#amountActionPopover")).toBeVisible();
  await firstButton.dispatchEvent("pointerup", { pointerType: "touch", button: 0 });

  await page.locator("#deleteRowFromPopover").click();

  expect(dialogSeen).toBe(false);
  await expect(page.locator("#incomeRows .entry-wrap")).toHaveCount(3);
  await expect(page.locator("#totalIncome")).toHaveText("700");
  await expect(page.locator("#undoSnackbar")).toBeVisible();

  await page.locator("#undoSnackbarBtn").click();

  await expect(page.locator("#incomeRows .entry-wrap")).toHaveCount(4);
  await expect(page.locator("#totalIncome")).toHaveText("820");
});

test("new name inputs keep the Chinese keyboard hint", async ({ page }) => {
  await page.locator("#addIncomeBtn").click();

  const newestNameInput = page.locator("#incomeRows .entry-wrap").last().locator("input").first();
  await expect(newestNameInput).toHaveAttribute("lang", "zh-CN");
  await expect(newestNameInput).toHaveAttribute("inputmode", "text");
  await expect(newestNameInput).toHaveAttribute("autocapitalize", "off");
  await expect(newestNameInput).toHaveAttribute("autocorrect", "off");
  await expect(newestNameInput).toHaveAttribute("spellcheck", "false");
});

test("saved image draws the date with header padding", async ({ page }) => {
  await page.evaluate(() => {
    window.__drawnText = [];
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const context = originalGetContext.call(this, type, ...args);
      if (type !== "2d" || context.__textCaptureInstalled) return context;

      const originalFillText = context.fillText.bind(context);
      context.fillText = (text, x, y, ...rest) => {
        window.__drawnText.push({ text: String(text), x, y });
        return originalFillText(text, x, y, ...rest);
      };
      context.__textCaptureInstalled = true;
      return context;
    };

    HTMLCanvasElement.prototype.toBlob = function(callback) {
      callback(new Blob(["png"], { type: "image/png" }));
    };
    HTMLAnchorElement.prototype.click = function() {};
    navigator.canShare = () => false;
  });

  await page.locator("#saveImageBtn").click();

  const dateText = await page.evaluate(() =>
    window.__drawnText.find((item) => /^日期：\d{4}-\d{2}-\d{2}$/.test(item.text))
  );

  expect(dateText).toBeTruthy();
  expect(dateText.x).toBe(70);
  expect(dateText.y).toBe(130);
});

test("token field supports stable paste-friendly text input while masked", async ({ page }) => {
  const tokenInput = page.locator("#telegramToken");

  await expect(tokenInput).toHaveAttribute("type", "text");
  await expect(tokenInput).toHaveAttribute("autocomplete", "off");
  await expect(tokenInput).toHaveAttribute("autocapitalize", "off");
  await expect(tokenInput).toHaveAttribute("spellcheck", "false");
  await expect(tokenInput).toHaveCSS("-webkit-text-security", "disc");
});

test("uses the requested Telegram contacts", async ({ page }) => {
  await expect(page.locator("#telegramUser option")).toHaveText([
    "Lobeng · 6201817840",
    "Ocha · 5817507946",
    "Faisal · 5137608953",
  ]);
});
