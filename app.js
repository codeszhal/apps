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

const $ = (id) => document.getElementById(id);

const el = {
  appTitle: $("appTitle"),
  dailyStatus: $("dailyStatus"),
  dailyStatusText: $("dailyStatusText"),
  dailyStatusSub: $("dailyStatusSub"),
  dailyTelegramCta: $("dailyTelegramCta"),
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
  el.saveState.textContent = "保存中…";
  el.saveState.style.color = "#ca8a04";

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      await dbSet(STATE_STORE, STATE_KEY, state);
      el.saveState.textContent = "已保存";
      el.saveState.style.color = "#16a34a";
      updateTelegramPreview();
    } catch (error) {
      el.saveState.textContent = "保存失败";
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
      numberFormat: "1.000.000",
      autoSave: true,
      ...(JSON.parse(localStorage.getItem(UI_PREFS_KEY) || "{}"))
    };
  } catch (error) {
    return { language: "中文", theme: "light", currency: "Rp", numberFormat: "1.000.000", autoSave: true };
  }
}

function saveUiPrefs(next) {
  const prefs = { ...loadUiPrefs(), ...next };
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  applyUiPrefs(prefs);
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
      ...(JSON.parse(localStorage.getItem(REPORT_STATUS_KEY) || "{}"))
    };
  } catch (error) {
    return { date: reportStatusDate(), savedSignature: "", telegramSignature: "" };
  }
}

function saveReportStatus(next) {
  const payload = { ...loadReportStatus(), date: reportStatusDate(), ...next };
  localStorage.setItem(REPORT_STATUS_KEY, JSON.stringify(payload));
  updateDailyStatus();
}

function updateDailyStatus() {
  if (!el.dailyStatus) return;

  const currentSignature = reportSignature();
  const status = loadReportStatus();
  const isToday = status.date === reportStatusDate();
  const imageSaved = isToday && status.savedSignature === currentSignature;
  const telegramSent = imageSaved && status.telegramSignature === currentSignature;

  if (!imageSaved) {
    el.dailyStatus.className = "daily-status draft";
    el.dailyStatusText.textContent = "未保存变更";
    el.dailyStatusSub.textContent = "修改尚未保存到图片";
    el.dailyTelegramCta.hidden = true;
    return;
  }

  if (!telegramSent) {
    el.dailyStatus.className = "daily-status pending";
    el.dailyStatusText.textContent = "图片已保存，未发送 Telegram";
    el.dailyStatusSub.textContent = "尚未发送至 Telegram";
    el.dailyTelegramCta.hidden = false;
    return;
  }

  el.dailyStatus.className = "daily-status sent";
  el.dailyStatusText.textContent = "已发送 Telegram";
  el.dailyStatusSub.textContent = "图片已保存并已发送";
  el.dailyTelegramCta.hidden = true;
}

function applyUiPrefs(prefs = loadUiPrefs()) {
  const language = prefs.language === "English" ? "English" : "中文";
  if (el.languageButtonLabel) el.languageButtonLabel.textContent = language;
  if (el.settingsAutoSave) el.settingsAutoSave.checked = prefs.autoSave !== false;
  document.body.classList.toggle("theme-dark", prefs.theme === "dark");

  document.querySelectorAll("[data-setting]").forEach((button) => {
    button.classList.toggle("active", prefs[button.dataset.setting] === button.dataset.value);
  });
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
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function entryStatus(entryData) {
  if (entryData.state === "error") return { type: "bad", text: "金额错误" };
  if (entryData.state === "typing") return { type: "typing", text: "输入中..." };
  if (!hasValue(entryData.name) && !hasValue(entryData.expr)) return { type: "wait", text: "待输入" };
  return { type: "ok", text: "已计算" };
}

function inlineStatus(entryData) {
  if (entryData.state === "error") return "错误";
  if (entryData.state === "typing") return "输入中";
  if (!hasValue(entryData.expr)) return "输入中";
  return "有效";
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
      <button class="amount-action-btn" type="button" data-side="${side}" data-index="${index}" onclick="clearAmountCell('${side}', ${index})" title="清空金额" aria-label="清空金额">
        <img src="assets/icons/broom.svg" alt="" />
      </button>
    </div>
  `;
}

function amountBox(side, index) {
  const entryData = state[`${side}Rows`][index];
  const stateValue = entryData.state || "ok";
  const text = stateValue === "typing" ? "输入中" : formatMoney(entryData.amount);

  return `
    <div class="amount-box ${stateValue === "error" ? "error" : stateValue === "typing" ? "typing" : ""}"
      data-amount="${side}-${index}"
      title="${escapeHtml(entryData.error || "")}">
      ${text}
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
            <input value="${escapeHtml(item.name)}" placeholder="名" lang="zh-CN" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"
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
    node.textContent = item.state === "typing" ? "输入中" : formatMoney(item.amount);
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

  el.incomeSectionTotal.textContent = formatMoney(total.income);
  el.expenseSectionTotal.textContent = formatMoney(total.expense);
  el.totalIncome.textContent = formatMoney(total.income);
  el.totalExpense.textContent = formatMoney(total.expense);
  el.difference.textContent = total.diff > 0 ? `+${formatMoney(total.diff)}` : formatMoney(total.diff);

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

  el.appTitle.textContent = state.title;
  el.incomeNameLabel.textContent = state.labels.incomeName;
  el.incomeMoneyLabel.textContent = state.labels.incomeMoney;
  el.incomeTotalLabel.textContent = state.labels.incomeTotal;
  el.expenseNameLabel.textContent = state.labels.expenseName;
  el.expenseMoneyLabel.textContent = state.labels.expenseMoney;
  el.expenseTotalLabel.textContent = state.labels.expenseTotal;
  if (el.fontScale) el.fontScale.value = state.fontScale;
  if (el.settingsCompact) el.settingsCompact.checked = state.compact;

  renderLedger("income");
  renderLedger("expense");
  renderTotals();
  updateTelegramPreview();
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
    alert("请先点击金额输入框。");
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
    alert("请先点击金额输入框。");
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

  el.exprDialogTitle.textContent = side === "income" ? "收入金额详情" : "支出金额详情";
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
  showUndoSnackbar("行已删除", () => {
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
  el.undoSnackbarText.textContent = "Reset local data is a placeholder";
  el.undoSnackbar.hidden = false;
  clearTimeout(undoSnackbarTimer);
  undoSnackbarTimer = setTimeout(() => {
    el.undoSnackbar.hidden = true;
  }, 2400);
});

el.updateVersionBtn.addEventListener("click", () => {
  el.undoSnackbarText.textContent = "Version is up to date";
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

bindEditable(el.appTitle, (value) => state.title = value || "收支核对");
bindEditable(el.incomeNameLabel, (value) => state.labels.incomeName = value || "名");
bindEditable(el.incomeMoneyLabel, (value) => state.labels.incomeMoney = value || "金额");
bindEditable(el.incomeTotalLabel, (value) => state.labels.incomeTotal = value || "合计");
bindEditable(el.expenseNameLabel, (value) => state.labels.expenseName = value || "名");
bindEditable(el.expenseMoneyLabel, (value) => state.labels.expenseMoney = value || "金额");
bindEditable(el.expenseTotalLabel, (value) => state.labels.expenseTotal = value || "合计");

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
    alert("导入成功。");
  } catch (error) {
    alert("导入失败。");
  } finally {
    event.target.value = "";
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
  const title = side === "income" ? "收入" : "支出";
  const entries = visibleEntries(side).map(linePayload).join("\n\n");
  return `<b>${title}</b>\n\n${entries || "<code>空</code>"}`;
}

function buildAllPayload() {
  return `${buildSidePayload("income")}\n\n${buildSidePayload("expense")}`;
}

function buildEntryPayload(side, index) {
  const title = side === "income" ? "收入" : "支出";
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

async function sendTelegram(chatIds, htmlPayload) {
  const token = el.telegramToken.value.trim();
  localStorage.setItem(TOKEN_KEY, token);

  if (!htmlPayload.trim()) {
    alert("没有可发送内容。");
    return;
  }

  if (!token) {
    await navigator.clipboard.writeText(previewTextFromHtml(htmlPayload));
    el.telegramStatus.textContent = "未填写 Bot Token，内容已复制。";
    return;
  }

  el.telegramStatus.textContent = "发送中…";

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
  }

  el.telegramStatus.textContent = `发送完成：成功 ${ok}，失败 ${failed}`;
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
  sendTelegram(selectedTelegramUserIds(), buildAllPayload());
});

$("sendAllBtn").addEventListener("click", () => {
  sendTelegram(allTelegramUserIds(), buildAllPayload());
});

el.dailyTelegramCta.addEventListener("click", () => {
  sendTelegram(selectedTelegramUserIds(), buildAllPayload());
});

$("copyPayloadBtn").addEventListener("click", async () => {
  const text = previewTextFromHtml(buildAllPayload());
  await navigator.clipboard.writeText(text);
  el.telegramStatus.textContent = "内容已复制。";
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
  ctx.fillText(`日期：${imageDate}`, 70, 130);

  ctx.fillStyle = ok ? "#16a34a" : "#dc2626";
  drawRoundRect(ctx, width - 200, 58, 130, 48, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(ok ? "成功" : "失败", width - 160, 90);

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
    ctx.fillText("姓名", 92, y + 26);
    ctx.fillText("金额", 230, y + 26);
    ctx.fillText("合计", 850, y + 26);
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

  drawSection("收入", "#f97316", incomeRows);
  drawSection("支出", "#0284c7", expenseRows);

  ctx.fillStyle = "#0f172a";
  drawRoundRect(ctx, 70, y, 940, 68, 18);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 25px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(`收入：${formatMoney(total.income)}`, 100, y + 43);
  ctx.fillText(`支出：${formatMoney(total.expense)}`, 390, y + 43);
  ctx.fillStyle = ok ? "#86efac" : "#fca5a5";
  ctx.fillText(`差额：${formatMoney(total.diff)}`, 680, y + 43);

  canvas.toBlob(async (blob) => {
    if (!blob) return alert("保存图片失败。");
    const filename = `收支核对-${new Date().toISOString().slice(0, 10)}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const savedSignature = reportSignature();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "收支核对" });
        saveReportStatus({ savedSignature, telegramSignature: "" });
        return;
      } catch (error) {}
    }

    downloadBlob(blob, filename);
    saveReportStatus({ savedSignature, telegramSignature: "" });
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
