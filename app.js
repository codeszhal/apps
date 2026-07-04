const DB_NAME = "recon_separate_tables_v13";
const DB_VERSION = 1;
const STATE_STORE = "state";
const STATE_KEY = "current";
const LOCAL_KEY = "recon_separate_tables_state_v13";
const TOKEN_KEY = "telegram_bot_token_v13";
const UI_PREFS_KEY = "recon_toolbar_settings_prefs_v1";
const REPORT_STATUS_KEY = "recon_report_delivery_status_v1";

const TELEGRAM_USERS = [
  { name: "Lobeng", id: "6201817840" },
  { name: "Ocha", id: "5817507946" },
  { name: "Faisal", id: "5137608953" }
];

let db = null;
let state = defaultState();
let saveTimer = null;
let activeMoneyInput = null;
let dialogTarget = null;
let amountActionPressTimer = null;
let suppressNextAmountClear = false;
let popoverTarget = null;
let undoDeletePayload = null;
let undoSnackbarTimer = null;
let dismissedReminderKey = "";
let lastSavedImageUrl = "";

const $ = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);

const el = {
  appTitle: $("appTitle"),
  dailyStatus: $("dailyStatus"),
  dailyStatusIcon: $("dailyStatusIcon"),
  dailyStatusText: $("dailyStatusText"),
  dailyStatusSub: $("dailyStatusSub"),
  dailyTelegramCta: $("dailyTelegramCta"),
  dailyStatusDismiss: $("dailyStatusDismiss"),
  incomeNameLabel: $("incomeNameLabel"),
  incomeMoneyLabel: $("incomeMoneyLabel"),
  incomeTotalLabel: $("incomeTotalLabel"),
  expenseNameLabel: $("expenseNameLabel"),
  expenseMoneyLabel: $("expenseMoneyLabel"),
  expenseTotalLabel: $("expenseTotalLabel"),
  incomeRows: $("incomeRows"),
  expenseRows: $("expenseRows"),
  incomeSectionTotal: $("incomeSectionTotal"),
  expenseSectionTotal: $("expenseSectionTotal"),
  totalIncome: $("totalIncome"),
  totalExpense: $("totalExpense"),
  difference: $("difference"),
  diffBox: $("diffBox"),
  fontScale: $("fontScale"),
  saveState: $("saveState"),
  languageToggleBtn: $("languageToggleBtn"),
  languageButtonLabel: $("languageButtonLabel"),
  settingsBtn: $("settingsBtn"),
  settingsDialog: $("settingsDialog"),
  closeSettingsBtn: $("closeSettingsBtn"),
  settingsCompact: $("settingsCompact"),
  settingsAutoSave: $("settingsAutoSave"),
  resetLocalDataBtn: $("resetLocalDataBtn"),
  updateVersionBtn: $("updateVersionBtn"),
  settingsLanguageValue: $("settingsLanguageValue"),
  transferDeviceBtn: $("transferDeviceBtn"),
  transferDialog: $("transferDialog"),
  closeTransferDialog: $("closeTransferDialog"),
  transferCodeOutput: $("transferCodeOutput"),
  transferCodeInput: $("transferCodeInput"),
  copyTransferCodeBtn: $("copyTransferCodeBtn"),
  importTransferCodeBtn: $("importTransferCodeBtn"),
  transferStatus: $("transferStatus"),
  sendSelectedBtn: $("sendSelectedBtn"),
  sendAllBtn: $("sendAllBtn"),
  sendAllLabel: $("sendAllLabel"),
  sendAllSubLabel: $("sendAllSubLabel"),
  broadcastConfirmDialog: $("broadcastConfirmDialog"),
  broadcastConfirmText: $("broadcastConfirmText"),
  closeBroadcastConfirm: $("closeBroadcastConfirm"),
  cancelBroadcastBtn: $("cancelBroadcastBtn"),
  confirmBroadcastBtn: $("confirmBroadcastBtn"),
  telegramUser: $("telegramUser"),
  telegramToken: $("telegramToken"),
  telegramPreview: $("telegramPreview"),
  telegramStatus: $("telegramStatus"),
  exprDialog: $("exprDialog"),
  exprDialogTitle: $("exprDialogTitle"),
  exprDialogText: $("exprDialogText"),
  amountActionPopover: $("amountActionPopover"),
  deleteRowFromPopover: $("deleteRowFromPopover"),
  undoSnackbar: $("undoSnackbar"),
  undoSnackbarText: $("undoSnackbarText"),
  undoSnackbarBtn: $("undoSnackbarBtn")
};

const DEFAULT_LABELS = {
  "中文": {
    appTitle: "收支核对",
    incomeName: "名",
    incomeMoney: "金额",
    incomeTotal: "合计",
    expenseName: "名",
    expenseMoney: "金额",
    expenseTotal: "合计"
  },
  English: {
    appTitle: "Reconcile",
    incomeName: "Name",
    incomeMoney: "Amount",
    incomeTotal: "Total",
    expenseName: "Name",
    expenseMoney: "Amount",
    expenseTotal: "Total"
  }
};

const DEFAULT_LABEL_ALIASES = {
  incomeName: ["姓名"],
  incomeMoney: ["金额（可输入公式，实时计算）"],
  expenseName: ["姓名"],
  expenseMoney: ["金额（可输入公式，实时计算）"]
};

const UI_TEXT = {
  "中文": {
    documentTitle: "收支核对",
    live: "实时计算",
    subtitle: "三列同屏 · 收入与支出独立管理",
    saveReport: "保存报表",
    settings: "设置",
    sendTelegram: "发送 Telegram",
    autoSaveLabel: "自动保存",
    saved: "已保存",
    saving: "保存中…",
    saveFailed: "保存失败",
    summaryIncome: "收入",
    summaryExpense: "支出",
    summaryDiff: "差额",
    incomeTable: "收入表",
    expenseTable: "支出表",
    addIncome: "添加收入",
    addExpense: "添加支出",
    incomeTotal: "收入合计",
    expenseTotal: "支出合计",
    telegramTitle: "Telegram 发送",
    telegramHint: "选择用户或发送给全部",
    telegramUser: "用户",
    tokenPlaceholder: "输入 Bot Token，不要写进代码",
    sendSelected: "发送给选中用户",
    sendSelectedSub: "仅发送给所选用户",
    sendAll: "发送给全部",
    sendAllCount: "发送给全部 ({count})",
    sendAllSub: "发送给 {count} 位用户",
    copyContent: "复制内容",
    copyContentSub: "复制到剪贴板",
    telegramNote: "提示：Telegram 用户必须先打开并开始你的 Bot，否则 Bot API 无法主动发送。",
    appNote: "收入与支出是两个独立表格，行数不需要相同。金额栏会保留原文并实时计算；每 2 秒自动复核一次。合计栏只显示计算结果。金额支持：100+20、500-75、12*3、1000/4、100×3、1000÷4。末尾等号、空格、多行都安全。",
    designTitle: "设计说明",
    design1Title: "独立表格",
    design1Text: "收入与支出分开展示",
    design2Title: "金额列超宽",
    design2Text: "支持多行公式与实时计算",
    design3Title: "实时状态",
    design3Text: "有效 / 输入中 / 错误 即时反馈",
    design4Title: "紧凑布局",
    design4Text: "适配 iPhone 14 Pro Max PWA",
    exprTitle: "金额详情",
    save: "保存",
    settingsSubtitle: "偏好、数据与设备迁移",
    appearance: "外观",
    themeMode: "主题模式",
    themeModeSub: "切换浅色或深色界面",
    light: "浅色",
    dark: "深色",
    compactMode: "紧凑模式",
    compactModeSub: "在手机屏幕显示更多内容",
    localization: "本地化",
    language: "语言 / Language",
    languageSub: "顶部按钮可快速切换",
    totalCurrency: "合计货币",
    totalCurrencySub: "用于总金额显示",
    data: "数据",
    importData: "导入数据",
    importDataSub: "从 JSON 文件导入数据",
    exportData: "导出数据",
    exportDataSub: "导出为 JSON 文件",
    transferDevice: "转移到新设备",
    transferDeviceSub: "复制或导入一次性迁移码",
    autoSaveSub: "编辑后自动保存本地数据",
    about: "关于",
    version: "版本",
    versionSub: "PWA 本地应用",
    checkUpdate: "检查更新",
    checkUpdateSub: "确认当前是否为最新版本",
    advanced: "高级",
    resetData: "重置本地数据",
    resetDataSub: "清除本机保存的数据，无法恢复",
    transferTitle: "转移到新设备",
    transferSubtitle: "用迁移码把当前数据复制到另一台设备",
    oldDevice: "旧设备：生成迁移码",
    oldDeviceSub: "复制下方代码，在新设备中粘贴导入。",
    copyTransfer: "复制迁移码",
    newDevice: "新设备：导入迁移码",
    newDeviceSub: "粘贴旧设备生成的迁移码，然后导入。",
    transferPlaceholder: "粘贴迁移码",
    importTransfer: "导入到此设备",
    transferStatusDefault: "迁移码包含当前账单与偏好设置。请只发送给你信任的设备。",
    broadcastTitle: "发送给全部用户",
    broadcastText: "你将把这条消息发送给 {count} 位 Telegram 用户。此操作无法撤销，确定要继续吗？",
    cancel: "取消",
    confirmSend: "确认发送",
    deleteRow: "删除此行",
    undo: "撤销",
    reminderUnsavedTitle: "尚未保存",
    reminderUnsavedSub: "保存为图片，避免数据丢失。",
    reminderSavedTitle: "已保存",
    reminderSavedSub: "上次保存于 {time}",
    reminderModifiedTitle: "检测到修改",
    reminderModifiedSub: "再次保存，让数据保持安全。",
    reminderSaveAction: "保存图片",
    reminderViewAction: "查看图片",
    reminderDismiss: "关闭提醒",
    amountError: "金额错误",
    typing: "输入中",
    valid: "有效",
    waitInput: "待输入",
    amountInput: "金额输入框",
    clearAmount: "清空金额",
    incomeAmountDetail: "收入金额详情",
    expenseAmountDetail: "支出金额详情",
    rowDeleted: "行已删除",
    resetPlaceholder: "Reset local data is a placeholder",
    versionCurrent: "Version is up to date",
    importSuccess: "导入成功。",
    importFailed: "导入失败。",
    transferCopied: "迁移码已复制。",
    transferCopyFailed: "复制失败，请手动选择并复制迁移码。",
    transferImportSuccess: "导入成功。当前设备已更新为迁移码中的数据。",
    transferImportFailed: "迁移码无效，无法导入。",
    emptyPayload: "没有可发送内容。",
    missingTokenCopied: "未填写 Bot Token，内容已复制。",
    sending: "发送中…",
    sendingButton: "发送中...",
    sentCount: "{sent} / {total} 已发送",
    sendSuccess: "发送成功",
    sendFailed: "发送失败",
    failedCount: "{failed} / {total} 发送失败 · 点击重试",
    sendComplete: "发送完成：成功 {ok}，失败 {failed}",
    copied: "内容已复制。",
    payloadIncome: "收入",
    payloadExpense: "支出",
    empty: "空",
    imageDate: "日期：{date}",
    imageOk: "成功",
    imageFailed: "失败",
    imageName: "姓名",
    imageAmount: "金额",
    imageTotal: "合计",
    imageIncome: "收入：{value}",
    imageExpense: "支出：{value}",
    imageDiff: "差额：{value}",
    saveImageFailed: "保存图片失败。"
  },
  English: {
    documentTitle: "Reconcile",
    live: "Live",
    subtitle: "Side-by-side income and expense tracking",
    saveReport: "Save Image",
    settings: "Settings",
    sendTelegram: "Send Telegram",
    autoSaveLabel: "Auto-save",
    saved: "Saved",
    saving: "Saving…",
    saveFailed: "Save failed",
    summaryIncome: "Income",
    summaryExpense: "Expense",
    summaryDiff: "Difference",
    incomeTable: "Income",
    expenseTable: "Expense",
    addIncome: "Add income",
    addExpense: "Add expense",
    incomeTotal: "Income total",
    expenseTotal: "Expense total",
    telegramTitle: "Send to Telegram",
    telegramHint: "Choose a recipient or send to all",
    telegramUser: "Recipient",
    tokenPlaceholder: "Enter Bot Token. Do not hardcode it.",
    sendSelected: "Send to selected",
    sendSelectedSub: "Only this recipient",
    sendAll: "Send to all",
    sendAllCount: "Send to all ({count})",
    sendAllSub: "{count} recipients",
    copyContent: "Copy content",
    copyContentSub: "Copy message to clipboard",
    telegramNote: "Tip: Telegram users must start your Bot first, otherwise the Bot API cannot message them directly.",
    appNote: "Income and expense are separate tables, so row counts can differ. Amount fields keep the original expression and recalculate live every 2 seconds. Totals show calculated results only. Supported: 100+20, 500-75, 12*3, 1000/4, 100×3, 1000÷4. Trailing equals signs, spaces, and multi-line input are safe.",
    designTitle: "Design Notes",
    design1Title: "Separate tables",
    design1Text: "Income and expense stay independent",
    design2Title: "Wide amount field",
    design2Text: "Supports multi-line formulas",
    design3Title: "Live status",
    design3Text: "Valid / typing / error feedback",
    design4Title: "Compact layout",
    design4Text: "Tuned for iPhone PWA use",
    exprTitle: "Amount details",
    save: "Save",
    settingsSubtitle: "Preferences, data, and device transfer",
    appearance: "Appearance",
    themeMode: "Theme",
    themeModeSub: "Switch between light and dark",
    light: "Light",
    dark: "Dark",
    compactMode: "Compact mode",
    compactModeSub: "Show more on small screens",
    localization: "Localization",
    language: "Language",
    languageSub: "Tap the top button to switch",
    totalCurrency: "Total currency",
    totalCurrencySub: "Used only for table totals",
    data: "Data",
    importData: "Import data",
    importDataSub: "Import from a JSON backup",
    exportData: "Export data",
    exportDataSub: "Download a JSON backup",
    transferDevice: "Transfer to new device",
    transferDeviceSub: "Copy or import a migration code",
    autoSaveSub: "Save local changes automatically",
    about: "About",
    version: "Version",
    versionSub: "Local PWA app",
    checkUpdate: "Check for update",
    checkUpdateSub: "Confirm this app is current",
    advanced: "Advanced",
    resetData: "Reset local data",
    resetDataSub: "Clear local data on this device",
    transferTitle: "Transfer to new device",
    transferSubtitle: "Move this device data with a migration code",
    oldDevice: "Old device: create code",
    oldDeviceSub: "Copy this code and paste it on the new device.",
    copyTransfer: "Copy code",
    newDevice: "New device: import code",
    newDeviceSub: "Paste the code from the old device, then import.",
    transferPlaceholder: "Paste migration code",
    importTransfer: "Import to this device",
    transferStatusDefault: "The migration code includes bills and preferences. Share it only with devices you trust.",
    broadcastTitle: "Send to all recipients",
    broadcastText: "This will send the message to {count} Telegram recipients. This action cannot be undone.",
    cancel: "Cancel",
    confirmSend: "Send now",
    deleteRow: "Delete row",
    undo: "Undo",
    reminderUnsavedTitle: "Not saved yet",
    reminderUnsavedSub: "Save as image to avoid losing your data.",
    reminderSavedTitle: "Saved",
    reminderSavedSub: "Last saved at {time}",
    reminderModifiedTitle: "Changes detected",
    reminderModifiedSub: "Save again to keep your data safe.",
    reminderSaveAction: "Save Image",
    reminderViewAction: "View Image",
    reminderDismiss: "Dismiss reminder",
    amountError: "Amount error",
    typing: "Typing",
    valid: "Valid",
    waitInput: "Waiting",
    amountInput: "amount field",
    clearAmount: "Clear amount",
    incomeAmountDetail: "Income amount details",
    expenseAmountDetail: "Expense amount details",
    rowDeleted: "Row deleted",
    resetPlaceholder: "Reset local data is a placeholder",
    versionCurrent: "You are up to date",
    importSuccess: "Import complete.",
    importFailed: "Import failed.",
    transferCopied: "Migration code copied.",
    transferCopyFailed: "Copy failed. Select and copy the code manually.",
    transferImportSuccess: "Import complete. This device now uses the migrated data.",
    transferImportFailed: "Invalid migration code.",
    emptyPayload: "There is nothing to send.",
    missingTokenCopied: "Bot Token is empty. Message copied instead.",
    sending: "Sending…",
    sendingButton: "Sending...",
    sentCount: "{sent} / {total} sent",
    sendSuccess: "Sent",
    sendFailed: "Failed",
    failedCount: "{failed} / {total} failed · tap to retry",
    sendComplete: "Done: {ok} sent, {failed} failed",
    copied: "Content copied.",
    payloadIncome: "Income",
    payloadExpense: "Expense",
    empty: "Empty",
    imageDate: "Date: {date}",
    imageOk: "Done",
    imageFailed: "Review",
    imageName: "Name",
    imageAmount: "Amount",
    imageTotal: "Total",
    imageIncome: "Income: {value}",
    imageExpense: "Expense: {value}",
    imageDiff: "Diff: {value}",
    saveImageFailed: "Could not save image."
  }
};

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function entry(name = "", expr = "") {
  const result = calculateExpression(expr, null);
  return {
    id: newId(),
    name,
    expr,
    amount: result.state === "ok" ? result.value : 0,
    state: result.state,
    valid: result.state !== "error",
    error: result.error
  };
}

function defaultState() {
  return {
    title: "收支核对",
    compact: false,
    fontScale: 100,
    labels: {
      incomeName: "名",
      incomeMoney: "金额",
      incomeTotal: "合计",
      expenseName: "名",
      expenseMoney: "金额",
      expenseTotal: "合计"
    },
    incomeRows: [
      entry("微信", "100+20"),
      entry("现金", "250"),
      entry("客户A", "450"),
      entry("", "")
    ],
    expenseRows: [
      entry("支付宝", "120"),
      entry("银行卡", "250"),
      entry("供应商", "450"),
      entry("", "")
    ]
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE);
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function dbSet(store, key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeEntry(input) {
  const normalized = {
    id: input?.id || newId(),
    name: input?.name ?? "",
    expr: input?.expr ?? "",
    amount: Number.isFinite(Number(input?.amount)) ? Number(input.amount) : 0,
    state: input?.state || (input?.valid === false ? "error" : "ok"),
    valid: input?.valid !== false,
    error: input?.error ?? ""
  };

  updateEntryCalculation(normalized, false);
  return normalized;
}

function migrateLegacyRows(input) {
  if (!Array.isArray(input?.rows)) return null;

  return {
    incomeRows: input.rows.map((row) => normalizeEntry({
      id: `${row.id || newId()}-income`,
      name: row.incomeName ?? "",
      expr: row.incomeExpr ?? row.incomeAmount ?? "",
      amount: row.incomeAmount,
      state: row.incomeState,
      valid: row.incomeValid,
      error: row.incomeError
    })),
    expenseRows: input.rows.map((row) => normalizeEntry({
      id: `${row.id || newId()}-expense`,
      name: row.expenseName ?? "",
      expr: row.expenseExpr ?? row.expenseAmount ?? "",
      amount: row.expenseAmount,
      state: row.expenseState,
      valid: row.expenseValid,
      error: row.expenseError
    }))
  };
}

function normalizeState(input) {
  const base = defaultState();
  const migrated = migrateLegacyRows(input);

  return {
    title: input?.title || input?.appTitle || base.title,
    compact: Boolean(input?.compact),
    fontScale: Number(input?.fontScale || 100),
    labels: { ...base.labels, ...(input?.labels || {}) },
    incomeRows: Array.isArray(input?.incomeRows)
      ? input.incomeRows.map(normalizeEntry)
      : migrated?.incomeRows || base.incomeRows,
    expenseRows: Array.isArray(input?.expenseRows)
      ? input.expenseRows.map(normalizeEntry)
      : migrated?.expenseRows || base.expenseRows
  };
}

async function loadState() {
  try {
    db = await openDB();
    const saved = await dbGet(STATE_STORE, STATE_KEY);
    if (saved) return normalizeState(saved);
  } catch (error) {
    console.warn("IndexedDB 不可用。", error);
  }

  try {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local) return normalizeState(JSON.parse(local));
  } catch (error) {
    console.warn("localStorage 读取失败。", error);
  }

  return defaultState();
}

function persistSoon() {
  el.saveState.textContent = text("saving");
  el.saveState.style.color = "#ca8a04";

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      await dbSet(STATE_STORE, STATE_KEY, state);
      el.saveState.textContent = text("saved");
      el.saveState.style.color = "#16a34a";
      updateTelegramPreview();
    } catch (error) {
      el.saveState.textContent = text("saveFailed");
      el.saveState.style.color = "#dc2626";
    }
  }, 120);
}

function loadUiPrefs() {
  try {
    return {
      language: "中文",
      theme: "light",
      currency: "Rp",
      autoSave: true,
      ...(JSON.parse(localStorage.getItem(UI_PREFS_KEY) || "{}"))
    };
  } catch (error) {
    return { language: "中文", theme: "light", currency: "Rp", autoSave: true };
  }
}

function currentLanguage() {
  return loadUiPrefs().language === "English" ? "English" : "中文";
}

function text(key, params = {}, language = currentLanguage()) {
  const template = UI_TEXT[language]?.[key] ?? UI_TEXT["中文"][key] ?? key;
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  );
}

function setText(selector, key, params = {}) {
  const node = typeof selector === "string" ? qs(selector) : selector;
  if (node) node.textContent = text(key, params);
}

function labelFor(key, value) {
  const language = currentLanguage();
  const zh = DEFAULT_LABELS["中文"][key];
  const en = DEFAULT_LABELS.English[key];
  const aliases = DEFAULT_LABEL_ALIASES[key] || [];
  return value === zh || value === en || aliases.includes(value) ? DEFAULT_LABELS[language][key] : value;
}

function defaultLabel(key) {
  return DEFAULT_LABELS[currentLanguage()][key] || DEFAULT_LABELS["中文"][key];
}

function saveUiPrefs(next) {
  const prefs = { ...loadUiPrefs(), ...next };
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  applyUiPrefs(prefs);
}

function updateStaticCopy() {
  const language = currentLanguage();
  document.documentElement.lang = language === "English" ? "en" : "zh-CN";
  document.title = text("documentTitle");

  setText(".live-badge", "live");
  const liveDot = document.createElement("span");
  qs(".live-badge")?.prepend(liveDot);
  setText(".topbar-copy > p", "subtitle");
  setText("#saveImageBtn span", "saveReport");
  setText("#settingsBtn span", "settings");
  setText("#dailyTelegramCta", "sendTelegram");
  setText(".save-state span", "autoSaveLabel");
  setText(".balance-card div:nth-child(1) span", "summaryIncome");
  setText(".balance-card div:nth-child(2) span", "summaryExpense");
  setText("#diffBox span", "summaryDiff");
  setText(".income-card .ledger-title strong", "incomeTable");
  setText(".expense-card .ledger-title strong", "expenseTable");
  qs(".income-card .ledger-title strong")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/fire.svg", alt: "" }));
  qs(".expense-card .ledger-title strong")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/snowflake.svg", alt: "" }));
  setText("#addIncomeBtn", "addIncome");
  setText("#addExpenseBtn", "addExpense");
  qs("#addIncomeBtn")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/plus.svg", alt: "" }));
  qs("#addExpenseBtn")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/plus.svg", alt: "" }));
  setText(".income-card .ledger-total span", "incomeTotal");
  setText(".expense-card .ledger-total span", "expenseTotal");
  setText(".telegram-card .section-title strong", "telegramTitle");
  qs(".telegram-card .section-title strong")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/telegram.svg", alt: "" }));
  setText(".telegram-card .section-title span", "telegramHint");
  setText(".telegram-grid label:nth-child(1) span", "telegramUser");
  if (el.telegramToken) el.telegramToken.placeholder = text("tokenPlaceholder");
  setText("#sendSelectedBtn .btn-copy strong", "sendSelected");
  setText("#sendSelectedBtn .btn-copy small", "sendSelectedSub");
  setText("#copyPayloadBtn .btn-copy strong", "copyContent");
  setText("#copyPayloadBtn .btn-copy small", "copyContentSub");
  setText("#telegramStatus", "telegramNote");
  setText(".note", "appNote");
  setText(".design-panel h2", "designTitle");
  setText(".design-panel li:nth-child(1) strong", "design1Title");
  setText(".design-panel li:nth-child(1) span", "design1Text");
  setText(".design-panel li:nth-child(2) strong", "design2Title");
  setText(".design-panel li:nth-child(2) span", "design2Text");
  setText(".design-panel li:nth-child(3) strong", "design3Title");
  setText(".design-panel li:nth-child(3) span", "design3Text");
  setText(".design-panel li:nth-child(4) strong", "design4Title");
  setText(".design-panel li:nth-child(4) span", "design4Text");
  setText("#saveExprDialog", "save");

  setText(".settings-header-v2 h3", "settings");
  setText(".settings-header-v2 p", "settingsSubtitle");
  setText(".settings-section:nth-of-type(1) h4", "appearance");
  setText(".settings-section:nth-of-type(1) .settings-item:nth-child(1) strong", "themeMode");
  setText(".settings-section:nth-of-type(1) .settings-item:nth-child(1) small", "themeModeSub");
  setText('[data-setting="theme"][data-value="light"]', "light");
  setText('[data-setting="theme"][data-value="dark"]', "dark");
  setText(".settings-section:nth-of-type(1) .settings-item:nth-child(2) strong", "compactMode");
  setText(".settings-section:nth-of-type(1) .settings-item:nth-child(2) small", "compactModeSub");
  setText(".settings-section:nth-of-type(2) h4", "localization");
  setText(".settings-section:nth-of-type(2) .settings-item:nth-child(1) strong", "language");
  setText(".settings-section:nth-of-type(2) .settings-item:nth-child(1) small", "languageSub");
  setText(".settings-section:nth-of-type(2) .settings-item:nth-child(2) strong", "totalCurrency");
  setText(".settings-section:nth-of-type(2) .settings-item:nth-child(2) small", "totalCurrencySub");
  setText(".settings-section:nth-of-type(3) h4", "data");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(1) strong", "importData");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(1) small", "importDataSub");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(2) strong", "exportData");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(2) small", "exportDataSub");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(3) strong", "transferDevice");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(3) small", "transferDeviceSub");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(4) strong", "autoSaveLabel");
  setText(".settings-section:nth-of-type(3) .settings-action:nth-child(4) small", "autoSaveSub");
  setText(".settings-section:nth-of-type(4) h4", "about");
  setText(".settings-section:nth-of-type(4) .settings-action:nth-child(1) strong", "version");
  setText(".settings-section:nth-of-type(4) .settings-action:nth-child(1) small", "versionSub");
  setText(".settings-section:nth-of-type(4) .settings-action:nth-child(2) strong", "checkUpdate");
  setText(".settings-section:nth-of-type(4) .settings-action:nth-child(2) small", "checkUpdateSub");
  setText(".settings-section:nth-of-type(5) h4", "advanced");
  setText(".settings-section:nth-of-type(5) .settings-action strong", "resetData");
  setText(".settings-section:nth-of-type(5) .settings-action small", "resetDataSub");

  setText(".transfer-panel h3", "transferTitle");
  setText(".transfer-panel header p", "transferSubtitle");
  setText(".transfer-box:nth-child(1) strong", "oldDevice");
  setText(".transfer-box:nth-child(1) p", "oldDeviceSub");
  setText("#copyTransferCodeBtn", "copyTransfer");
  qs("#copyTransferCodeBtn")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/copy.svg", alt: "" }));
  setText(".transfer-box:nth-child(2) strong", "newDevice");
  setText(".transfer-box:nth-child(2) p", "newDeviceSub");
  if (el.transferCodeInput) el.transferCodeInput.placeholder = text("transferPlaceholder");
  setText("#importTransferCodeBtn", "importTransfer");
  qs("#importTransferCodeBtn")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/upload.svg", alt: "" }));
  if (el.transferStatus && !el.transferStatus.classList.contains("success") && !el.transferStatus.classList.contains("error")) {
    el.transferStatus.textContent = text("transferStatusDefault");
  }

  setText(".confirm-card header strong", "broadcastTitle");
  setText("#cancelBroadcastBtn", "cancel");
  setText("#confirmBroadcastBtn", "confirmSend");
  qs("#confirmBroadcastBtn")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/send.svg", alt: "" }));
  setText("#deleteRowFromPopover", "deleteRow");
  qs("#deleteRowFromPopover")?.prepend(Object.assign(document.createElement("img"), { src: "assets/icons/trash.svg", alt: "" }));
  setText("#undoSnackbarBtn", "undo");

  updateBroadcastButtonLabel();
  updateDailyStatus();
}

function reportStatusDate() {
  return new Date().toISOString().slice(0, 10);
}

function reportSignature() {
  return JSON.stringify({
    title: state.title,
    labels: state.labels,
    incomeRows: state.incomeRows.map((item) => ({
      name: item.name,
      expr: item.expr,
      amount: item.amount,
      state: item.state
    })),
    expenseRows: state.expenseRows.map((item) => ({
      name: item.name,
      expr: item.expr,
      amount: item.amount,
      state: item.state
    })),
    totals: totals()
  });
}

function loadReportStatus() {
  try {
    return {
      date: reportStatusDate(),
      savedSignature: "",
      telegramSignature: "",
      savedAt: "",
      ...(JSON.parse(localStorage.getItem(REPORT_STATUS_KEY) || "{}"))
    };
  } catch (error) {
    return { date: reportStatusDate(), savedSignature: "", telegramSignature: "", savedAt: "" };
  }
}

function saveReportStatus(next) {
  const payload = { ...loadReportStatus(), date: reportStatusDate(), ...next };
  localStorage.setItem(REPORT_STATUS_KEY, JSON.stringify(payload));
  updateDailyStatus();
}

function formatReminderTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString(currentLanguage() === "English" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateDailyStatus() {
  if (!el.dailyStatus) return;

  const currentSignature = reportSignature();
  const status = loadReportStatus();
  const isToday = status.date === reportStatusDate();
  const imageSaved = isToday && status.savedSignature === currentSignature;
  const hasSavedToday = isToday && Boolean(status.savedSignature);
  let stateName = "unsaved";

  if (imageSaved) {
    stateName = "saved";
  } else if (hasSavedToday) {
    stateName = "modified";
  }

  const reminderKey = `${stateName}:${currentSignature}`;
  if (dismissedReminderKey === reminderKey) {
    el.dailyStatus.hidden = true;
    return;
  }

  el.dailyStatus.hidden = false;
  el.dailyStatus.className = `daily-status ${stateName}`;
  el.dailyStatus.dataset.state = stateName;

  if (stateName === "saved") {
    el.dailyStatusIcon.textContent = "✓";
    el.dailyStatusText.textContent = text("reminderSavedTitle");
    el.dailyStatusSub.textContent = text("reminderSavedSub", { time: formatReminderTime(status.savedAt) });
    el.dailyTelegramCta.textContent = text("reminderViewAction");
    el.dailyTelegramCta.dataset.icon = "▣";
  } else if (stateName === "modified") {
    el.dailyStatusIcon.textContent = "✎";
    el.dailyStatusText.textContent = text("reminderModifiedTitle");
    el.dailyStatusSub.textContent = text("reminderModifiedSub");
    el.dailyTelegramCta.textContent = text("reminderSaveAction");
    el.dailyTelegramCta.dataset.icon = "⇩";
  } else {
    el.dailyStatusIcon.textContent = "↥";
    el.dailyStatusText.textContent = text("reminderUnsavedTitle");
    el.dailyStatusSub.textContent = text("reminderUnsavedSub");
    el.dailyTelegramCta.textContent = text("reminderSaveAction");
    el.dailyTelegramCta.dataset.icon = "⇩";
  }

  if (el.dailyStatusDismiss) el.dailyStatusDismiss.setAttribute("aria-label", text("reminderDismiss"));
}

function applyUiPrefs(prefs = loadUiPrefs()) {
  const language = prefs.language === "English" ? "English" : "中文";
  if (el.languageButtonLabel) el.languageButtonLabel.textContent = language;
  if (el.settingsLanguageValue) el.settingsLanguageValue.textContent = language;
  if (el.settingsAutoSave) el.settingsAutoSave.checked = prefs.autoSave !== false;
  document.body.classList.toggle("theme-dark", prefs.theme === "dark");

  document.querySelectorAll("[data-setting]").forEach((button) => {
    button.classList.toggle("active", prefs[button.dataset.setting] === button.dataset.value);
  });

  updateStaticCopy();
}

function normalizeFullWidth(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/＋/g, "+")
    .replace(/－/g, "-")
    .replace(/[×ｘXx]/g, "*")
    .replace(/÷/g, "/")
    .replace(/，/g, ",")
    .replace(/。/g, ".")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/＝/g, "=");
}

function compactExpression(value) {
  return normalizeFullWidth(value)
    .replace(/\s+/g, "")
    .replace(/^=+/, "")
    .replace(/=+$/, "");
}

function cleanExpressionForPayload(value) {
  return normalizeFullWidth(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^=+/, "")
    .replace(/=+$/, "")
    .trim();
}

function normalizeNumberToken(token) {
  let value = String(token).trim();
  const comma = value.includes(",");
  const dot = value.includes(".");

  if (comma && dot) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (comma) {
    const parts = value.split(",");
    value = parts.length > 2 || (parts[1] && parts[1].length === 3)
      ? value.replace(/,/g, "")
      : value.replace(",", ".");
  } else if (dot) {
    const parts = value.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      value = value.replace(/\./g, "");
    }
  }

  return value;
}

function tokenizeExpression(expression) {
  const input = compactExpression(expression).replace(/[^\d+\-*/().,]/g, "");
  if (!input) return [];

  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    if (/\d|[.,]/.test(ch)) {
      let j = i;
      while (j < input.length && /[\d.,]/.test(input[j])) j++;
      tokens.push(normalizeNumberToken(input.slice(i, j)));
      i = j;
      continue;
    }

    return null;
  }

  return tokens;
}

function hasUnclosedParentheses(input) {
  let balance = 0;
  for (const ch of input) {
    if (ch === "(") balance++;
    if (ch === ")") balance--;
    if (balance < 0) return false;
  }
  return balance > 0;
}

function evaluateExpressionStrict(expression) {
  if (String(expression ?? "").trim() === "") return { ok: true, value: 0 };

  const tokens = tokenizeExpression(expression);
  if (!tokens || tokens.length === 0) return { ok: false, error: "无法计算" };

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function primary() {
    const token = peek();

    if (token === "+") {
      consume();
      return primary();
    }

    if (token === "-") {
      consume();
      return -primary();
    }

    if (token === "(") {
      consume();
      const value = expressionParser();
      if (peek() !== ")") return NaN;
      consume();
      return value;
    }

    consume();
    const number = Number(token);
    return Number.isFinite(number) ? number : NaN;
  }

  function term() {
    let value = primary();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = primary();

      if (!Number.isFinite(value) || !Number.isFinite(right)) return NaN;
      if (operator === "*") value *= right;
      if (operator === "/") {
        if (right === 0) return NaN;
        value /= right;
      }
    }

    return value;
  }

  function expressionParser() {
    let value = term();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = term();

      if (!Number.isFinite(value) || !Number.isFinite(right)) return NaN;
      if (operator === "+") value += right;
      if (operator === "-") value -= right;
    }

    return value;
  }

  const result = expressionParser();
  if (pos !== tokens.length || !Number.isFinite(result)) {
    return { ok: false, error: "无法计算" };
  }

  return { ok: true, value: result };
}

function canBeTypingExpression(expression) {
  const input = compactExpression(expression);
  if (!input) return false;

  if (/[+\-*/.]$/.test(input)) {
    const prefix = input.slice(0, -1);
    if (!prefix) return true;
    const prefixEval = evaluateExpressionStrict(prefix);
    return prefixEval.ok || hasUnclosedParentheses(prefix);
  }

  if (hasUnclosedParentheses(input)) return true;

  return false;
}

function calculateExpression(expression, previous) {
  if (String(expression ?? "").trim() === "") {
    return { ok: true, state: "ok", value: 0, error: "" };
  }

  const strict = evaluateExpressionStrict(expression);

  if (strict.ok) {
    return {
      ok: true,
      state: "ok",
      value: Number.isInteger(strict.value) ? strict.value : Number(strict.value.toFixed(2)),
      error: ""
    };
  }

  if (canBeTypingExpression(expression)) {
    return {
      ok: false,
      state: "typing",
      value: Number.isFinite(Number(previous)) ? Number(previous) : 0,
      error: "输入中"
    };
  }

  return {
    ok: false,
    state: "error",
    value: Number.isFinite(Number(previous)) ? Number(previous) : 0,
    error: strict.error || "无法计算"
  };
}

function updateEntryCalculation(entryData, keepPrevious = true) {
  const result = calculateExpression(entryData.expr, entryData.amount);

  entryData.state = result.state;
  entryData.valid = result.state !== "error";
  entryData.error = result.error;

  if (result.state === "ok" || !keepPrevious) {
    entryData.amount = result.value;
  }
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function formatMoney(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  const fixed = Number.isInteger(absolute) ? String(absolute) : absolute.toFixed(2);
  const [integer, decimal] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}${grouped}${decimal ? `.${decimal}` : ""}`;
}

function currencyPrefix() {
  const currency = loadUiPrefs().currency || "Rp";
  return currency === "USDT" ? "USDT" : currency;
}

function formatMoneyWithCurrency(value, { signed = false } = {}) {
  const number = Number(value || 0);
  const sign = signed && number > 0 ? "+" : "";
  return `${sign}${currencyPrefix()} ${formatMoney(number)}`;
}

function entryStatus(entryData) {
  if (entryData.state === "error") return { type: "bad", text: text("amountError") };
  if (entryData.state === "typing") return { type: "typing", text: text("typing") };
  if (!hasValue(entryData.name) && !hasValue(entryData.expr)) return { type: "wait", text: text("waitInput") };
  return { type: "ok", text: text("valid") };
}

function inlineStatus(entryData) {
  if (entryData.state === "error") return text("amountError");
  if (entryData.state === "typing") return text("typing");
  if (!hasValue(entryData.expr)) return text("typing");
  return text("valid");
}

function totals() {
  const income = state.incomeRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = state.expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const hasError = [...state.incomeRows, ...state.expenseRows].some((item) => item.state === "error");
  const hasTyping = [...state.incomeRows, ...state.expenseRows].some((item) => item.state === "typing");

  return { income, expense, diff: income - expense, hasError, hasTyping };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function moneyEditor(side, index, value) {
  const entryData = state[`${side}Rows`][index];
  const stateValue = entryData.state || "ok";

  return `
    <div class="money-wrap ${stateValue}">
      <textarea class="money-editor money-input" inputmode="decimal" spellcheck="false"
        data-side="${side}"
        data-index="${index}"
        placeholder="100+20"
        onfocus="setActiveMoneyInput(this)"
        oninput="adjustTextareaHeight(this); updateEntry('${side}', ${index}, 'expr', this.value)"
        onkeyup="adjustTextareaHeight(this); updateEntry('${side}', ${index}, 'expr', this.value)"
        onchange="updateEntry('${side}', ${index}, 'expr', this.value)"
        onpaste="setTimeout(() => { adjustTextareaHeight(this); updateEntry('${side}', ${index}, 'expr', this.value); }, 0)"
        onblur="updateEntry('${side}', ${index}, 'expr', this.value)">${escapeHtml(value)}</textarea>
      <span class="inline-status" data-inline-status="${side}-${index}">${inlineStatus(entryData)}</span>
      <button class="amount-action-btn" type="button" data-side="${side}" data-index="${index}" onclick="clearAmountCell('${side}', ${index})" title="${text("clearAmount")}" aria-label="${text("clearAmount")}">
        <img src="assets/icons/broom.svg" alt="" />
      </button>
    </div>
  `;
}

function amountBox(side, index) {
  const entryData = state[`${side}Rows`][index];
  const stateValue = entryData.state || "ok";
  const amountText = stateValue === "typing" ? text("typing") : formatMoney(entryData.amount);

  return `
    <div class="amount-box ${stateValue === "error" ? "error" : stateValue === "typing" ? "typing" : ""}"
      data-amount="${side}-${index}"
      title="${escapeHtml(entryData.error || "")}">
      ${amountText}
    </div>
  `;
}

function renderLedger(side) {
  const rows = state[`${side}Rows`];
  const container = side === "income" ? el.incomeRows : el.expenseRows;

  container.innerHTML = rows.map((item, index) => {
    const status = entryStatus(item);

    return `
      <article class="entry-wrap ${status.type}" data-row="${side}-${index}">
        <div class="ledger-row">
          <div class="cell index-cell"><span class="row-index">${index + 1}</span></div>
          <div class="cell">
            <input value="${escapeHtml(item.name)}" placeholder="${escapeHtml(defaultLabel(`${side}Name`))}" lang="${currentLanguage() === "English" ? "en" : "zh-CN"}" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"
              oninput="updateEntry('${side}', ${index}, 'name', this.value)" />
          </div>
          <div class="cell">${moneyEditor(side, index, item.expr)}</div>
          <div class="cell">${amountBox(side, index)}</div>
        </div>
        <div class="row-meta">
          <span class="pill ${status.type}" data-status="${side}-${index}">${escapeHtml(status.text)}</span>
        </div>
      </article>
    `;
  }).join("");

  requestAnimationFrame(() => adjustAllTextareas());
}

function refreshEntryVisual(side, index) {
  const item = state[`${side}Rows`][index];
  if (!item) return;

  const status = entryStatus(item);
  const rowNode = document.querySelector(`[data-row="${side}-${index}"]`);
  if (rowNode) rowNode.className = `entry-wrap ${status.type}`;

  document.querySelectorAll(`[data-status="${side}-${index}"]`).forEach((node) => {
    node.className = `pill ${status.type}`;
    node.textContent = status.text;
  });

  document.querySelectorAll(`[data-amount="${side}-${index}"]`).forEach((node) => {
    node.className = `amount-box ${item.state === "error" ? "error" : item.state === "typing" ? "typing" : ""}`;
    node.textContent = item.state === "typing" ? text("typing") : formatMoney(item.amount);
    node.title = item.error || "";
  });

  document.querySelectorAll(`textarea[data-side="${side}"][data-index="${index}"]`).forEach((area) => {
    const wrap = area.closest(".money-wrap");
    if (wrap) wrap.className = `money-wrap ${item.state || "ok"}`;
    adjustTextareaHeight(area);
  });

  document.querySelectorAll(`[data-inline-status="${side}-${index}"]`).forEach((node) => {
    node.textContent = inlineStatus(item);
  });
}

function renderTotals() {
  const total = totals();
  const allEmpty =
    state.incomeRows.every((item) => !hasValue(item.name) && !hasValue(item.expr)) &&
    state.expenseRows.every((item) => !hasValue(item.name) && !hasValue(item.expr));

  el.incomeSectionTotal.textContent = formatMoneyWithCurrency(total.income);
  el.expenseSectionTotal.textContent = formatMoneyWithCurrency(total.expense);
  el.totalIncome.textContent = formatMoney(total.income);
  el.totalExpense.textContent = formatMoney(total.expense);
  el.difference.textContent = formatMoney(total.diff);

  let cls = "ok";

  if (total.hasError) {
    cls = "bad";
  } else if (total.hasTyping) {
    cls = "wait";
  } else if (allEmpty) {
    cls = "wait";
  } else if (total.diff !== 0) {
    cls = "bad";
  }

  el.diffBox.className = total.diff > 0 ? "positive" : total.diff < 0 ? "negative" : cls;
  updateDailyStatus();
}

function render() {
  document.documentElement.style.setProperty("--scale", state.fontScale / 100);
  document.body.classList.toggle("compact", state.compact);

  el.appTitle.textContent = labelFor("appTitle", state.title);
  el.incomeNameLabel.textContent = labelFor("incomeName", state.labels.incomeName);
  el.incomeMoneyLabel.textContent = labelFor("incomeMoney", state.labels.incomeMoney);
  el.incomeTotalLabel.textContent = labelFor("incomeTotal", state.labels.incomeTotal);
  el.expenseNameLabel.textContent = labelFor("expenseName", state.labels.expenseName);
  el.expenseMoneyLabel.textContent = labelFor("expenseMoney", state.labels.expenseMoney);
  el.expenseTotalLabel.textContent = labelFor("expenseTotal", state.labels.expenseTotal);
  if (el.fontScale) el.fontScale.value = state.fontScale;
  if (el.settingsCompact) el.settingsCompact.checked = state.compact;

  renderLedger("income");
  renderLedger("expense");
  renderTotals();
  updateTelegramPreview();
  updateBroadcastButtonLabel();
}

window.updateEntry = function(side, index, field, value) {
  const item = state[`${side}Rows`][index];
  if (!item) return;

  item[field] = value;

  if (field === "expr") {
    updateEntryCalculation(item, true);
    refreshEntryVisual(side, index);
  }

  persistSoon();
  renderTotals();
  updateTelegramPreview();
  scheduleLiveRecalc();
};

function syncMoneyInputsFromDom() {
  document.querySelectorAll(".money-editor[data-side][data-index]").forEach((node) => {
    const side = node.dataset.side;
    const index = Number(node.dataset.index);
    const item = state[`${side}Rows`]?.[index];
    if (!item) return;

    if (item.expr !== node.value) item.expr = node.value;
    updateEntryCalculation(item, true);
  });
}

function recalculateEverything({ pulse = false } = {}) {
  syncMoneyInputsFromDom();

  ["income", "expense"].forEach((side) => {
    state[`${side}Rows`].forEach((item, index) => {
      updateEntryCalculation(item, true);
      refreshEntryVisual(side, index);
    });
  });

  renderTotals();
  updateTelegramPreview();
  persistSoon();

  if (pulse) {
    document.querySelectorAll(".amount-box").forEach((node) => {
      node.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
        { duration: 260, easing: "ease" }
      );
    });
  }
}

let liveRecalcTimer = null;
function scheduleLiveRecalc() {
  clearTimeout(liveRecalcTimer);
  liveRecalcTimer = setTimeout(() => {
    recalculateEverything({ pulse: true });
  }, 2000);
}

function setActiveMoneyInput(input) {
  activeMoneyInput = input;
  adjustTextareaHeight(input);
}
window.setActiveMoneyInput = setActiveMoneyInput;

function adjustTextareaHeight(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(36, textarea.scrollHeight)}px`;
}
window.adjustTextareaHeight = adjustTextareaHeight;

function adjustAllTextareas() {
  document.querySelectorAll(".money-editor").forEach((textarea) => adjustTextareaHeight(textarea));
}

function insertToActiveMoneyInput(text) {
  if (!activeMoneyInput) {
    alert(currentLanguage() === "English" ? `Tap an ${text("amountInput")} first.` : "请先点击金额输入框。");
    return;
  }

  activeMoneyInput.focus();

  const start = activeMoneyInput.selectionStart ?? activeMoneyInput.value.length;
  const end = activeMoneyInput.selectionEnd ?? activeMoneyInput.value.length;
  const value = activeMoneyInput.value;

  activeMoneyInput.value = value.slice(0, start) + text + value.slice(end);

  const next = start + text.length;
  activeMoneyInput.selectionStart = next;
  activeMoneyInput.selectionEnd = next;

  activeMoneyInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function backspaceActiveMoneyInput() {
  if (!activeMoneyInput) {
    alert(currentLanguage() === "English" ? `Tap an ${text("amountInput")} first.` : "请先点击金额输入框。");
    return;
  }

  activeMoneyInput.focus();

  let start = activeMoneyInput.selectionStart ?? activeMoneyInput.value.length;
  let end = activeMoneyInput.selectionEnd ?? activeMoneyInput.value.length;
  const value = activeMoneyInput.value;

  if (start === end && start > 0) {
    activeMoneyInput.value = value.slice(0, start - 1) + value.slice(end);
    start -= 1;
  } else {
    activeMoneyInput.value = value.slice(0, start) + value.slice(end);
  }

  activeMoneyInput.selectionStart = start;
  activeMoneyInput.selectionEnd = start;

  activeMoneyInput.dispatchEvent(new Event("input", { bubbles: true }));
}

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest && event.target.closest("#calcToolbar button");
  if (!button) return;

  event.preventDefault();

  if (button.dataset.op) {
    insertToActiveMoneyInput(button.dataset.op);
    return;
  }

  if (button.id === "calcBackspace") backspaceActiveMoneyInput();
});

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest && event.target.closest(".amount-action-btn");
  if (!button) {
    if (!event.target.closest?.("#amountActionPopover")) hideActionPopover();
    return;
  }

  clearTimeout(amountActionPressTimer);
  suppressNextAmountClear = false;
  amountActionPressTimer = setTimeout(() => {
    suppressNextAmountClear = true;
    showActionPopover(button);
  }, 500);
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    clearTimeout(amountActionPressTimer);
  }, true);
});

el.deleteRowFromPopover.addEventListener("click", () => {
  if (!popoverTarget) return;
  const { side, index } = popoverTarget;
  hideActionPopover();
  deleteEntryWithUndo(side, index);
});

el.undoSnackbarBtn.addEventListener("click", () => {
  if (!undoDeletePayload) return;
  const { onUndo } = undoDeletePayload;
  clearTimeout(undoSnackbarTimer);
  el.undoSnackbar.hidden = true;
  undoDeletePayload = null;
  onUndo();
});

["input", "change", "keyup", "paste", "blur", "compositionend"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (event.target?.classList?.contains("money-editor")) scheduleLiveRecalc();
  }, true);
});

window.openExprDialog = function(side, index) {
  dialogTarget = { side, index };
  const item = state[`${side}Rows`][index];
  if (!item) return;

  el.exprDialogTitle.textContent = side === "income" ? text("incomeAmountDetail") : text("expenseAmountDetail");
  el.exprDialogText.value = item.expr || "";
  el.exprDialog.showModal();

  setTimeout(() => el.exprDialogText.focus(), 50);
};

$("closeExprDialog").addEventListener("click", () => {
  el.exprDialog.close();
});

$("saveExprDialog").addEventListener("click", () => {
  if (!dialogTarget) return;

  const { side, index } = dialogTarget;
  const item = state[`${side}Rows`][index];
  if (!item) return;

  item.expr = el.exprDialogText.value;
  updateEntryCalculation(item, true);

  persistSoon();
  render();
  el.exprDialog.close();
});

window.clearAmountCell = function(side, index) {
  if (suppressNextAmountClear) {
    suppressNextAmountClear = false;
    return;
  }

  const item = state[`${side}Rows`][index];
  if (!item) return;

  item.expr = "";
  updateEntryCalculation(item, true);
  persistSoon();
  render();
};

function hideActionPopover() {
  if (!el.amountActionPopover) return;
  el.amountActionPopover.hidden = true;
  popoverTarget = null;
}

function showActionPopover(button) {
  const side = button.dataset.side;
  const index = Number(button.dataset.index);
  if (!side || !Number.isFinite(index)) return;

  popoverTarget = { side, index };
  const rect = button.getBoundingClientRect();
  el.amountActionPopover.hidden = false;
  el.amountActionPopover.style.left = `${Math.max(12, Math.min(window.innerWidth - 150, rect.right - 142))}px`;
  el.amountActionPopover.style.top = `${Math.max(12, rect.bottom + 8)}px`;
}

function showUndoSnackbar(message, onUndo) {
  clearTimeout(undoSnackbarTimer);
  undoDeletePayload = { onUndo };
  el.undoSnackbarText.textContent = message;
  el.undoSnackbar.hidden = false;
  undoSnackbarTimer = setTimeout(() => {
    el.undoSnackbar.hidden = true;
    undoDeletePayload = null;
  }, 5000);
}

function deleteEntryWithUndo(side, index) {
  const rows = state[`${side}Rows`];
  const removed = rows[index];
  if (!removed) return;

  const snapshot = JSON.parse(JSON.stringify(removed));
  rows.splice(index, 1);
  const insertedPlaceholder = rows.length === 0;
  if (insertedPlaceholder) rows.push(entry());

  persistSoon();
  render();
  showUndoSnackbar(text("rowDeleted"), () => {
    const currentRows = state[`${side}Rows`];
    if (insertedPlaceholder && currentRows.length === 1 && !hasValue(currentRows[0].name) && !hasValue(currentRows[0].expr)) {
      currentRows.splice(0, 1);
    }
    currentRows.splice(Math.min(index, currentRows.length), 0, normalizeEntry(snapshot));
    persistSoon();
    render();
  });
}

window.deleteEntry = deleteEntryWithUndo;

$("addIncomeBtn").addEventListener("click", () => {
  state.incomeRows.push(entry());
  persistSoon();
  render();
});

$("addExpenseBtn").addEventListener("click", () => {
  state.expenseRows.push(entry());
  persistSoon();
  render();
});

el.languageToggleBtn.addEventListener("click", () => {
  const current = loadUiPrefs().language === "English" ? "English" : "中文";
  saveUiPrefs({ language: current === "中文" ? "English" : "中文" });
});

el.settingsBtn.addEventListener("click", () => {
  applyUiPrefs();
  el.settingsDialog.showModal();
});

el.closeSettingsBtn.addEventListener("click", () => {
  el.settingsDialog.close();
});

document.querySelectorAll("[data-setting]").forEach((button) => {
  button.addEventListener("click", () => {
    saveUiPrefs({ [button.dataset.setting]: button.dataset.value });
    if (button.dataset.setting === "currency") {
      renderTotals();
      updateTelegramPreview();
    }
  });
});

el.settingsCompact.addEventListener("change", () => {
  state.compact = el.settingsCompact.checked;
  persistSoon();
  render();
});

el.settingsAutoSave.addEventListener("change", () => {
  saveUiPrefs({ autoSave: el.settingsAutoSave.checked });
});

el.resetLocalDataBtn.addEventListener("click", () => {
  el.undoSnackbarText.textContent = text("resetPlaceholder");
  el.undoSnackbar.hidden = false;
  clearTimeout(undoSnackbarTimer);
  undoSnackbarTimer = setTimeout(() => {
    el.undoSnackbar.hidden = true;
  }, 2400);
});

el.updateVersionBtn.addEventListener("click", () => {
  el.undoSnackbarText.textContent = text("versionCurrent");
  el.undoSnackbar.hidden = false;
  clearTimeout(undoSnackbarTimer);
  undoSnackbarTimer = setTimeout(() => {
    el.undoSnackbar.hidden = true;
  }, 2400);
});

if (el.fontScale) {
  el.fontScale.addEventListener("input", () => {
    state.fontScale = Number(el.fontScale.value);
    persistSoon();
    render();
  });
}

function bindEditable(element, callback) {
  element.addEventListener("blur", () => {
    callback(element.textContent.trim());
    persistSoon();
    render();
  });

  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  });
}

bindEditable(el.appTitle, (value) => state.title = value || defaultLabel("appTitle"));
bindEditable(el.incomeNameLabel, (value) => state.labels.incomeName = value || defaultLabel("incomeName"));
bindEditable(el.incomeMoneyLabel, (value) => state.labels.incomeMoney = value || defaultLabel("incomeMoney"));
bindEditable(el.incomeTotalLabel, (value) => state.labels.incomeTotal = value || defaultLabel("incomeTotal"));
bindEditable(el.expenseNameLabel, (value) => state.labels.expenseName = value || defaultLabel("expenseName"));
bindEditable(el.expenseMoneyLabel, (value) => state.labels.expenseMoney = value || defaultLabel("expenseMoney"));
bindEditable(el.expenseTotalLabel, (value) => state.labels.expenseTotal = value || defaultLabel("expenseTotal"));

$("backupBtn").addEventListener("click", () => {
  const payload = { exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `收支核对备份-${new Date().toISOString().slice(0, 10)}.json`);
});

$("importBackupInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    state = normalizeState(payload.state || payload);
    persistSoon();
    render();
    alert(text("importSuccess"));
  } catch (error) {
    alert(text("importFailed"));
  } finally {
    event.target.value = "";
  }
});

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || "").trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeTransferPayload() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
    uiPrefs: loadUiPrefs()
  };
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodeTransferPayload(code) {
  const payload = JSON.parse(new TextDecoder().decode(base64ToBytes(code)));
  const rawState = payload.state || payload;
  if (!Array.isArray(rawState?.incomeRows) && !Array.isArray(rawState?.rows)) {
    throw new Error("Invalid transfer payload");
  }
  return { rawState, uiPrefs: payload.uiPrefs || null };
}

function refreshTransferCode() {
  if (!el.transferCodeOutput) return;
  el.transferCodeOutput.value = encodeTransferPayload();
}

async function copyTextToClipboard(text, fallbackElement = null) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (!fallbackElement) throw new Error("Clipboard unavailable");
  fallbackElement.focus();
  fallbackElement.select();
  document.execCommand("copy");
}

el.transferDeviceBtn?.addEventListener("click", () => {
  refreshTransferCode();
  if (el.transferCodeInput) el.transferCodeInput.value = "";
  if (el.transferStatus) {
    el.transferStatus.textContent = text("transferStatusDefault");
    el.transferStatus.className = "transfer-status";
  }
  el.transferDialog?.showModal();
});

el.closeTransferDialog?.addEventListener("click", () => {
  el.transferDialog?.close();
});

el.copyTransferCodeBtn?.addEventListener("click", async () => {
  try {
    refreshTransferCode();
    await copyTextToClipboard(el.transferCodeOutput.value, el.transferCodeOutput);
    el.transferStatus.textContent = text("transferCopied");
    el.transferStatus.className = "transfer-status success";
  } catch (error) {
    el.transferStatus.textContent = text("transferCopyFailed");
    el.transferStatus.className = "transfer-status error";
  }
});

el.importTransferCodeBtn?.addEventListener("click", () => {
  try {
    const { rawState, uiPrefs } = decodeTransferPayload(el.transferCodeInput.value);
    state = normalizeState(rawState);
    if (uiPrefs && typeof uiPrefs === "object") {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...loadUiPrefs(), ...uiPrefs }));
    }
    persistSoon();
    applyUiPrefs();
    render();
    updateTelegramPreview();
    el.transferStatus.textContent = text("transferImportSuccess");
    el.transferStatus.className = "transfer-status success";
  } catch (error) {
    el.transferStatus.textContent = text("transferImportFailed");
    el.transferStatus.className = "transfer-status error";
  }
});

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function visibleEntries(side) {
  return state[`${side}Rows`].filter((item) => hasValue(item.name) || hasValue(item.expr));
}

function linePayload(item) {
  const safeName = htmlEscape(item.name || "-");
  const safeExpr = htmlEscape(cleanExpressionForPayload(item.expr) || "0");
  return `<b>${safeName}</b>\n<code>${safeExpr}=${formatMoney(item.amount)}</code>`;
}

function buildSidePayload(side) {
  const title = side === "income" ? text("payloadIncome") : text("payloadExpense");
  const entries = visibleEntries(side).map(linePayload).join("\n\n");
  return `<b>${title}</b>\n\n${entries || `<code>${text("empty")}</code>`}`;
}

function buildAllPayload() {
  return `${buildSidePayload("income")}\n\n${buildSidePayload("expense")}`;
}

function buildEntryPayload(side, index) {
  const title = side === "income" ? text("payloadIncome") : text("payloadExpense");
  const item = state[`${side}Rows`][index];
  return `<b>${title}</b>\n\n${linePayload(item)}`;
}

function previewTextFromHtml(html) {
  return String(html)
    .replaceAll("<b>", "")
    .replaceAll("</b>", "")
    .replaceAll("<code>", "`")
    .replaceAll("</code>", "`")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function updateTelegramPreview() {
  if (el.telegramPreview) el.telegramPreview.value = previewTextFromHtml(buildAllPayload());
}

function selectedTelegramUserIds() {
  return [el.telegramUser.value];
}

function allTelegramUserIds() {
  return TELEGRAM_USERS.map((user) => user.id);
}

function updateBroadcastButtonLabel() {
  const count = allTelegramUserIds().length;
  if (el.sendAllLabel) el.sendAllLabel.textContent = text("sendAllCount", { count });
  if (el.sendAllSubLabel) el.sendAllSubLabel.textContent = text("sendAllSub", { count });
  if (el.broadcastConfirmText) {
    el.broadcastConfirmText.textContent = text("broadcastText", { count });
  }
}

function setTelegramButtonState(button, stateName, detail = {}) {
  if (!button) return;
  const strong = button.querySelector(".btn-copy strong");
  const small = button.querySelector(".btn-copy small");
  const img = button.querySelector("img");

  button.classList.remove("is-loading", "is-success", "is-failed");
  button.disabled = stateName === "loading";

  if (stateName === "loading") {
    button.classList.add("is-loading");
    if (strong) strong.textContent = text("sendingButton");
    if (small) small.textContent = text("sentCount", { sent: detail.sent || 0, total: detail.total || 0 });
    if (img) img.src = "assets/icons/settings.svg";
    return;
  }

  if (stateName === "success") {
    button.classList.add("is-success");
    if (strong) strong.textContent = text("sendSuccess");
    if (small) small.textContent = text("sentCount", { sent: detail.sent || 0, total: detail.total || 0 });
    if (img) img.src = "assets/icons/check.svg";
    setTimeout(() => resetTelegramButtons(), 1800);
    return;
  }

  if (stateName === "failed") {
    button.classList.add("is-failed");
    if (strong) strong.textContent = text("sendFailed");
    if (small) small.textContent = text("failedCount", { failed: detail.failed || 0, total: detail.total || 0 });
    if (img) img.src = "assets/icons/x.svg";
    setTimeout(() => resetTelegramButtons(), 2600);
    return;
  }

  resetTelegramButtons();
}

function resetTelegramButtons() {
  if (el.sendSelectedBtn) {
    el.sendSelectedBtn.classList.remove("is-loading", "is-success", "is-failed");
    el.sendSelectedBtn.disabled = false;
    const img = el.sendSelectedBtn.querySelector("img");
    const strong = el.sendSelectedBtn.querySelector(".btn-copy strong");
    const small = el.sendSelectedBtn.querySelector(".btn-copy small");
    if (img) img.src = "assets/icons/send.svg";
    if (strong) strong.textContent = text("sendSelected");
    if (small) small.textContent = text("sendSelectedSub");
  }

  if (el.sendAllBtn) {
    el.sendAllBtn.classList.remove("is-loading", "is-success", "is-failed");
    el.sendAllBtn.disabled = false;
    const img = el.sendAllBtn.querySelector("img");
    if (img) img.src = "assets/icons/send.svg";
  }

  updateBroadcastButtonLabel();
}

async function sendTelegram(chatIds, htmlPayload, uiButton = null) {
  const token = el.telegramToken.value.trim();
  localStorage.setItem(TOKEN_KEY, token);

  if (!htmlPayload.trim()) {
    alert(text("emptyPayload"));
    return;
  }

  if (!token) {
    await navigator.clipboard.writeText(previewTextFromHtml(htmlPayload));
    el.telegramStatus.textContent = text("missingTokenCopied");
    return;
  }

  el.telegramStatus.textContent = text("sending");
  setTelegramButtonState(uiButton, "loading", { sent: 0, total: chatIds.length });

  let ok = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    try {
      const body = new URLSearchParams({
        chat_id: chatId,
        text: htmlPayload,
        parse_mode: "HTML",
        disable_web_page_preview: "true"
      });

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        body
      });

      const data = await res.json();
      if (data.ok) ok++;
      else failed++;
    } catch (error) {
      failed++;
    }

    setTelegramButtonState(uiButton, "loading", { sent: ok, total: chatIds.length });
  }

  el.telegramStatus.textContent = text("sendComplete", { ok, failed });
  setTelegramButtonState(
    uiButton,
    failed === 0 && ok > 0 ? "success" : "failed",
    { sent: ok, failed, total: chatIds.length }
  );

  if (ok > 0 && failed === 0 && htmlPayload === buildAllPayload()) {
    saveReportStatus({ telegramSignature: reportSignature() });
  } else {
    updateDailyStatus();
  }
}

window.sendEntry = function(side, index) {
  sendTelegram(selectedTelegramUserIds(), buildEntryPayload(side, index));
};

$("sendSelectedBtn").addEventListener("click", () => {
  sendTelegram(selectedTelegramUserIds(), buildAllPayload(), el.sendSelectedBtn);
});

$("sendAllBtn").addEventListener("click", () => {
  updateBroadcastButtonLabel();
  el.broadcastConfirmDialog.showModal();
});

el.closeBroadcastConfirm.addEventListener("click", () => {
  el.broadcastConfirmDialog.close();
});

el.cancelBroadcastBtn.addEventListener("click", () => {
  el.broadcastConfirmDialog.close();
});

el.confirmBroadcastBtn.addEventListener("click", () => {
  el.broadcastConfirmDialog.close();
  sendTelegram(allTelegramUserIds(), buildAllPayload(), el.sendAllBtn);
});

el.dailyTelegramCta.addEventListener("click", () => {
  if (el.dailyStatus?.dataset.state === "saved" && lastSavedImageUrl) {
    window.open(lastSavedImageUrl, "_blank", "noopener");
    return;
  }

  saveImageReport();
});

el.dailyStatusDismiss?.addEventListener("click", () => {
  dismissedReminderKey = `${el.dailyStatus?.dataset.state || "unsaved"}:${reportSignature()}`;
  if (el.dailyStatus) el.dailyStatus.hidden = true;
});

$("copyPayloadBtn").addEventListener("click", async () => {
  const text = previewTextFromHtml(buildAllPayload());
  await navigator.clipboard.writeText(text);
  el.telegramStatus.textContent = UI_TEXT[currentLanguage()].copied;
});

el.telegramToken.addEventListener("input", () => {
  localStorage.setItem(TOKEN_KEY, el.telegramToken.value.trim());
});

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function formatImageDate(date = new Date()) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).replace(/\//g, "-");
}

function saveImageReport() {
  const total = totals();
  const ok = !total.hasError && !total.hasTyping && total.diff === 0;
  const incomeRows = visibleEntries("income");
  const expenseRows = visibleEntries("expense");
  const rowH = 52;
  const width = 1080;
  const height = 285 + (incomeRows.length + expenseRows.length) * rowH + 170;
  const scale = Math.max(2, window.devicePixelRatio || 2);
  const imageDate = formatImageDate();

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  drawRoundRect(ctx, 36, 36, width - 72, height - 72, 28);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 44px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(state.title || "收支核对", 70, 100);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 20px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(text("imageDate", { date: imageDate }), 70, 130);

  ctx.fillStyle = ok ? "#16a34a" : "#dc2626";
  drawRoundRect(ctx, width - 200, 58, 130, 48, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(ok ? text("imageOk") : text("imageFailed"), width - 160, 90);

  let y = 170;
  const drawSection = (title, color, rows) => {
    ctx.fillStyle = color;
    drawRoundRect(ctx, 70, y, 940, 42, 14);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Microsoft YaHei, PingFang SC, Arial";
    ctx.fillText(title, 92, y + 29);
    y += 54;

    ctx.fillStyle = "#e2e8f0";
    drawRoundRect(ctx, 70, y, 940, 38, 12);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 19px Microsoft YaHei, PingFang SC, Arial";
    ctx.fillText(text("imageName"), 92, y + 26);
    ctx.fillText(text("imageAmount"), 230, y + 26);
    ctx.fillText(text("imageTotal"), 850, y + 26);
    y += 48;

    rows.forEach((item, index) => {
      ctx.fillStyle = index % 2 === 0 ? "#f8fafc" : "#ffffff";
      drawRoundRect(ctx, 70, y, 940, 42, 12);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 19px Microsoft YaHei, PingFang SC, Arial";
      ctx.fillText(item.name || "-", 92, y + 27);
      ctx.fillText(cleanExpressionForPayload(item.expr) || "0", 230, y + 27);

      ctx.textAlign = "right";
      ctx.fillText(formatMoney(item.amount), 970, y + 27);
      ctx.textAlign = "left";

      y += rowH;
    });

    y += 12;
  };

  drawSection(text("payloadIncome"), "#f97316", incomeRows);
  drawSection(text("payloadExpense"), "#0284c7", expenseRows);

  ctx.fillStyle = "#0f172a";
  drawRoundRect(ctx, 70, y, 940, 68, 18);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 25px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(text("imageIncome", { value: formatMoney(total.income) }), 100, y + 43);
  ctx.fillText(text("imageExpense", { value: formatMoney(total.expense) }), 390, y + 43);
  ctx.fillStyle = ok ? "#86efac" : "#fca5a5";
  ctx.fillText(text("imageDiff", { value: formatMoney(total.diff) }), 680, y + 43);

  canvas.toBlob(async (blob) => {
    if (!blob) return alert(text("saveImageFailed"));
    const filename = `收支核对-${new Date().toISOString().slice(0, 10)}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const savedSignature = reportSignature();
    const savedAt = new Date().toISOString();

    if (lastSavedImageUrl) URL.revokeObjectURL(lastSavedImageUrl);
    lastSavedImageUrl = URL.createObjectURL(blob);

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "收支核对" });
        saveReportStatus({ savedSignature, telegramSignature: "", savedAt });
        return;
      } catch (error) {}
    }

    downloadBlob(blob, filename);
    saveReportStatus({ savedSignature, telegramSignature: "", savedAt });
  }, "image/png", .96);
}
window.saveImageReport = saveImageReport;
$("saveImageBtn").addEventListener("click", saveImageReport);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.addEventListener("pagehide", () => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (error) {}
});

async function init() {
  state = await loadState();
  el.telegramToken.value = localStorage.getItem(TOKEN_KEY) || "";
  applyUiPrefs();
  render();
  recalculateEverything();
  setInterval(() => recalculateEverything({ pulse: false }), 2000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

init();
