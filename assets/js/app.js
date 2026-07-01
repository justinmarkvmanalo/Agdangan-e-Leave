(function () {
  const config = window.SUPABASE_CONFIG || {};
  const isConfigured =
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    config.url !== "YOUR_SUPABASE_URL" &&
    config.anonKey !== "YOUR_SUPABASE_ANON_KEY";

  const sessionKey = "agdangan-eleave-session";

  let supabase = null;
  let db = null;
  let adminEmployeeProfiles = [];
  let adminLeaveRequests = [];
  let selectedAdminRequestId = null;
  let adminRequestModalOpen = false;
  let selectedCreditDeductionProfile = null;
  let creditDeductionEntries = [];
  const monthlyCreditGain = 1.25;
  const workingMinutesPerDay = 480;
  const creditDeductionLogKey = "agdangan-credit-deduction-logs";
  const lateMinuteDeductionTable = {
    1: 0.002,
    2: 0.004,
    3: 0.006,
    4: 0.008,
    5: 0.010,
    6: 0.012,
    7: 0.015,
    8: 0.017,
    9: 0.019,
    10: 0.021,
    11: 0.023,
    12: 0.025,
    13: 0.027,
    14: 0.029,
    15: 0.031,
    16: 0.033,
    17: 0.035,
    18: 0.037,
    19: 0.040,
    20: 0.042,
    21: 0.044,
    22: 0.046,
    23: 0.048,
    24: 0.050,
    25: 0.052,
    26: 0.054,
    27: 0.056,
    28: 0.058,
    29: 0.060,
    30: 0.062,
    31: 0.065,
    32: 0.067,
    33: 0.069,
    34: 0.071,
    35: 0.073,
    36: 0.075,
    37: 0.077,
    38: 0.079,
    39: 0.081,
    40: 0.083,
    41: 0.085,
    42: 0.087,
    43: 0.090,
    44: 0.092,
    45: 0.094,
    46: 0.096,
    47: 0.098,
    48: 0.100,
    49: 0.102,
    50: 0.104,
    51: 0.106,
    52: 0.108,
    53: 0.110,
    54: 0.112,
    55: 0.115,
    56: 0.117,
    57: 0.119,
    58: 0.121,
    59: 0.123,
    60: 0.125
  };
  const grokApiUrl = "https://api.x.ai/v1/chat/completions";
  const grokModel = "grok-2-1212";

  function getGrokApiKey() {
    return window.GROK_CONFIG?.apiKey || "";
  }

  const leaveTypeLabels = {
    vacation: "Vacation Leave",
    "mandatory-forced": "Mandatory/Forced Leave",
    sick: "Sick Leave",
    maternity: "Maternity Leave",
    paternity: "Paternity Leave",
    "special-privilege": "Special Privilege Leave",
    wellness: "Wellness Leave",
    "solo-parent": "Solo Parent Leave",
    study: "Study Leave",
    vawc: "10-Day VAWC Leave",
    "rehabilitation-privilege": "Rehabilitation Privilege",
    "special-benefits-women": "Special Leave Benefits for Women",
    "special-emergency-calamity": "Special Emergency (Calamity) Leave",
    adoption: "Adoption Leave",
    others: "Others"
  };
  const leavePaperTypeOptions = [
    ["vacation", "Vacation Leave", "(Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["mandatory-forced", "Mandatory/Forced Leave", "(Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["sick", "Sick Leave", "(Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["maternity", "Maternity Leave", "(R.A. No. 11210 / IRR issued by CSC, DOLE and SSS)"],
    ["paternity", "Paternity Leave", "(R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended)"],
    ["special-privilege", "Special Privilege Leave", "(Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["wellness", "Wellness Leave", "(5 days, subject to office policy)"],
    ["solo-parent", "Solo Parent Leave", "(R.A. No. 8972 / CSC MC No. 8, s. 2004)"],
    ["study", "Study Leave", "(Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["vawc", "10-Day VAWC Leave", "(R.A. No. 9262 / CSC MC No. 15, s. 2005)"],
    ["rehabilitation-privilege", "Rehabilitation Privilege", "(Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"],
    ["special-benefits-women", "Special Leave Benefits for Women", "(R.A. No. 9710 / CSC MC No. 25, s. 2010)"],
    ["special-emergency-calamity", "Special Emergency (Calamity) Leave", "(CSC MC No. 2, s. 2012, as amended)"],
    ["adoption", "Adoption Leave", "(R.A. No. 8552)"]
  ];
  const leaveCreditPolicies = {
    vacation: { freeDays: 0, deductsCredit: true, column: "vacation" },
    sick: { freeDays: 0, deductsCredit: true, column: "sick" },
    "mandatory-forced": { freeDays: 5, deductsCredit: true, column: "vacation" },
    wellness: { freeDays: 5, deductsCredit: true, column: "sick" },
    maternity: { freeDays: 105, deductsCredit: false, column: null },
    paternity: { freeDays: 7, deductsCredit: false, column: null },
    "special-privilege": { freeDays: 3, deductsCredit: false, column: null },
    "solo-parent": { freeDays: 7, deductsCredit: false, column: null }
  };

  if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(config.url, config.anonKey);
    db = supabase;
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const isEmployeeDashboardPage = /^\/employee-dashboard(?:\/index\.html)?$/.test(normalizedPath);
  const isAccountSettingsPage = /^\/account-settings(?:\/index\.html)?$/.test(normalizedPath);
  const isAdminDashboardPage = /^\/admin-dashboard(?:\/index\.html)?$/.test(normalizedPath);
  const isCreditComputationPage = /^\/credit-computation(?:\/index\.html)?$/.test(normalizedPath);
  const isStorageMonitoringPage = /^\/storage-monitoring(?:\/index\.html)?$/.test(normalizedPath);
  const nativeAlert = window.alert.bind(window);
  let activeSystemAlert = null;
  let lastSystemAlertFocus = null;

  window.alert = showSystemAlert;

  /* ---------- TOUR / USER GUIDE ---------- */
  const tourStorageKey = "agdangan-eleave-tour";

  function isTourDone(pageId) {
    try {
      const data = JSON.parse(window.localStorage.getItem(tourStorageKey) || "{}");
      return Boolean(data[pageId]);
    } catch { return false; }
  }

  function markTourDone(pageId) {
    try {
      const data = JSON.parse(window.localStorage.getItem(tourStorageKey) || "{}");
      data[pageId] = true;
      window.localStorage.setItem(tourStorageKey, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  function resetTour(pageId) {
    try {
      const data = JSON.parse(window.localStorage.getItem(tourStorageKey) || "{}");
      delete data[pageId];
      window.localStorage.setItem(tourStorageKey, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  var tourDefinitions = {
    login: [
      { target: "[data-role-switch]", title: "Choose Your Role", desc: "Switch between Employee and Admin access before signing in." },
      { target: "#email", title: "Email Address", desc: "Type your registered email \u2014 for example, name@agdangan.gov.ph." },
      { target: "#password", title: "Password", desc: "Enter your account password." },
      { target: ".auth-form .button-primary", title: "Sign In", desc: "Click this button to log into your dashboard." }
    ],
    employee: [
      { target: ".stats-grid", title: "Leave Overview", desc: "Your leave credits, pending requests, approved and rejected leaves at a glance." },
      { target: ".leave-paper", title: "Leave Application", desc: "This is the Civil Service Form No. 6. Fill it out to file a new leave request." },
      { target: ".leave-type-grid", title: "Leave Type", desc: "Select the kind of leave you need \u2014 Vacation, Sick, Maternity, and more." },
      { target: "#days-requested", title: "Days & Dates", desc: "Enter how many working days and pick the inclusive or selected dates." },
      { target: '#leave-request-form button[type="submit"]', title: "Submit Request", desc: "Double-check your entries then click to submit for approval." },
      { target: "#employee-request-list", title: "Request History", desc: "Keep track of all your submitted requests and their current status." }
    ],
    admin: [
      { target: ".stats-grid", title: "System Overview", desc: "See total employees, pending approvals, and overall request stats." },
      { target: "#add-employee-button", title: "Add Employee", desc: "Create new employee accounts with email, department, position, and leave credits." },
      { target: "#admin-requests-table", title: "Approval Queue", desc: "Review leave requests here \u2014 approve or reject with remarks." },
      { target: "#admin-employees-table", title: "Employee Records", desc: "Edit or deactivate existing employee accounts." }
    ],
    "account-settings": [
      { target: "[data-change-password-form]", title: "Change Password", desc: "Update your password here. You will need your current password first." }
    ],
    "credit-computation": [
      { target: ".stats-grid", title: "Credit Stats", desc: "Quick overview of total employees, current balance total, and next month-end run." },
      { target: ".credit-rules-card", title: "Credit Rules", desc: "Learn how accrual, late deductions, and leave deductions work." },
      { target: "#credit-computation-table", title: "Employee Balances", desc: "View all employee credit balances and apply late-minute deductions." },
      { target: ".credit-deduction-modal .button-primary", title: "Apply Deduction", desc: "Open the modal for an employee to log late minutes and apply deductions." }
    ],
    "storage-monitoring": [
      { target: ".storage-summary-card", title: "Storage Overview", desc: "See your total database usage against the 500 MB limit." },
      { target: "#storage-table", title: "Per-Table Breakdown", desc: "Check the size of each table in the database." },
      { target: "#export-excel-button", title: "Export to Excel", desc: "Download credit balances and deduction history as an Excel file." },
      { target: "#cleanup-button", title: "Clean Old Records", desc: "Remove deduction logs and old leave requests to free up space." }
    ]
  };

  var tourState = null;

  function cleanupTour() {
    if (!tourState) return;
    if (tourState._cleanup) tourState._cleanup();
    if (tourState.overlay && tourState.overlay.parentNode) tourState.overlay.remove();
    if (tourState.tooltip && tourState.tooltip.parentNode) tourState.tooltip.remove();
    tourState = null;
  }

  function positionTourStep(index) {
    if (!tourState) return;
    var steps = tourState.steps;
    var step = steps[index];
    if (!step) { cleanupTour(); return; }

    var targetEl = document.querySelector(step.target);
    if (!targetEl) { advanceTour(); return; }

    var rect = targetEl.getBoundingClientRect();
    var pad = 8;
    var overlay = tourState.overlay;
    var spotlight = overlay.querySelector(".tour-spotlight");
    if (!spotlight) {
      spotlight = document.createElement("div");
      spotlight.className = "tour-spotlight";
      overlay.appendChild(spotlight);
    }

    spotlight.style.left = (rect.left - pad) + "px";
    spotlight.style.top = (rect.top - pad) + "px";
    spotlight.style.width = (rect.width + pad * 2) + "px";
    spotlight.style.height = (rect.height + pad * 2) + "px";

    var tooltip = tourState.tooltip;
    if (!tooltip) return;

    var titleEl = tooltip.querySelector(".tour-tooltip-title");
    var descEl = tooltip.querySelector(".tour-tooltip-desc");
    var counterEl = tooltip.querySelector(".tour-tooltip-counter");
    var nextBtn = tooltip.querySelector(".tour-tooltip-next");
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.textContent = step.desc;
    if (counterEl) counterEl.textContent = (index + 1) + " of " + steps.length;
    if (nextBtn) nextBtn.textContent = index < steps.length - 1 ? "Continue" : "Done";

    var gap = 14;
    var margin = 12;
    var viewH = window.innerHeight;
    var viewW = window.innerWidth;
    var tooltipW = Math.min(380, viewW - margin * 2);

    tooltip.style.left = "-9999px";
    tooltip.style.top = "0px";
    tooltip.style.width = tooltipW + "px";
    var tooltipH = tooltip.offsetHeight;

    var spaceBelow = viewH - rect.bottom;
    var spaceAbove = rect.top;
    var placeBelow = spaceBelow >= tooltipH + gap;
    var placeAbove = spaceAbove >= tooltipH + gap;

    var tooltipY, arrowClass;

    if (placeBelow && (!placeAbove || spaceBelow >= spaceAbove)) {
      tooltipY = rect.bottom + gap;
      arrowClass = "arrow-up";
    } else if (placeAbove) {
      tooltipY = rect.top - tooltipH - gap;
      arrowClass = "arrow-down";
    } else if (spaceBelow >= spaceAbove) {
      tooltipY = rect.bottom + gap;
      arrowClass = "arrow-up";
    } else {
      tooltipY = rect.top - tooltipH - gap;
      arrowClass = "arrow-down";
    }

    tooltipY = Math.max(margin, Math.min(tooltipY, viewH - tooltipH - margin));

    var idealX = rect.left + rect.width / 2 - tooltipW / 2;
    var tooltipX = Math.max(margin, Math.min(idealX, viewW - tooltipW - margin));

    tooltip.style.left = tooltipX + "px";
    tooltip.style.top = tooltipY + "px";

    var arrow = tooltip.querySelector(".tour-tooltip-arrow");
    if (arrow) {
      arrow.className = "tour-tooltip-arrow " + arrowClass;
      var arrowCenterX = rect.left + rect.width / 2 - tooltipX;
      arrow.style.left = Math.max(10, Math.min(arrowCenterX - 7, tooltipW - 24)) + "px";
      if (arrowClass === "arrow-up") {
        arrow.style.top = "-7px";
        arrow.style.bottom = "auto";
      } else {
        arrow.style.bottom = "-7px";
        arrow.style.top = "auto";
      }
    }
  }

  function advanceTour() {
    if (!tourState) return;
    var nextIndex = tourState.index + 1;
    if (nextIndex >= tourState.steps.length) {
      markTourDone(tourState.pageId);
      cleanupTour();
      return;
    }
    tourState.index = nextIndex;
    positionTourStep(nextIndex);
  }

  function skipTour() {
    if (!tourState) return;
    markTourDone(tourState.pageId);
    cleanupTour();
  }

  function startTour(pageId) {
    if (isTourDone(pageId)) return;
    if (tourState) cleanupTour();

    var steps = tourDefinitions[pageId];
    if (!steps || !steps.length) return;

    var overlay = document.createElement("div");
    overlay.className = "tour-overlay";
    document.body.appendChild(overlay);

    var tooltip = document.createElement("div");
    tooltip.className = "tour-tooltip";
    tooltip.innerHTML =
      '<p class="tour-tooltip-title"></p>' +
      '<p class="tour-tooltip-desc"></p>' +
      '<div class="tour-tooltip-footer">' +
        '<span class="tour-tooltip-counter"></span>' +
        '<div class="tour-tooltip-actions">' +
          '<button type="button" class="tour-tooltip-skip">Skip</button>' +
          '<button type="button" class="tour-tooltip-next">Continue</button>' +
        '</div>' +
      '</div>' +
      '<div class="tour-tooltip-arrow"></div>';
    document.body.appendChild(tooltip);

    tourState = {
      pageId: pageId,
      steps: steps,
      index: 0,
      overlay: overlay,
      tooltip: tooltip
    };

    tooltip.querySelector(".tour-tooltip-next").addEventListener("click", advanceTour);
    tooltip.querySelector(".tour-tooltip-skip").addEventListener("click", skipTour);

    var onScroll = function () { if (tourState) positionTourStep(tourState.index); };
    var onResize = function () { if (tourState) positionTourStep(tourState.index); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    tourState._cleanup = function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };

    positionTourStep(0);
  }

  function addFloatingGuideButton(pageId) {
    var existing = document.querySelector(".tour-floating-btn");
    if (existing) existing.remove();

    var btn = document.createElement("button");
    btn.className = "tour-floating-btn";
    btn.setAttribute("aria-label", "User guide");
    btn.innerHTML = "?";
    btn.title = "User Guide";

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      resetTour(pageId);
      startTour(pageId);
    });

    document.body.appendChild(btn);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("login-form")) {
      initLoginPage();
      setTimeout(function () { startTour("login"); addFloatingGuideButton("login"); }, 500);
      return;
    }

    if (isEmployeeDashboardPage) {
      var pEmp = initEmployeeDashboard();
      if (pEmp && typeof pEmp.then === "function") {
        pEmp.then(function () { setTimeout(function () { startTour("employee"); addFloatingGuideButton("employee"); }, 600); });
      } else {
        setTimeout(function () { startTour("employee"); addFloatingGuideButton("employee"); }, 600);
      }
      return;
    }

    if (isAccountSettingsPage) {
      var pAcct = initAccountSettingsPage();
      if (pAcct && typeof pAcct.then === "function") {
        pAcct.then(function () { setTimeout(function () { startTour("account-settings"); addFloatingGuideButton("account-settings"); }, 600); });
      } else {
        setTimeout(function () { startTour("account-settings"); addFloatingGuideButton("account-settings"); }, 600);
      }
      return;
    }

    if (isAdminDashboardPage) {
      var pAdmin = initAdminDashboard();
      if (pAdmin && typeof pAdmin.then === "function") {
        pAdmin.then(function () { setTimeout(function () { startTour("admin"); addFloatingGuideButton("admin"); }, 600); });
      } else {
        setTimeout(function () { startTour("admin"); addFloatingGuideButton("admin"); }, 600);
      }
      return;
    }

    if (isCreditComputationPage) {
      var pCredit = initCreditComputationPage();
      if (pCredit && typeof pCredit.then === "function") {
        pCredit.then(function () { setTimeout(function () { startTour("credit-computation"); addFloatingGuideButton("credit-computation"); }, 600); });
      } else {
        setTimeout(function () { startTour("credit-computation"); addFloatingGuideButton("credit-computation"); }, 600);
      }
      return;
    }

    if (isStorageMonitoringPage) {
      var pStorage = initStorageMonitoringPage();
      if (pStorage && typeof pStorage.then === "function") {
        pStorage.then(function () { setTimeout(function () { startTour("storage-monitoring"); addFloatingGuideButton("storage-monitoring"); }, 600); });
      } else {
        setTimeout(function () { startTour("storage-monitoring"); addFloatingGuideButton("storage-monitoring"); }, 600);
      }
    }
  });

  function showSystemAlert(message, options = {}) {
    const text = String(message || "Something needs your attention.");
    if (!document.body) {
      nativeAlert(text);
      return;
    }

    closeSystemAlert();

    const variant = options.variant || getAlertVariant(text);
    const title = options.title || getAlertTitle(variant);
    const icon = variant === "success" ? "OK" : "!";
    const alert = document.createElement("div");
    alert.className = `system-alert system-alert-${variant}`;
    alert.setAttribute("role", "alertdialog");
    alert.setAttribute("aria-modal", "true");
    alert.setAttribute("aria-labelledby", "system-alert-title");
    alert.setAttribute("aria-describedby", "system-alert-message");
    alert.innerHTML = `
      <div class="system-alert-backdrop" data-system-alert-close></div>
      <div class="system-alert-dialog" tabindex="-1">
        <div class="system-alert-icon" aria-hidden="true">${icon}</div>
        <div class="system-alert-copy">
          <h3 id="system-alert-title">${escapeHtml(title)}</h3>
          <p id="system-alert-message">${escapeHtml(text)}</p>
        </div>
        <button type="button" class="button button-primary system-alert-action" data-system-alert-close>OK</button>
      </div>
    `;

    activeSystemAlert = alert;
    lastSystemAlertFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.appendChild(alert);

    Array.from(alert.querySelectorAll("[data-system-alert-close]")).forEach((element) => {
      element.addEventListener("click", closeSystemAlert);
    });

    alert.addEventListener("keydown", (event) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        closeSystemAlert();
      }
    });

    alert.querySelector(".system-alert-dialog")?.focus();
  }

  function closeSystemAlert() {
    if (!activeSystemAlert) {
      return;
    }

    activeSystemAlert.remove();
    activeSystemAlert = null;
    if (lastSystemAlertFocus && document.body.contains(lastSystemAlertFocus)) {
      lastSystemAlertFocus.focus();
    }
    lastSystemAlertFocus = null;
  }

  function getAlertVariant(message) {
    if (/submitted|created|updated|deleted|saved|deducted/i.test(message)) {
      return "success";
    }

    return "notice";
  }

  function getAlertTitle(variant) {
    return variant === "success" ? "Done" : "Notice";
  }

  function beginFormSubmit(form, loadingText) {
    if (!form || form.dataset.submitting === "true") {
      return null;
    }

    form.dataset.submitting = "true";
    form.classList.add("is-submitting");

    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    const restoreButton = setButtonLoading(submitButton, loadingText);

    return () => {
      form.dataset.submitting = "false";
      form.classList.remove("is-submitting");
      restoreButton();
    };
  }

  function setButtonLoading(button, loadingText) {
    if (!button) {
      return () => {};
    }

    if (button.dataset.loading === "true") {
      return () => {};
    }

    button.dataset.loading = "true";
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.originalDisabled = button.disabled ? "true" : "false";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add("is-loading");
    button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${escapeHtml(loadingText || "Processing...")}</span>`;

    return () => {
      button.innerHTML = button.dataset.originalHtml || "";
      button.disabled = button.dataset.originalDisabled === "true";
      button.removeAttribute("aria-busy");
      button.classList.remove("is-loading");
      delete button.dataset.loading;
      delete button.dataset.originalHtml;
      delete button.dataset.originalDisabled;
    };
  }

  async function runWithButtonLoading(button, loadingText, callback) {
    if (button?.dataset.loading === "true") {
      return null;
    }

    const restoreButton = setButtonLoading(button, loadingText);
    try {
      return await callback();
    } finally {
      restoreButton();
    }
  }

  function initLoginPage() {
    const configStatus = document.getElementById("config-status");
    const switchButtons = Array.from(document.querySelectorAll("[data-role-switch]"));
    const title = document.getElementById("auth-title");
    const subtitle = document.getElementById("auth-subtitle");
    const roleInput = document.getElementById("selected-role");
    const loginForm = document.getElementById("login-form");
    const requestedRole = new URLSearchParams(window.location.search).get("role");

    const applyRole = (role) => {
      const normalizedRole = role === "admin" ? "admin" : "employee";
      const activeButton = switchButtons.find((button) => button.getAttribute("data-role-switch") === normalizedRole);

      switchButtons.forEach((item) => item.classList.toggle("active", item === activeButton));
      roleInput.value = normalizedRole;
      title.textContent = normalizedRole === "admin" ? "Admin Sign In" : "Employee Sign In";
      subtitle.textContent = normalizedRole === "admin"
        ? "Use your admin table credentials to review and approve leave requests."
        : "Use your employee table credentials to open your leave dashboard.";
    };

    if (configStatus) {
      configStatus.hidden = isConfigured;
      configStatus.textContent = isConfigured
        ? ""
        : "Supabase is not configured yet. Open assets/js/supabase-config.js and set your project values first.";
    }

    switchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const role = button.getAttribute("data-role-switch");
        applyRole(role);
      });
    });

    if (requestedRole === "admin" || requestedRole === "employee") {
      applyRole(requestedRole);
    }

    if (!loginForm) {
      return;
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!db) {
        window.alert("Supabase is not configured yet. Update assets/js/supabase-config.js first.");
        return;
      }

      const finishSubmit = beginFormSubmit(loginForm, "Signing in...");
      if (!finishSubmit) {
        return;
      }

      try {
        const formData = new FormData(loginForm);
        const email = String(formData.get("email") || "").trim().toLowerCase();
        const password = String(formData.get("password") || "");
        const selectedRole = String(formData.get("selectedRole") || "employee");

        const { data, error } = await db.rpc("login_user", {
          p_email: email,
          p_password: password,
          p_role: selectedRole
        });

        if (error) {
          window.alert(error.message);
          return;
        }

        const account = Array.isArray(data) ? data[0] : data;
        if (!account) {
          window.alert("Invalid login credentials.");
          return;
        }

        saveSession({
          role: account.role,
          userId: Number(account.user_id),
          email: account.email
        });

        window.location.href = account.role === "admin" ? "/admin-dashboard" : "/employee-dashboard";
      } finally {
        finishSubmit();
      }
    });
  }

  async function initEmployeeDashboard() {
    bindSignOut();

    if (!db) {
      renderEmployeeDemo();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "employee") {
      window.location.href = "/login";
      return;
    }

    const profile = await fetchEmployeeProfile(session.userId);
    if (!profile) {
      window.alert("Unable to load the employee profile after login. Check Supabase table access and RLS settings.");
      return;
    }

    fillEmployeeHeader(profile);
    populateLeaveApplicationProfile(profile);
    await loadEmployeeRequests(profile.id);
    bindLeaveRequestForm(profile);
    await initDailyEntry(profile.id);
  }

  async function initAccountSettingsPage() {
    bindSignOut();

    if (!db) {
      bindChangePasswordForm();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "employee") {
      window.location.href = "/login";
      return;
    }

    const profile = await fetchEmployeeProfile(session.userId);
    if (!profile) {
      window.alert("Unable to load the employee profile after login. Check Supabase table access and RLS settings.");
      return;
    }

    fillEmployeeHeader(profile);
    bindChangePasswordForm();
  }

  async function initAdminDashboard() {
    bindSignOut();

    if (!db) {
      renderAdminDemo();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    const profile = await fetchAdminProfile(session.userId);
    if (!profile) {
      window.alert("Unable to load the admin profile after login. Check Supabase table access and RLS settings.");
      return;
    }

    const adminName = document.getElementById("admin-name");
    const adminMeta = document.getElementById("admin-meta");
    if (adminName) {
      adminName.textContent = `Welcome, ${profile.first_name} ${profile.last_name}`;
    }
    if (adminMeta) {
      adminMeta.textContent = `${profile.department} | ${profile.position_title}`;
    }

    bindAdminEmployeeForm(profile.id);
    await Promise.all([loadAdminProfiles(), loadAdminRequests()]);
  }

  async function initCreditComputationPage() {
    bindSignOut();
    bindCreditDeductionModal();

    if (!db) {
      renderCreditComputationDemo();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    const profile = await fetchAdminProfile(session.userId);
    if (!profile) {
      window.alert("Unable to load the admin profile after login. Check Supabase table access and RLS settings.");
      return;
    }

    setText("credit-page-title", `Leave Credit Computation for ${profile.department}`);
    setText("credit-page-meta", `${profile.first_name} ${profile.last_name} | ${profile.position_title}`);

    await Promise.all([loadAdminProfiles(), loadAdminRequests()]);
    renderCreditComputationPage();
  }

  async function fetchAdminProfile(adminId) {
    const { data, error } = await db.rpc("get_admin_profile", {
      p_admin_id: adminId
    });

    if (error) {
      console.error("Unable to load admin profile.", error);
      return null;
    }

    return data;
  }

  async function fetchEmployeeProfile(employeeId) {
    const { data, error } = await db.rpc("get_employee_profile", {
      p_employee_id: employeeId
    });

    if (error) {
      console.error("Unable to load employee profile.", error);
      return null;
    }

    return data;
  }

  function fillEmployeeHeader(profile) {
    const employeeName = document.getElementById("employee-name");
    const employeeMeta = document.getElementById("employee-meta");
    const leaveCredits = document.getElementById("stat-leave-credits");

    if (employeeName) {
      employeeName.textContent = `Welcome, ${profile.first_name} ${profile.last_name}`;
    }

    if (employeeMeta) {
      employeeMeta.textContent = [
        profile.employee_no || "No employee number",
        profile.department,
        profile.position_title
      ].filter(Boolean).join(" | ");
    }

    if (leaveCredits) {
      leaveCredits.textContent = formatCreditAmount(profile.leave_credits);
    }
  }

  function populateLeaveApplicationProfile(profile) {
    setInputValue("office-department", profile.department || "");
    setInputValue("applicant-last", profile.last_name || "");
    setInputValue("applicant-first", profile.first_name || "");
    setInputValue("applicant-middle", profile.middle_name || "");
    setInputValue("position-title", profile.position_title || "");
    setInputValue("salary-display", "N/A");
    setInputValue("filing-date", new Date().toISOString().slice(0, 10));
  }

  async function loadEmployeeRequests(employeeId) {
    const { data, error } = await db.rpc("get_employee_leave_requests", {
      p_employee_id: employeeId
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    const pending = data.filter((item) => item.status === "pending").length;
    const approved = data.filter((item) => item.status === "approved").length;
    const rejected = data.filter((item) => item.status === "rejected").length;

    setText("stat-pending", String(pending));
    setText("stat-approved", String(approved));
    setText("stat-rejected", String(rejected));

    const list = document.getElementById("employee-request-list");
    if (!list) {
      return;
    }

    if (!data.length) {
      list.innerHTML = '<li class="empty-state">No leave requests submitted yet.</li>';
      return;
    }

    list.innerHTML = data.map((request) => `
      <li>
        <strong>${escapeHtml(formatLeaveType(request.leave_type))}</strong>
        <div>${escapeHtml(formatLeaveDateSummary(request))}</div>
        <div>${escapeHtml(request.days_requested)} day(s)</div>
        <div><span class="badge ${escapeHtml(getRequestStatusClass(request))}">${escapeHtml(getRequestTrackingLabel(request))}</span></div>
        <div class="table-actions">
          <button type="button" class="button button-muted" data-employee-print-request="${escapeAttribute(String(request.id))}">Print</button>
        </div>
      </li>
    `).join("");

    Array.from(list.querySelectorAll("[data-employee-print-request]")).forEach((button) => {
      button.addEventListener("click", () => {
        const requestId = Number(button.getAttribute("data-employee-print-request"));
        const request = data.find((item) => Number(item.id) === requestId);
        if (request) {
          printAdminLeaveRequest(request);
        }
      });
    });
  }

  function bindLeaveRequestForm(profile) {
    const form = document.getElementById("leave-request-form");
    if (!form) {
      return;
    }

    let selectedLeaveDates = [];
    const startDateInput = form.querySelector("#start-date");
    const endDateInput = form.querySelector("#end-date");
    const daysRequestedInput = form.querySelector("#days-requested");
    const dateModeInputs = Array.from(form.querySelectorAll('input[name="dateMode"]'));
    const rangePanel = form.querySelector('[data-date-mode-panel="range"]');
    const selectedPanel = form.querySelector('[data-date-mode-panel="selected"]');
    const selectedDateInput = form.querySelector("#selected-date-input");
    const addSelectedDateButton = form.querySelector("#add-selected-date");
    const clearSelectedDatesButton = form.querySelector("#clear-selected-dates");
    const selectedDateList = form.querySelector("#selected-date-list");
    const leaveOtherInput = form.querySelector("#leave-other");
    const leaveTypeInputs = Array.from(form.querySelectorAll('input[name="leaveType"]'));
    const groupedDetailInputs = {
      vacation: Array.from(form.querySelectorAll('input[name="leaveLocation"]')),
      sick: Array.from(form.querySelectorAll('input[name="sickDetail"]')),
      women: Array.from(form.querySelectorAll('input[name="womenIllnessNote"]')),
      study: Array.from(form.querySelectorAll('input[name="leavePurpose"][value="masters-completion"], input[name="leavePurpose"][value="bar-review"]')),
      "other-purpose": Array.from(form.querySelectorAll('input[name="leavePurpose"][value="monetization"], input[name="leavePurpose"][value="terminal"]'))
    };
    const detailGroupRules = {
      vacation: ["vacation"],
      "special-privilege": ["vacation"],
      sick: ["sick"],
      "special-benefits-women": ["women"],
      study: ["study"],
      others: ["other-purpose"]
    };

    const getSelectedLeaveTypes = () => leaveTypeInputs
      .filter((input) => input.checked)
      .map((input) => input.value);

    const validateLeaveTypeSelection = (changedInput = null) => {
      const selectedLeaveTypes = getSelectedLeaveTypes();
      if (selectedLeaveTypes.length <= 1) {
        return true;
      }

      const includesCreditLeave = selectedLeaveTypes.includes("vacation") || selectedLeaveTypes.includes("sick");
      if (selectedLeaveTypes.length > 2 || !includesCreditLeave) {
        if (changedInput) {
          changedInput.checked = false;
        }
        window.alert("You can select up to two leave types. If you select two, one must be Vacation Leave or Sick Leave.");
        return false;
      }

      return true;
    };

    const syncLeaveTypeState = () => {
      const selectedLeaveTypes = getSelectedLeaveTypes();
      const enabledGroups = new Set(selectedLeaveTypes.flatMap((leaveType) => detailGroupRules[leaveType] || []));

      Object.entries(groupedDetailInputs).forEach(([groupKey, inputs]) => {
        const isEnabled = enabledGroups.has(groupKey);
        const group = form.querySelector(`[data-detail-group="${groupKey}"]`);
        group?.classList.toggle("is-disabled", !isEnabled);

        inputs.forEach((input) => {
          input.disabled = !isEnabled;
          if (!isEnabled) {
            input.checked = false;
          }
        });
      });

      if (leaveOtherInput) {
        const otherSelected = selectedLeaveTypes.includes("others");
        leaveOtherInput.disabled = !otherSelected;
        if (!otherSelected) {
          leaveOtherInput.value = "";
        }
      }
    };

    const getSelectedDateMode = () => dateModeInputs.find((input) => input.checked)?.value || "range";

    const renderSelectedLeaveDates = () => {
      if (!selectedDateList) {
        return;
      }

      if (!selectedLeaveDates.length) {
        selectedDateList.innerHTML = '<span class="muted">No dates selected yet.</span>';
        return;
      }

      selectedDateList.innerHTML = selectedLeaveDates.map((value) => `
        <span class="leave-paper-date-chip">
          <span>${escapeHtml(formatDateDisplay(value))}</span>
          <button type="button" data-remove-selected-date="${escapeAttribute(value)}" aria-label="Remove ${escapeAttribute(value)}">x</button>
        </span>
      `).join("");

      Array.from(selectedDateList.querySelectorAll("[data-remove-selected-date]")).forEach((button) => {
        button.addEventListener("click", () => {
          const dateValue = button.getAttribute("data-remove-selected-date");
          selectedLeaveDates = selectedLeaveDates.filter((item) => item !== dateValue);
          syncDaysRequested();
          renderSelectedLeaveDates();
        });
      });
    };

    const syncDateModeState = () => {
      const isRangeMode = getSelectedDateMode() === "range";

      rangePanel?.classList.toggle("hidden", !isRangeMode);
      selectedPanel?.classList.toggle("hidden", isRangeMode);

      if (startDateInput) {
        startDateInput.disabled = !isRangeMode;
        startDateInput.required = isRangeMode;
      }

      if (endDateInput) {
        endDateInput.disabled = !isRangeMode;
        endDateInput.required = isRangeMode;
      }

      if (selectedDateInput) {
        selectedDateInput.disabled = isRangeMode;
      }

      addSelectedDateButton?.toggleAttribute("disabled", isRangeMode);
      clearSelectedDatesButton?.toggleAttribute("disabled", isRangeMode);

      syncDaysRequested();
      renderSelectedLeaveDates();
    };

    const syncDaysRequested = () => {
      if (!daysRequestedInput) {
        return;
      }

      if (getSelectedDateMode() === "selected") {
        daysRequestedInput.value = selectedLeaveDates.length ? String(selectedLeaveDates.length) : "";
        return;
      }

      if (!startDateInput || !endDateInput) {
        return;
      }

      const startDateValue = startDateInput.value;
      const endDateValue = endDateInput.value;
      if (!startDateValue || !endDateValue) {
        daysRequestedInput.value = "";
        return;
      }

      const startDate = new Date(`${startDateValue}T00:00:00`);
      const endDate = new Date(`${endDateValue}T00:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        daysRequestedInput.value = "";
        return;
      }

      const computedDays = countWorkingDaysInRange(startDateValue, endDateValue);
      daysRequestedInput.value = String(computedDays);
    };

    const sanitizeDaysRequested = () => {
      if (!daysRequestedInput) {
        return;
      }

      const digitsOnly = String(daysRequestedInput.value || "").replace(/[^\d]/g, "");
      daysRequestedInput.value = digitsOnly;
    };

    const addSelectedLeaveDate = () => {
      const dateValue = String(selectedDateInput?.value || "").trim();
      if (!dateValue) {
        return;
      }

      if (!selectedLeaveDates.includes(dateValue)) {
        selectedLeaveDates = [...selectedLeaveDates, dateValue].sort();
      }

      if (selectedDateInput) {
        selectedDateInput.value = "";
      }

      syncDaysRequested();
      renderSelectedLeaveDates();
    };

    leaveTypeInputs.forEach((input) => input.addEventListener("change", () => {
      validateLeaveTypeSelection(input);
      syncLeaveTypeState();
    }));
    dateModeInputs.forEach((input) => input.addEventListener("change", syncDateModeState));
    startDateInput?.addEventListener("change", syncDaysRequested);
    endDateInput?.addEventListener("change", syncDaysRequested);
    daysRequestedInput?.addEventListener("input", sanitizeDaysRequested);
    addSelectedDateButton?.addEventListener("click", addSelectedLeaveDate);
    selectedDateInput?.addEventListener("change", addSelectedLeaveDate);
    clearSelectedDatesButton?.addEventListener("click", () => {
      selectedLeaveDates = [];
      syncDaysRequested();
      renderSelectedLeaveDates();
    });
    syncLeaveTypeState();
    syncDateModeState();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const dateMode = getSelectedDateMode();
      const vacationLocation = formData.getAll("leaveLocation").map((value) => String(value));
      const sickLeaveDetails = formData.getAll("sickDetail").map((value) => String(value));
      const leavePurposeDetails = formData.getAll("leavePurpose").map((value) => String(value));
      const vacationLocationNotes = {
        "within-ph": String(formData.get("leaveLocationWithinNote") || "").trim(),
        abroad: String(formData.get("leaveLocationAbroadNote") || "").trim()
      };
      const sickLeaveNotes = {
        "in-hospital": String(formData.get("sickDetailHospitalNote") || "").trim(),
        "out-patient": String(formData.get("sickDetailOutpatientNote") || "").trim()
      };
      const leavePurposeNotes = {
        "women-illness": String(formData.get("womenIllnessNote") || "").trim()
      };
      const rangeStartDate = String(formData.get("startDate") || "");
      const rangeEndDate = String(formData.get("endDate") || "");
      const normalizedSelectedDates = selectedLeaveDates.slice().sort();
      const resolvedStartDate = dateMode === "selected" ? (normalizedSelectedDates[0] || "") : rangeStartDate;
      const resolvedEndDate = dateMode === "selected" ? (normalizedSelectedDates[normalizedSelectedDates.length - 1] || "") : rangeEndDate;
      const selectedLeaveTypes = formData.getAll("leaveType").map((value) => String(value));

      const payload = {
        employee_id: profile.id,
        leave_type: selectedLeaveTypes.join(","),
        office_department: String(document.getElementById("office-department")?.value || profile.department || ""),
        applicant_last_name: String(document.getElementById("applicant-last")?.value || profile.last_name || ""),
        applicant_first_name: String(document.getElementById("applicant-first")?.value || profile.first_name || ""),
        applicant_middle_name: String(document.getElementById("applicant-middle")?.value || profile.middle_name || ""),
        filing_date: String(document.getElementById("filing-date")?.value || ""),
        position_title: String(document.getElementById("position-title")?.value || profile.position_title || ""),
        salary_display: String(document.getElementById("salary-display")?.value || "N/A"),
        start_date: resolvedStartDate,
        end_date: resolvedEndDate,
        selected_leave_dates: normalizedSelectedDates,
        days_requested: Number.parseInt(String(formData.get("daysRequested") || "0"), 10),
        other_leave_details: String(document.getElementById("leave-other")?.value || "").trim(),
        vacation_location: vacationLocation,
        vacation_location_notes: vacationLocationNotes,
        sick_leave_details: sickLeaveDetails,
        sick_leave_notes: sickLeaveNotes,
        leave_purpose_details: leavePurposeDetails,
        leave_purpose_notes: leavePurposeNotes,
        commutation: String(formData.get("commutation") || ""),
        reason: String(formData.get("reason") || ""),
        recommendation_officer_name: String(formData.get("recommendationOfficerName") || "").trim(),
        approval_authorized_official_name: String(formData.get("approvalAuthorizedOfficialName") || "").trim()
      };

      if (!selectedLeaveTypes.length) {
        window.alert("Select at least one type of leave.");
        return;
      }

      if (selectedLeaveTypes.length > 2 || (selectedLeaveTypes.length === 2 && !selectedLeaveTypes.some((leaveType) => leaveType === "vacation" || leaveType === "sick"))) {
        window.alert("You can select up to two leave types. If you select two, one must be Vacation Leave or Sick Leave.");
        return;
      }

      if (selectedLeaveTypes.some((leaveType) => leaveType === "vacation" || leaveType === "special-privilege") && !vacationLocation.length) {
        window.alert("Select Within the Philippines or Abroad for Vacation / Special Privilege Leave.");
        return;
      }

      if (selectedLeaveTypes.includes("sick") && !sickLeaveDetails.length) {
        window.alert("Select In Hospital or Out Patient for Sick Leave.");
        return;
      }

      if (selectedLeaveTypes.includes("special-benefits-women") && !String(formData.get("womenIllnessNote") || "").trim()) {
        window.alert("Specify the illness for Special Leave Benefits for Women.");
        return;
      }

      if (selectedLeaveTypes.includes("study") && !leavePurposeDetails.some((value) => value === "masters-completion" || value === "bar-review")) {
        window.alert("Select a study leave purpose.");
        return;
      }

      if (selectedLeaveTypes.includes("others") && !leavePurposeDetails.some((value) => value === "monetization" || value === "terminal")) {
        window.alert("Select an other-purpose option.");
        return;
      }

      if (!payload.commutation) {
        window.alert("Select a commutation option.");
        return;
      }

      if (dateMode === "selected" && !payload.selected_leave_dates.length) {
        window.alert("Add at least one selected leave date.");
        return;
      }

      if (!payload.start_date || !payload.end_date) {
        window.alert("Provide the leave dates before submitting.");
        return;
      }

      if (!Number.isInteger(payload.days_requested) || payload.days_requested <= 0) {
        window.alert("Working days must be a whole number greater than zero.");
        return;
      }

      const creditDeductingTypes = selectedLeaveTypes.filter((t) =>
        ["vacation", "sick", "mandatory-forced", "wellness"].includes(t)
      );
      if (creditDeductingTypes.length > 0) {
        let freeDays = 0;
        if (selectedLeaveTypes.includes("mandatory-forced")) freeDays = 5;
        if (selectedLeaveTypes.includes("wellness")) freeDays = Math.max(freeDays, 5);
        const effectiveDays = Math.max(payload.days_requested - freeDays, 0);
        const currentCredits = Number(profile.leave_credits) || 0;
        if (effectiveDays > currentCredits) {
          window.alert(
            "Insufficient leave credits. You have " + formatCreditAmount(currentCredits) +
            " credit(s) but this request requires " + effectiveDays + " day(s)."
          );
          return;
        }
      }

      const finishSubmit = beginFormSubmit(form, "Submitting...");
      if (!finishSubmit) {
        return;
      }

      try {
        const { error } = await db.rpc("create_leave_request", {
          p_employee_id: payload.employee_id,
          p_leave_type: payload.leave_type,
          p_office_department: payload.office_department,
          p_applicant_last_name: payload.applicant_last_name,
          p_applicant_first_name: payload.applicant_first_name,
          p_applicant_middle_name: payload.applicant_middle_name,
          p_filing_date: payload.filing_date,
          p_position_title: payload.position_title,
          p_salary_display: payload.salary_display,
          p_start_date: payload.start_date,
          p_end_date: payload.end_date,
          p_selected_leave_dates: payload.selected_leave_dates,
          p_days_requested: payload.days_requested,
          p_other_leave_details: payload.other_leave_details,
          p_vacation_location: payload.vacation_location,
          p_vacation_location_notes: payload.vacation_location_notes,
          p_sick_leave_details: payload.sick_leave_details,
          p_sick_leave_notes: payload.sick_leave_notes,
          p_leave_purpose_details: payload.leave_purpose_details,
          p_leave_purpose_notes: payload.leave_purpose_notes,
          p_commutation: payload.commutation,
          p_reason: payload.reason,
          p_recommendation_officer_name: payload.recommendation_officer_name,
          p_approval_authorized_official_name: payload.approval_authorized_official_name
        });

        if (error) {
          window.alert(error.message);
          return;
        }

        form.reset();
        selectedLeaveDates = [];
        populateLeaveApplicationProfile(profile);
        syncLeaveTypeState();
        syncDateModeState();
        await loadEmployeeRequests(profile.id);
        window.alert("Leave request submitted.");
      } finally {
        finishSubmit();
      }
    });
  }

  async function initDailyEntry(employeeId) {
    const promptEl = document.getElementById("daily-entry-prompt");
    const cardEl = document.getElementById("daily-entry-card");
    const textarea = document.getElementById("daily-entry-textarea");
    const saveBtn = document.getElementById("daily-entry-save-btn");
    const openBtn = document.getElementById("daily-entry-open-btn");
    const toggleHistoryBtn = document.getElementById("daily-entry-toggle-history");
    const historyEl = document.getElementById("daily-entry-history");
    const historyList = document.getElementById("daily-entry-history-list");
    const savedText = document.getElementById("daily-entry-saved-text");
    const dateLabel = document.getElementById("daily-entry-date-label");

    if (!cardEl) return;

    var backBtn = document.getElementById("daily-entry-back-today-btn");
    var selectedEntryDate = null;
    var today = new Date().toISOString().slice(0, 10);
    var headingEl = cardEl.querySelector("h3");

    function formatDateLabel(dateStr) {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }

    function setEditingDate(dateStr) {
      selectedEntryDate = dateStr;
      if (dateLabel) {
        dateLabel.textContent = formatDateLabel(dateStr);
      }
      var isToday = dateStr === today;
      if (backBtn) {
        backBtn.classList.toggle("hidden", isToday);
      }
      if (headingEl) {
        headingEl.textContent = isToday ? "What did you do today?" : "Edit Entry";
      }
      savedText.classList.add("hidden");
    }

    async function loadEntryForDate(dateStr) {
      if (!db) return;

      var { data, error } = await db.rpc("get_daily_entry", {
        p_employee_id: employeeId,
        p_entry_date: dateStr
      });

      if (!error && data && data.content) {
        textarea.value = data.content;
        savedText.classList.remove("hidden");
      } else {
        textarea.value = "";
        savedText.classList.add("hidden");
      }
    }

    async function loadTodayEntry() {
      if (!db) return;
      setEditingDate(today);

      var { data, error } = await db.rpc("get_daily_entry", {
        p_employee_id: employeeId,
        p_entry_date: today
      });

      if (!error && data) {
        if (data.content) {
          textarea.value = data.content;
          savedText.classList.remove("hidden");
          if (promptEl) promptEl.classList.add("hidden");
        } else {
          textarea.value = "";
          savedText.classList.add("hidden");
          if (promptEl) promptEl.classList.remove("hidden");
        }
      } else {
        textarea.value = "";
        savedText.classList.add("hidden");
        if (promptEl) promptEl.classList.remove("hidden");
      }
    }

    async function loadHistory() {
      if (!db) return;

      var { data, error } = await db.rpc("get_daily_entries", {
        p_employee_id: employeeId,
        p_limit: 10,
        p_offset: 0
      });

      if (error || !data || !data.length) {
        historyList.innerHTML = '<li class="empty-state">No entries yet.</li>';
        return;
      }

      historyList.innerHTML = data.map(function(entry) {
        var date = new Date(entry.entry_date + "T00:00:00").toLocaleDateString("en-PH", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric"
        });
        var isSelected = entry.entry_date === selectedEntryDate;
        return '<li class="' + (isSelected ? 'daily-entry-history-selected' : '') + '" data-entry-date="' + entry.entry_date + '">' +
          '<div class="daily-entry-history-date">' + date + '</div>' +
          '<div class="daily-entry-history-content">' + escapeHtml(entry.content) + '</div>' +
          '</li>';
      }).join("");

      Array.from(historyList.querySelectorAll("li[data-entry-date]")).forEach(function(li) {
        li.addEventListener("click", function() {
          var date = li.getAttribute("data-entry-date");
          setEditingDate(date);
          loadEntryForDate(date);
        });
      });
    }

    async function saveEntry() {
      if (!db) return;

      var content = textarea.value.trim();
      if (!content) {
        window.alert("Please write something about your day before saving.");
        return;
      }

      var targetDate = selectedEntryDate || today;

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      var { error } = await db.rpc("create_or_update_daily_entry", {
        p_employee_id: employeeId,
        p_entry_date: targetDate,
        p_content: content
      });

      saveBtn.disabled = false;
      saveBtn.textContent = "Save Entry";

      if (error) {
        window.alert("Error saving entry: " + error.message);
        return;
      }

      savedText.classList.remove("hidden");
      if (promptEl) promptEl.classList.add("hidden");
      await loadHistory();
    }

    if (openBtn) {
      openBtn.addEventListener("click", function() {
        setEditingDate(today);
        loadTodayEntry();
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        textarea.focus();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", saveEntry);
    }

    if (backBtn) {
      backBtn.addEventListener("click", function() {
        loadTodayEntry();
      });
    }

    if (toggleHistoryBtn && historyEl) {
      toggleHistoryBtn.addEventListener("click", function() {
        var isHidden = historyEl.classList.contains("hidden");
        historyEl.classList.toggle("hidden");
        toggleHistoryBtn.textContent = isHidden ? "Hide History" : "View History";
        if (isHidden) loadHistory();
      });
    }

    await loadTodayEntry();

    if (promptEl && !promptEl.classList.contains("hidden")) {
      setTimeout(function() {
        promptEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 600);
    }
  }

  async function loadAdminProfiles() {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await db.rpc("get_admin_employees", {
      p_admin_id: session.userId
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    adminEmployeeProfiles = data;
    setText("stat-employees", String(data.length));
    renderAdminEmployeeTable(data);
  }

  function renderAdminEmployeeTable(profiles) {
    const container = document.getElementById("admin-employees-table");
    if (!container) {
      return;
    }

    if (!profiles.length) {
      container.innerHTML = '<p class="empty-state">No employee account data loaded yet.</p>';
      return;
    }

    container.innerHTML = `
      <div class="employee-record-list">
        ${profiles.map((profile) => `
          <article class="employee-record-row">
            <div>
              <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong>
              <span>${escapeHtml(profile.employee_no || "No employee number")}</span>
              <span>${escapeHtml(profile.email || "No email")}</span>
            </div>
            <div>
              <span>${escapeHtml(profile.department)}</span>
              <span>${escapeHtml(profile.position_title)}</span>
            </div>
            <span class="badge ${profile.employment_status === "active" ? "approved" : profile.employment_status === "inactive" ? "pending" : "rejected"}">${escapeHtml(capitalize(profile.employment_status || "active"))}</span>
            <div class="employee-record-credit">${escapeHtml(formatCreditAmount(profile.leave_credits))} credits</div>
            <div class="table-actions">
              <button type="button" class="button button-muted" data-edit-employee="${profile.id}">Edit</button>
              <button type="button" class="button button-danger" data-delete-employee="${profile.id}">Delete</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;

    Array.from(container.querySelectorAll("[data-edit-employee]")).forEach((button) => {
      button.addEventListener("click", () => {
        const employeeId = Number(button.getAttribute("data-edit-employee"));
        const profile = adminEmployeeProfiles.find((item) => item.id === employeeId);
        if (profile) {
          populateEmployeeForm(profile);
        }
      });
    });

    Array.from(container.querySelectorAll("[data-delete-employee]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const employeeId = Number(button.getAttribute("data-delete-employee"));
        const profile = adminEmployeeProfiles.find((item) => item.id === employeeId);
        if (!profile) {
          return;
        }

        const confirmed = window.confirm(`Delete ${profile.first_name} ${profile.last_name}? This also removes the employee leave records.`);
        if (!confirmed) {
          return;
        }

        await deleteEmployeeAccount(employeeId);
      });
    });
  }

  function bindAdminEmployeeForm(adminId) {
    const form = document.getElementById("employee-management-form");
    const cancelButton = document.getElementById("employee-cancel-button");
    const addButton = document.getElementById("add-employee-button");
    const closeElements = Array.from(document.querySelectorAll("[data-close-employee-modal]"));

    if (!form) {
      return;
    }

    addButton?.addEventListener("click", () => {
      resetEmployeeForm();
      openEmployeeManagementModal("Add Employee");
    });

    closeElements.forEach((element) => {
      element.addEventListener("click", closeEmployeeManagementModal);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const employeeId = Number(formData.get("employeeRecordId") || 0);
      const payload = {
        admin_id: adminId,
        email: String(formData.get("email") || "").trim().toLowerCase(),
        first_name: String(formData.get("firstName") || "").trim(),
        middle_name: normalizeOptionalText(formData.get("middleName")),
        last_name: String(formData.get("lastName") || "").trim(),
        suffix: normalizeOptionalText(formData.get("suffix")),
        department: String(formData.get("department") || "").trim(),
        position_title: String(formData.get("positionTitle") || "").trim(),
        contact_no: normalizeOptionalText(formData.get("contactNo")),
        hire_date: normalizeOptionalText(formData.get("hireDate")),
        employment_status: String(formData.get("employmentStatus") || "active").trim(),
        leave_credits: Number(formData.get("leaveCredits") || 0),
        password: String(formData.get("password") || "")
      };

      if (!employeeId && !payload.password) {
        window.alert("Password is required when creating an employee.");
        return;
      }

      const finishSubmit = beginFormSubmit(form, employeeId ? "Updating..." : "Creating...");
      if (!finishSubmit) {
        return;
      }

      try {
        if (employeeId) {
          await updateEmployeeAccount(employeeId, payload);
          return;
        }

        await createEmployeeAccount(payload);
      } finally {
        finishSubmit();
      }
    });

    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        closeEmployeeManagementModal();
      });
    }
  }

  function openEmployeeManagementModal(title) {
    const modal = document.getElementById("employee-management-modal");
    if (!modal) {
      return;
    }

    setText("employee-modal-title", title || "Employee Management");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    document.getElementById("employee-email")?.focus();
  }

  function closeEmployeeManagementModal() {
    const modal = document.getElementById("employee-management-modal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    resetEmployeeForm();
  }

  function populateEmployeeForm(profile) {
    const form = document.getElementById("employee-management-form");
    if (!form) {
      return;
    }

    form.elements.employeeRecordId.value = profile.id || "";
    form.elements.email.value = profile.email || "";
    form.elements.firstName.value = profile.first_name || "";
    form.elements.middleName.value = profile.middle_name || "";
    form.elements.lastName.value = profile.last_name || "";
    form.elements.suffix.value = profile.suffix || "";
    form.elements.department.value = profile.department || "";
    form.elements.positionTitle.value = profile.position_title || "";
    form.elements.contactNo.value = profile.contact_no || "";
    form.elements.hireDate.value = profile.hire_date || "";
    form.elements.employmentStatus.value = profile.employment_status || "active";
    form.elements.leaveCredits.value = Number(profile.leave_credits || 0);
    form.elements.password.value = "";
    setText("employee-submit-button", "Update Employee");
    openEmployeeManagementModal("Update Employee");
    document.getElementById("employee-email")?.focus();
  }

  function resetEmployeeForm() {
    const form = document.getElementById("employee-management-form");
    if (!form) {
      return;
    }

    form.reset();
    form.elements.employeeRecordId.value = "";
    form.elements.employmentStatus.value = "active";
    form.elements.leaveCredits.value = 0;
    setText("employee-submit-button", "Create Employee");
  }

  async function createEmployeeAccount(payload) {
    const { error } = await db.rpc("create_employee", {
      p_admin_id: payload.admin_id,
      p_email: payload.email,
      p_password: payload.password,
      p_first_name: payload.first_name,
      p_middle_name: payload.middle_name,
      p_last_name: payload.last_name,
      p_suffix: payload.suffix,
      p_department: payload.department,
      p_position_title: payload.position_title,
      p_contact_no: payload.contact_no,
      p_hire_date: payload.hire_date,
      p_employment_status: payload.employment_status,
      p_leave_credits: payload.leave_credits
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    closeEmployeeManagementModal();
    await loadAdminProfiles();
    window.alert("Employee account created.");
  }

  async function updateEmployeeAccount(employeeId, payload) {
    const { error } = await db.rpc("update_employee", {
      p_employee_id: employeeId,
      p_email: payload.email,
      p_password: payload.password || null,
      p_first_name: payload.first_name,
      p_middle_name: payload.middle_name,
      p_last_name: payload.last_name,
      p_suffix: payload.suffix,
      p_department: payload.department,
      p_position_title: payload.position_title,
      p_contact_no: payload.contact_no,
      p_hire_date: payload.hire_date,
      p_employment_status: payload.employment_status,
      p_leave_credits: payload.leave_credits
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    closeEmployeeManagementModal();
    await loadAdminProfiles();
    window.alert("Employee account updated.");
  }

  async function deleteEmployeeAccount(employeeId) {
    const { error } = await db.rpc("delete_employee", {
      p_employee_id: employeeId
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    if (Number(document.getElementById("employee-record-id")?.value || 0) === employeeId) {
      resetEmployeeForm();
    }

    await loadAdminProfiles();
    window.alert("Employee account deleted.");
  }

  async function loadAdminRequests() {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await db.rpc("get_admin_leave_requests", {
      p_admin_id: session.userId
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    adminLeaveRequests = Array.isArray(data) ? data : [];

    const pending = adminLeaveRequests.filter((item) => item.status === "pending").length;
    const approved = adminLeaveRequests.filter((item) => item.status === "approved").length;
    const rejected = adminLeaveRequests.filter((item) => item.status === "rejected").length;

    setText("stat-admin-pending", String(pending));
    setText("stat-admin-approved", String(approved));
    setText("stat-admin-rejected", String(rejected));

    renderAdminRequestsTable(adminLeaveRequests);
    syncSelectedAdminRequest();
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
  }

  async function initStorageMonitoringPage() {
    bindSignOut();

    if (!db) {
      renderStorageDemo();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    const profile = await fetchAdminProfile(session.userId);
    if (!profile) {
      window.alert("Unable to load admin profile.");
      return;
    }

    const nameEl = document.getElementById("storage-page-name");
    const metaEl = document.getElementById("storage-page-meta");
    if (nameEl) nameEl.textContent = `Welcome, ${profile.first_name} ${profile.last_name}`;
    if (metaEl) metaEl.textContent = `${profile.department} | ${profile.position_title}`;

    await loadStorageInfo();
    initExportButton();
    initCleanupButton();
  }

  async function loadStorageInfo() {
    const container = document.getElementById("storage-table");
    if (!container) return;

    try {
      const { data, error } = await db.rpc("get_db_storage_info");
      if (error || !data) {
        container.innerHTML = '<p class="empty-state">Run the get_db_storage_info() function in your Supabase SQL Editor first (database/supabase-schema.sql).</p>';
        return;
      }

      const info = typeof data === "string" ? JSON.parse(data) : data;
      const tables = info.tables || [];
      const used = info.total_size_bytes || 0;
      const limit = 500 * 1024 * 1024;
      const pct = Math.min((used / limit) * 100, 100);

      const totalEl = document.getElementById("storage-total");
      if (totalEl) {
        totalEl.textContent = `${info.total_size || "0 B"} used (${pct.toFixed(1)}% of 500 MB)`;
      }

      const pctEl = document.getElementById("storage-bar-fill");
      if (pctEl) {
        pctEl.style.width = pct + "%";
      }

      container.innerHTML = `
        <div class="storage-table-list">
          <div class="storage-table-header">
            <span>Table</span>
            <span>Rows</span>
            <span>Size</span>
          </div>
          ${tables.map((t) => `
            <div class="storage-table-row">
              <span>${escapeHtml(t.table_name || "")}</span>
              <span>${String(t.row_count ?? 0)}</span>
              <span>${escapeHtml(t.size || "0 B")} (${formatBytes(t.size_bytes || 0)})</span>
            </div>
          `).join("")}
        </div>
      `;
    } catch {
      container.innerHTML = '<p class="empty-state">Failed to load storage information.</p>';
    }
  }

  function renderStorageDemo() {
    setText("storage-page-name", "Welcome, System Administrator");
    setText("storage-page-meta", "HR | Municipal Administrator");
    const totalEl = document.getElementById("storage-total");
    if (totalEl) totalEl.textContent = "Demo mode — connect Supabase to see real usage";
    const btn = document.getElementById("export-excel-button");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Demo — No Data";
    }
  }

  function initExportButton() {
    const btn = document.getElementById("export-excel-button");
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = "Download Excel";
    btn.addEventListener("click", downloadCreditExcel);
  }

  function initCleanupButton() {
    const btn = document.getElementById("cleanup-button");
    const resultEl = document.getElementById("cleanup-result");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);
      const cutoffDate = cutoff.toISOString().split("T")[0];

      const confirmed = window.confirm(
        `Delete all approved/rejected leave requests and deduction logs older than ${cutoffDate} (3 months)?\n\nEmployee records and current credit balances will NOT be affected. This cannot be undone.`
      );
      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = "Cleaning up...";

      try {
        const { data, error } = await db.rpc("cleanup_old_records", { p_cutoff_date: cutoffDate });
        if (error) {
          window.alert("Cleanup failed: " + (error.message || "Unknown error"));
          return;
        }

        const info = typeof data === "string" ? JSON.parse(data) : data;
        const msg = `Cleaned up: ${info.deleted_deduction_logs || 0} deduction log(s), ${info.deleted_leave_requests || 0} leave request(s).`;
        if (resultEl) resultEl.textContent = msg;
        await loadStorageInfo();
      } catch (err) {
        window.alert("Cleanup failed: " + (err?.message || "Unknown error"));
      } finally {
        btn.disabled = false;
        btn.textContent = "Clean Up Old Records";
      }
    });
  }

  function sanitizeSheetName(name) {
    const cleaned = String(name || "Employee").slice(0, 31);
    return cleaned.replace(/[*?:\[\]\\\/]/g, "");
  }

  async function downloadCreditExcel() {
    const btn = document.getElementById("export-excel-button");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Generating...";

    try {
      const { data, error } = await db.rpc("get_credit_export_data");
      if (error || !data) {
        window.alert("Failed to fetch credit data: " + (error?.message || "No data"));
        btn.disabled = false;
        btn.textContent = "Download Excel";
        return;
      }

      const info = typeof data === "string" ? JSON.parse(data) : data;
      const employees = info.employees || [];
      const deductions = info.deductions || [];

      if (!employees.length && !deductions.length) {
        window.alert("No employee or deduction data to export.");
        btn.disabled = false;
        btn.textContent = "Download Excel";
        return;
      }

      if (typeof XLSX === "undefined") {
        window.alert("Excel library not loaded. Try refreshing the page.");
        btn.disabled = false;
        btn.textContent = "Download Excel";
        return;
      }

      const wb = XLSX.utils.book_new();

      const dedByEmp = {};
      for (const d of deductions) {
        const key = d.employee_id || d.employee_no || d.employee_name || "unknown";
        if (!dedByEmp[key]) dedByEmp[key] = [];
        dedByEmp[key].push(d);
      }

      for (const emp of employees) {
        const empKey = emp.id || emp.employee_no;
        const empDeds = dedByEmp[empKey] || [];
        const fullName = [emp.last_name, emp.first_name].filter(Boolean).join(", ");
        const sheetName = sanitizeSheetName(fullName || emp.employee_no || "Employee");

        const aoa = [];

        aoa.push(["EMPLOYEE INFORMATION"]);
        aoa.push(["Employee No", emp.employee_no || ""]);
        aoa.push(["Name", fullName || ""]);
        aoa.push(["Department", emp.department || ""]);
        aoa.push(["Position", emp.position_title || ""]);
        aoa.push(["Status", emp.employment_status || ""]);
        aoa.push(["Leave Credits", emp.leave_credits ?? 0]);
        aoa.push([]);

        aoa.push(["DEDUCTION HISTORY"]);
        aoa.push(["Date", "Minutes Late", "Deduction", "Reason", "Before Credits", "After Credits"]);

        if (empDeds.length) {
          for (const d of empDeds) {
            aoa.push([
              d.created_at ? new Date(d.created_at).toLocaleDateString("en-PH") : "",
              d.minutes ?? 0,
              d.deduction ?? 0,
              d.reason || "",
              d.before_credits ?? 0,
              d.after_credits ?? 0
            ]);
          }
        } else {
          aoa.push(["No deduction records."]);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 32 }, { wch: 16 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const fileName = "Credit_Records_" + new Date().toISOString().split("T")[0] + ".xlsx";
      XLSX.writeFile(wb, fileName);

      btn.disabled = false;
      btn.textContent = "Download Excel";
    } catch (err) {
      window.alert("Export failed: " + (err?.message || "Unknown error"));
      btn.disabled = false;
      btn.textContent = "Download Excel";
    }
  }

  function renderAdminRequestsTable(data) {
    const container = document.getElementById("admin-requests-table");
    if (!container) {
      return;
    }

    if (!data.length) {
      container.innerHTML = '<p class="empty-state">No leave requests found.</p>';
      return;
    }

    container.innerHTML = `
      <div class="admin-request-card-grid">
        ${data.map((request) => `
          <article class="admin-request-card">
            <div class="admin-request-card-top">
              <span class="badge ${escapeHtml(getRequestStatusClass(request))}">${escapeHtml(getRequestTrackingLabel(request))}</span>
              <span class="admin-request-card-id">Request #${escapeHtml(String(request.id))}</span>
            </div>
            <h4>${escapeHtml(getApplicantFullName(request) || "Unnamed applicant")}</h4>
            <div class="admin-request-card-meta">${escapeHtml(formatLeaveType(request.leave_type))}</div>
            <div class="admin-request-card-meta">${escapeHtml(formatLeaveDateSummary(request))}</div>
            <div class="admin-request-card-meta">${escapeHtml(String(request.days_requested))} day(s)</div>
            <div class="table-actions">
              <button type="button" class="button button-muted" data-view-request="${request.id}">View</button>
              ${request.status === "pending" ? `
              <button type="button" class="button button-secondary" data-ai-analyze="${request.id}">AI</button>
              <button type="button" class="button button-success" data-update-request="${request.id}" data-status="approved">Approve</button>
              <button type="button" class="button button-danger" data-update-request="${request.id}" data-status="rejected">Reject</button>
              ` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    `;

    Array.from(container.querySelectorAll("[data-view-request]")).forEach((button) => {
      button.addEventListener("click", () => {
        const requestId = Number(button.getAttribute("data-view-request"));
        selectedAdminRequestId = requestId;
        openAdminRequestModal();
        renderSelectedAdminRequest();
      });
    });

    Array.from(container.querySelectorAll("[data-update-request]")).forEach((button) => {
      button.addEventListener("click", async () => {
        await runWithButtonLoading(button, "Processing...", async () => {
          const requestId = Number(button.getAttribute("data-update-request"));
          const status = button.getAttribute("data-status");
          selectedAdminRequestId = requestId;
          await updateLeaveStatus(requestId, status);
        });
      });
    });

    Array.from(container.querySelectorAll("[data-ai-analyze]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const requestId = Number(button.getAttribute("data-ai-analyze"));
        selectedAdminRequestId = requestId;
        openAdminRequestModal();
        await renderSelectedAdminRequest();
        await runAIAnalysis(requestId);
      });
    });
  }

  function syncSelectedAdminRequest() {
    if (!adminLeaveRequests.length) {
      selectedAdminRequestId = null;
      closeAdminRequestModal();
      renderSelectedAdminRequest();
      return;
    }

    const selectedRequestExists = adminLeaveRequests.some((request) => request.id === selectedAdminRequestId);
    if (selectedAdminRequestId !== null && !selectedRequestExists) {
      selectedAdminRequestId = adminLeaveRequests[0].id;
    }

    if (adminRequestModalOpen) {
      renderSelectedAdminRequest();
    }
  }

  function renderSelectedAdminRequest() {
    const container = document.getElementById("admin-request-preview");
    if (!container) {
      return;
    }

    const request = adminLeaveRequests.find((item) => item.id === selectedAdminRequestId);
    if (!request) {
      container.innerHTML = '<p class="empty-state">Select a leave request to view the full application form.</p>';
      return;
    }

    container.innerHTML = buildAdminRequestPreviewMarkup(request);

    container.querySelector("[data-admin-print-request]")?.addEventListener("click", () => {
      printAdminLeaveRequest(request);
    });

    container.querySelector("[data-admin-download-word]")?.addEventListener("click", () => {
      downloadAdminLeaveRequestWord(request);
    });

    const adminRequestForm = container.querySelector("[data-admin-request-form]");
    bindAdminRequestActionFields(adminRequestForm);

    container.querySelector("[data-admin-save-request]")?.addEventListener("click", async (event) => {
      await runWithButtonLoading(event.currentTarget, "Saving...", async () => {
        await saveAdminRequestDetails(request.id, adminRequestForm);
      });
    });

    container.querySelector("[data-admin-ai-analyze]")?.addEventListener("click", async (event) => {
      const requestId = Number(event.currentTarget.getAttribute("data-admin-ai-analyze"));
      await runAIAnalysis(requestId);
    });

    container.querySelector("[data-admin-approve-request]")?.addEventListener("click", async (event) => {
      await runWithButtonLoading(event.currentTarget, "Approving...", async () => {
        if (adminRequestForm) {
          const recommendationApproved = adminRequestForm.querySelector('input[name="recommendation"][value="approved"]');
          if (recommendationApproved) {
            recommendationApproved.checked = true;
          }

          const saved = await saveAdminRequestDetails(request.id, adminRequestForm, { silent: true });
          if (!saved) {
            return;
          }
        }

        await updateLeaveStatus(request.id, "approved");
      });
    });

    container.querySelector("[data-admin-reject-request]")?.addEventListener("click", async (event) => {
      await runWithButtonLoading(event.currentTarget, "Rejecting...", async () => {
        if (adminRequestForm) {
          const recommendationRejected = adminRequestForm.querySelector('input[name="recommendation"][value="rejected"]');
          if (recommendationRejected) {
            recommendationRejected.checked = true;
          }

          const saved = await saveAdminRequestDetails(request.id, adminRequestForm, { silent: true });
          if (!saved) {
            return;
          }
        }

        await updateLeaveStatus(request.id, "rejected");
      });
    });
  }

  function openAdminRequestModal() {
    const modal = document.getElementById("admin-request-modal");
    if (!modal) {
      return;
    }

    adminRequestModalOpen = true;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    Array.from(modal.querySelectorAll("[data-close-admin-modal]")).forEach((element) => {
      element.onclick = () => closeAdminRequestModal();
    });
  }

  function closeAdminRequestModal() {
    const modal = document.getElementById("admin-request-modal");
    if (!modal) {
      return;
    }

    adminRequestModalOpen = false;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function bindAdminRequestActionFields(form) {
    if (!form) {
      return;
    }

    const recommendationInputs = Array.from(form.querySelectorAll('input[name="recommendation"]'));
    const disapprovalTextarea = form.querySelector('textarea[name="disapprovalDetails"]');
    const syncDisapprovalAccess = () => {
      const selectedRecommendation = recommendationInputs.find((input) => input.checked)?.value || "";
      const canEditDisapproval = selectedRecommendation === "rejected";
      if (disapprovalTextarea) {
        disapprovalTextarea.disabled = !canEditDisapproval;
        disapprovalTextarea.setAttribute("aria-disabled", canEditDisapproval ? "false" : "true");
        if (!canEditDisapproval) {
          disapprovalTextarea.value = "";
        }
      }
    };

    recommendationInputs.forEach((input) => input.addEventListener("change", syncDisapprovalAccess));
    syncDisapprovalAccess();
  }

  async function updateLeaveStatus(requestId, status) {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return;
    }

    if (status === "approved") {
      const request = adminLeaveRequests.find((item) => item.id === requestId);
      if (request) {
        const leaveTypes = getLeaveTypes(request.leave_type);
        const creditDeductingTypes = leaveTypes.filter((t) =>
          ["vacation", "sick", "mandatory-forced", "wellness"].includes(t)
        );
        if (creditDeductingTypes.length > 0) {
          const employee = getAdminEmployeeProfileById(request.employee_id);
          if (employee) {
            let freeDays = 0;
            if (leaveTypes.includes("mandatory-forced")) freeDays = 5;
            if (leaveTypes.includes("wellness")) freeDays = Math.max(freeDays, 5);
            const effectiveDays = Math.max(Number(request.days_requested || 0) - freeDays, 0);
            const currentCredits = Number(employee.leave_credits || 0);
            if (effectiveDays > currentCredits) {
              window.alert(
                "Insufficient leave credits. " + getApplicantFullName(request) +
                " has " + formatCreditAmount(currentCredits) +
                " credit(s) but this request requires " + effectiveDays + " day(s)."
              );
              return;
            }
          }
        }
      }
    }

    const { error } = await db.rpc("update_leave_request_status", {
      p_admin_id: session.userId,
      p_request_id: requestId,
      p_status: status
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    await loadAdminRequests();
  }

  async function runAIAnalysis(requestId) {
    const apiKey = getGrokApiKey();
    if (!apiKey) {
      window.alert("Grok API key is not configured. Ask the developer to set GROK_CONFIG.apiKey in assets/js/supabase-config.js.");
      return;
    }

    const request = adminLeaveRequests.find((item) => item.id === requestId);
    if (!request) {
      return;
    }

    const panel = document.getElementById(`ai-analysis-panel-${requestId}`);
    if (!panel) {
      return;
    }

    panel.classList.remove("hidden");
    panel.innerHTML = `<div class="ai-analysis-loading"><span class="ai-spinner"></span><span>Consulting Grok AI...</span></div>`;

    const employee = getAdminEmployeeProfileById(request.employee_id);
    const leaveTypes = getLeaveTypes(request.leave_type);
    const leaveTypeNames = leaveTypes.map((t) => leaveTypeLabels[t] || t).join(", ");
    const creditDeductingTypes = leaveTypes.filter((t) =>
      ["vacation", "sick", "mandatory-forced", "wellness"].includes(t)
    );
    let effectiveDays = Number(request.days_requested || 0);
    let freeDays = 0;
    if (leaveTypes.includes("mandatory-forced")) freeDays = 5;
    if (leaveTypes.includes("wellness")) freeDays = Math.max(freeDays, 5);
    effectiveDays = Math.max(effectiveDays - freeDays, 0);
    const currentCredits = Number(employee?.leave_credits || 0);
    const hasSufficientCredits = creditDeductingTypes.length === 0 || effectiveDays <= currentCredits;

    const systemPrompt = `You are an expert HR leave approval decision support assistant for a Philippine local government unit (Agdangan, Quezon). Your role is to analyze leave requests and provide a recommendation with reasoning.

Consider these Philippine leave policies:
- Vacation/Sick leave: deducted from employee's leave credit balance (monthly accrual: 1.25 credits/month)
- Mandatory/Forced Leave: 5 free days per year, remaining days deducted from vacation leave credits
- Wellness Leave: 5 free days per year, remaining days deducted from sick leave credits
- Maternity: 105 days (R.A. 11210), Paternity: 7 days (R.A. 8187)
- Special Privilege Leave: 3 days, Solo Parent: 7 days (R.A. 8972)
- Study Leave, VAWC Leave (10 days), Rehabilitation Privilege, Special Benefits for Women, Special Emergency (Calamity) Leave, Adoption Leave
- Commutation (cash conversion) may be requested or not requested
- The employee must have sufficient leave credits for credit-deducting leave types

Respond in valid JSON only, with this exact structure:
{
  "recommendation": "approve" | "reject" | "review",
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation>",
  "policy_considerations": ["<point 1>", "<point 2>"]
}`;

    const userPrompt = `Please analyze this leave request:

Employee: ${getApplicantFullName(request) || "Unknown"}
Department: ${request.office_department || "N/A"}
Position: ${request.position_title || "N/A"}
Leave Type(s): ${leaveTypeNames}
Days Requested: ${request.days_requested}
Free Days (policy): ${freeDays}
Effective Deduction Days: ${effectiveDays}
Start Date: ${request.start_date || "N/A"}
End Date: ${request.end_date || "N/A"}
Reason: ${request.reason || "N/A"}
Commutation: ${request.commutation || "not-requested"}
Current Leave Credits: ${formatCreditAmount(currentCredits)}${creditDeductingTypes.length > 0 ? "" : " (non-credit leave type)"}
Sufficient Credits: ${hasSufficientCredits ? "Yes" : "No"}`;

    try {
      const result = await callGrokAPI(systemPrompt, userPrompt, apiKey);
      renderAIAnalysisResult(panel, request, result);
    } catch (err) {
      panel.innerHTML = `<div class="ai-analysis-error">AI analysis failed: ${escapeHtml(err.message || "Unknown error")}</div>`;
    }
  }

  async function callGrokAPI(systemPrompt, userPrompt, apiKey) {
    const response = await fetch(grokApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: grokModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`API error ${response.status}: ${errBody || response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(content);
  }

  function renderAIAnalysisResult(panel, request, result) {
    const recommendation = String(result.recommendation || "review").toLowerCase();
    const confidence = Math.min(Math.max(Number(result.confidence) || 0, 0), 100);
    const reasoning = String(result.reasoning || "");
    const considerations = Array.isArray(result.policy_considerations) ? result.policy_considerations : [];

    const recLabel = recommendation === "approve" ? "Approve" : recommendation === "reject" ? "Reject" : "Manual Review";
    const recClass = recommendation === "approve" ? "ai-approve" : recommendation === "reject" ? "ai-reject" : "ai-review";
    const confidenceColor = confidence >= 70 ? "var(--success)" : confidence >= 40 ? "#e6a817" : "var(--danger)";

    panel.innerHTML = `
      <div class="ai-analysis-result ${recClass}">
        <div class="ai-analysis-header">
          <span class="ai-badge">AI Decision Support</span>
          <span class="ai-powered">Powered by Grok</span>
        </div>
        <div class="ai-analysis-body">
          <div class="ai-recommendation">
            <span class="ai-rec-label">Recommendation</span>
            <strong class="ai-rec-value">${recLabel}</strong>
            <span class="ai-confidence" style="--confidence-color: ${confidenceColor}">
              ${confidence}% confident
            </span>
          </div>
          <div class="ai-reasoning">
            <span class="ai-rec-label">Reasoning</span>
            <p>${escapeHtml(reasoning)}</p>
          </div>
          ${considerations.length ? `
          <div class="ai-considerations">
            <span class="ai-rec-label">Policy Considerations</span>
            <ul>
              ${considerations.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          </div>` : ""}
        </div>
        <div class="ai-analysis-footer">
          <small>This is a suggestion only. Final decision is at your discretion.</small>
        </div>
      </div>
    `;
  }

  function bindChangePasswordForm() {
    const form = document.querySelector("[data-change-password-form]");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!db) {
        window.alert("Supabase is not configured yet. Update assets/js/supabase-config.js first.");
        return;
      }

      const session = getSession();
      if (!session || !session.role || !session.userId) {
        window.location.href = "/login";
        return;
      }

      const formData = new FormData(form);
      const currentPassword = String(formData.get("currentPassword") || "");
      const newPassword = String(formData.get("newPassword") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (newPassword.length < 8) {
        window.alert("New password must be at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        window.alert("New password and confirmation do not match.");
        return;
      }

      const finishSubmit = beginFormSubmit(form, "Updating...");
      if (!finishSubmit) {
        return;
      }

      try {
        const { data, error } = await db.rpc("change_own_password", {
          p_role: "employee",
          p_user_id: session.userId,
          p_current_password: currentPassword,
          p_new_password: newPassword
        });

        if (error) {
          window.alert(error.message);
          return;
        }

        if (data !== true) {
          window.alert("Current password is incorrect.");
          return;
        }

        form.reset();
        window.alert("Password updated.");
      } finally {
        finishSubmit();
      }
    });
  }

  async function saveAdminRequestDetails(requestId, form, options = {}) {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "/login";
      return false;
    }

    if (!form) {
      return false;
    }

    const reload = options.reload !== false;
    const silent = options.silent === true;
    const formData = new FormData(form);
    const daysRequested = Number.parseInt(String(formData.get("daysRequested") || "0"), 10);

    if (!Number.isInteger(daysRequested) || daysRequested <= 0) {
      window.alert("Working days must be a whole number greater than zero.");
      return false;
    }

    const parseOptionalNumber = (value, integerOnly = false) => {
      const text = String(value || "").trim();
      if (!text) {
        return null;
      }

      const parsed = integerOnly ? Number.parseInt(text, 10) : Number(text);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const existingRequest = adminLeaveRequests.find((item) => item.id === requestId);
    if (!existingRequest) {
      return false;
    }

    const readTextField = (fieldName, fallback = "") => {
      if (!formData.has(fieldName)) {
        return String(fallback || "").trim();
      }

      return String(formData.get(fieldName) || "").trim();
    };

    const readDateField = (fieldName, fallback = null) => {
      if (!formData.has(fieldName)) {
        return fallback || null;
      }

      return String(formData.get(fieldName) || "") || null;
    };

    const readArrayField = (fieldName, fallback = []) => {
      if (!formData.has(fieldName)) {
        return Array.isArray(fallback) ? fallback : [];
      }

      return formData.getAll(fieldName).map((value) => String(value));
    };

    const selectedLeaveDates = Array.isArray(existingRequest?.selected_leave_dates) ? existingRequest.selected_leave_dates : [];
    const recommendation = readTextField("recommendation", existingRequest.recommendation) || null;

    const payload = {
      p_admin_id: session.userId,
      p_request_id: requestId,
      p_leave_type: readTextField("leaveType", existingRequest.leave_type),
      p_office_department: readTextField("officeDepartment", existingRequest.office_department),
      p_applicant_last_name: readTextField("applicantLastName", existingRequest.applicant_last_name),
      p_applicant_first_name: readTextField("applicantFirstName", existingRequest.applicant_first_name),
      p_applicant_middle_name: readTextField("applicantMiddleName", existingRequest.applicant_middle_name),
      p_filing_date: readDateField("filingDate", existingRequest.filing_date),
      p_position_title: readTextField("positionTitle", existingRequest.position_title),
      p_salary_display: readTextField("salaryDisplay", existingRequest.salary_display),
      p_start_date: readDateField("startDate", existingRequest.start_date),
      p_end_date: readDateField("endDate", existingRequest.end_date),
      p_selected_leave_dates: selectedLeaveDates,
      p_days_requested: daysRequested || Number(existingRequest.days_requested || 0),
      p_other_leave_details: readTextField("otherLeaveDetails", existingRequest.other_leave_details),
      p_vacation_location: readArrayField("leaveLocation", existingRequest.vacation_location),
      p_vacation_location_notes: existingRequest.vacation_location_notes || {},
      p_sick_leave_details: readArrayField("sickDetail", existingRequest.sick_leave_details),
      p_sick_leave_notes: existingRequest.sick_leave_notes || {},
      p_leave_purpose_details: readArrayField("leavePurpose", existingRequest.leave_purpose_details),
      p_leave_purpose_notes: existingRequest.leave_purpose_notes || {},
      p_commutation: readTextField("commutation", existingRequest.commutation),
      p_reason: readTextField("reason", existingRequest.reason),
      p_credit_as_of: readDateField("creditAsOf", existingRequest.credit_as_of),
      p_credit_earned_vacation: parseOptionalNumber(formData.get("creditEarnedVacation")) ?? existingRequest.credit_earned_vacation,
      p_credit_earned_sick: parseOptionalNumber(formData.get("creditEarnedSick")) ?? existingRequest.credit_earned_sick,
      p_credit_balance_vacation: parseOptionalNumber(formData.get("creditBalanceVacation")) ?? existingRequest.credit_balance_vacation,
      p_credit_balance_sick: parseOptionalNumber(formData.get("creditBalanceSick")) ?? existingRequest.credit_balance_sick,
      p_recommendation: recommendation,
      p_recommendation_details: readTextField("recommendationDetails", existingRequest.recommendation_details),
      p_recommendation_officer_name: readTextField("recommendationOfficerName", existingRequest.recommendation_officer_name),
      p_approved_with_pay_days: parseOptionalNumber(formData.get("approvedWithPayDays"), true),
      p_approved_without_pay_days: parseOptionalNumber(formData.get("approvedWithoutPayDays"), true),
      p_approved_other_details: readTextField("approvedOtherDetails", existingRequest.approved_other_details),
      p_approval_authorized_official_name: readTextField("approvalAuthorizedOfficialName", existingRequest.approval_authorized_official_name),
      p_disapproval_details: recommendation === "rejected" ? readTextField("disapprovalDetails", existingRequest.disapproval_details) : ""
    };

    const { error } = await db.rpc("update_leave_request_details", payload);

    if (error) {
      window.alert(error.message);
      return false;
    }

    if (reload) {
      selectedAdminRequestId = requestId;
      await loadAdminRequests();
    } else {
      const updatedRequest = adminLeaveRequests.find((item) => item.id === requestId);
      if (updatedRequest) {
        Object.assign(updatedRequest, {
          leave_type: payload.p_leave_type,
          office_department: payload.p_office_department,
          applicant_last_name: payload.p_applicant_last_name,
          applicant_first_name: payload.p_applicant_first_name,
          applicant_middle_name: payload.p_applicant_middle_name,
          filing_date: payload.p_filing_date,
          position_title: payload.p_position_title,
          salary_display: payload.p_salary_display,
          start_date: payload.p_start_date,
          end_date: payload.p_end_date,
          selected_leave_dates: payload.p_selected_leave_dates,
          days_requested: payload.p_days_requested,
          other_leave_details: payload.p_other_leave_details,
          vacation_location: payload.p_vacation_location,
          sick_leave_details: payload.p_sick_leave_details,
          leave_purpose_details: payload.p_leave_purpose_details,
          commutation: payload.p_commutation,
          reason: payload.p_reason,
          credit_as_of: payload.p_credit_as_of,
          credit_earned_vacation: payload.p_credit_earned_vacation,
          credit_earned_sick: payload.p_credit_earned_sick,
          credit_balance_vacation: payload.p_credit_balance_vacation,
          credit_balance_sick: payload.p_credit_balance_sick,
          recommendation: payload.p_recommendation,
          recommendation_details: payload.p_recommendation_details,
          recommendation_officer_name: payload.p_recommendation_officer_name,
          approved_with_pay_days: payload.p_approved_with_pay_days,
          approved_without_pay_days: payload.p_approved_without_pay_days,
          approved_other_details: payload.p_approved_other_details,
          approval_authorized_official_name: payload.p_approval_authorized_official_name,
          disapproval_details: payload.p_disapproval_details
        });
      }
    }

    if (!silent) {
      window.alert("Leave form changes saved.");
    }

    return true;
  }

  function buildAdminRequestPreviewMarkup(request) {
    return `
      <div class="admin-request-toolbar">
        <div>
          <strong>${escapeHtml(getApplicantFullName(request) || "Unnamed applicant")}</strong>
          <div class="muted">Request #${escapeHtml(String(request.id))} | ${escapeHtml(getRequestTrackingLabel(request))}</div>
        </div>
        <div class="table-actions">
          <button type="button" class="button button-muted" data-admin-print-request>Print / Save PDF</button>
          <button type="button" class="button button-muted" data-admin-download-word>Download Word</button>
          <button type="button" class="button button-muted" data-admin-save-request>Save</button>
          ${request.status === "pending" ? `
          <button type="button" class="button button-secondary" data-admin-ai-analyze="${request.id}">AI Analysis</button>
          <button type="button" class="button button-success" data-admin-approve-request>Approve</button>
          <button type="button" class="button button-danger" data-admin-reject-request>Reject</button>
          ` : ""}
        </div>
      </div>
      ${buildAdminRequestPaperMarkup(request)}
      <div id="ai-analysis-panel-${request.id}" class="ai-analysis-panel hidden">
        <div class="ai-analysis-loading">
          <span class="ai-spinner"></span>
          <span>Consulting Grok AI...</span>
        </div>
      </div>
    `;
  }

  function buildAdminRequestPaperMarkup(request) {
    const leaveTypes = getLeaveTypes(request.leave_type);
    const vacationLocations = Array.isArray(request.vacation_location) ? request.vacation_location : [];
    const sickDetails = Array.isArray(request.sick_leave_details) ? request.sick_leave_details : [];
    const leavePurposeDetails = Array.isArray(request.leave_purpose_details) ? request.leave_purpose_details : [];
    const selectedLeaveDates = getSelectedLeaveDates(request);
    const vacationLocationNotes = request.vacation_location_notes && typeof request.vacation_location_notes === "object" ? request.vacation_location_notes : {};
    const sickLeaveNotes = request.sick_leave_notes && typeof request.sick_leave_notes === "object" ? request.sick_leave_notes : {};
    const leavePurposeNotes = request.leave_purpose_notes && typeof request.leave_purpose_notes === "object" ? request.leave_purpose_notes : {};
    const creditSnapshot = buildLeaveCreditSnapshot(request);
    const shouldShowCreditComputation = String(request.commutation || "") === "requested";
    const creditCells = shouldShowCreditComputation
      ? buildCreditCellValues(request, creditSnapshot)
      : buildBlankCreditCellValues();
    const recommendationDetails = getRecommendationDetailsDisplay(request.recommendation_details);
    const approvedOtherDetails = getApprovedOtherDetailsDisplay(request.approved_other_details);
    const recommendationOfficerName = request.recommendation_officer_name || "";
    const approvalAuthorizedOfficialName = request.approval_authorized_official_name || "HON. RHADAM PADILLA AGUILAR, MUN. MAYOR";
    const approvedWithPayDays = normalizeApprovalDayDisplay(request.approved_with_pay_days);
    const approvedWithoutPayDays = normalizeApprovalDayDisplay(request.approved_without_pay_days);

    return `
      <form class="leave-paper admin-request-paper" data-admin-request-form="${escapeAttribute(String(request.id))}">
        <div class="leave-paper-topline">
          <div class="leave-paper-form-series">
            <p class="leave-paper-note">Civil Service Form No. 6</p>
            <p class="leave-paper-note">Revised 2020</p>
          </div>
          <div class="leave-paper-stamp">Stamp of Date of Receipt</div>
        </div>

        <div class="leave-paper-heading-grid">
          <div class="leave-paper-seal-wrap">
            <img src="/assets/images/agdangan-seal.webp" alt="Agdangan seal" class="leave-paper-seal">
          </div>
          <div class="leave-paper-heading">
            <p class="leave-paper-government">Republic of the Philippines</p>
            <p class="leave-paper-government">MGO Agdangan</p>
            <p class="leave-paper-government">Agdangan, Quezon</p>
            <h3>Application for Leave</h3>
          </div>
          <div class="leave-paper-heading-spacer" aria-hidden="true"></div>
        </div>

        <div class="leave-paper-form">
          <div class="leave-paper-row">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">1. Office / Department</span>
              <div class="leave-paper-readonly leave-paper-readonly-single-line">${escapeHtml(request.office_department || "")}</div>
            </div>
            <div class="leave-paper-cell">
              <div class="leave-paper-name-header">
                <span class="leave-paper-label">2. Name:</span>
                <div class="leave-paper-inline-captions" aria-hidden="true">
                  <span>(Last)</span>
                  <span>(First)</span>
                  <span>(Middle)</span>
                </div>
              </div>
              <div class="leave-paper-inline-fields">
                <div class="leave-paper-inline-line leave-paper-inline-line-single">${escapeHtml(request.applicant_last_name || "")}</div>
                <div class="leave-paper-inline-line leave-paper-inline-line-single">${escapeHtml(request.applicant_first_name || "")}</div>
                <div class="leave-paper-inline-line leave-paper-inline-line-single">${escapeHtml(request.applicant_middle_name || "")}</div>
              </div>
            </div>
          </div>

          <div class="leave-paper-row leave-paper-row-compact">
            <div class="leave-paper-cell leave-paper-cell-inline">
              <span class="leave-paper-label">3. Date of Filing</span>
              <div class="leave-paper-readonly">${escapeHtml(formatDateDisplay(request.filing_date))}</div>
            </div>
            <div class="leave-paper-cell leave-paper-cell-inline">
              <span class="leave-paper-label">4. Position</span>
              <div class="leave-paper-readonly">${escapeHtml(request.position_title || "")}</div>
            </div>
            <div class="leave-paper-cell leave-paper-cell-inline">
              <span class="leave-paper-label">5. Salary</span>
              <div class="leave-paper-readonly">${escapeHtml(request.salary_display || "N/A")}</div>
            </div>
          </div>

          <div class="leave-paper-section-title">6. Details of Application</div>

          <div class="leave-paper-panel-grid">
            <fieldset class="leave-paper-panel">
              <legend>6.A Type of Leave to Be Availed Of</legend>
              <div class="leave-type-grid">
                ${leavePaperTypeOptions.map(([value, label, reference]) => renderLeavePaperLeaveTypeOption(value, label, reference, leaveTypes.includes(value), true)).join("")}
              </div>
              <div class="leave-paper-other-line">
                <span>Others:</span>
                <div class="leave-paper-readonly">${escapeHtml(request.other_leave_details || "")}</div>
              </div>
            </fieldset>

            <fieldset class="leave-paper-panel">
              <legend>6.B Details of Leave</legend>
              <div class="leave-paper-subgroup">
                <p>In case of Vacation / Special Privilege Leave:</p>
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOptionDisplay("Within the Philippines", vacationLocations.includes("within-ph"), vacationLocationNotes["within-ph"])}
                  ${renderLeavePaperOptionDisplay("Abroad (Specify)", vacationLocations.includes("abroad"), vacationLocationNotes.abroad)}
                </div>
              </div>

              <div class="leave-paper-subgroup">
                <p>In case of Sick Leave:</p>
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOptionDisplay("In Hospital (Specify Illness)", sickDetails.includes("in-hospital"), sickLeaveNotes["in-hospital"])}
                  ${renderLeavePaperOptionDisplay("Out Patient (Specify Illness)", sickDetails.includes("out-patient"), sickLeaveNotes["out-patient"])}
                </div>
              </div>

              <div class="leave-paper-subgroup">
                <p>In case of Special Leave Benefits for Women:</p>
                <div class="leave-paper-bullets">
                  <div class="leave-paper-detail-option leave-paper-detail-option-static">
                    <span>(Specify Illness)</span>
                    <span class="leave-paper-detail-line leave-paper-detail-line-readonly">${escapeHtml(leavePurposeNotes["women-illness"] || "")}</span>
                  </div>
                </div>
              </div>

              <div class="leave-paper-subgroup">
                <p>In case of Study Leave:</p>
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOptionInput("checkbox", "leavePurpose", "masters-completion", "Completion of Master's Degree", leavePurposeDetails.includes("masters-completion"), true)}
                  ${renderLeavePaperOptionInput("checkbox", "leavePurpose", "bar-review", "BAR/Board Examination Review", leavePurposeDetails.includes("bar-review"), true)}
                </div>
              </div>

              <div class="leave-paper-subgroup">
                <p>Other purpose:</p>
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOptionInput("checkbox", "leavePurpose", "monetization", "Monetization of Leave Credits", leavePurposeDetails.includes("monetization"), true)}
                  ${renderLeavePaperOptionInput("checkbox", "leavePurpose", "terminal", "Terminal Leave", leavePurposeDetails.includes("terminal"), true)}
                </div>
              </div>

            </fieldset>
          </div>

          <div class="leave-paper-row leave-paper-row-detail">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">6.C Number of Working Days Applied For</span>
              <div class="leave-paper-tight-field">
                <div class="leave-paper-readonly">${escapeHtml(String(request.days_requested || ""))}</div>
              </div>
              <div class="leave-paper-subline-group">
                <label>Inclusive Dates</label>
                <div class="leave-paper-date-range">
                  <div class="leave-paper-readonly leave-paper-readonly-centered">${escapeHtml(formatDateDisplay(request.start_date))}</div>
                  <div class="leave-paper-readonly leave-paper-readonly-centered">${escapeHtml(formatDateDisplay(request.end_date))}</div>
                </div>
                ${selectedLeaveDates.length ? `<div class="leave-paper-readonly">${escapeHtml(formatSelectedLeaveDates(selectedLeaveDates))}</div>` : ""}
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">6.D Commutation</span>
              <div class="leave-paper-bullets">
                ${renderLeavePaperOptionInput("radio", "commutation", "not-requested", "Not Requested", request.commutation === "not-requested", true)}
                ${renderLeavePaperOptionInput("radio", "commutation", "requested", "Requested", request.commutation === "requested", true)}
              </div>
              <div class="leave-paper-signature">
                <div class="leave-paper-line">${escapeHtml(getApplicantFullName(request) || "")}</div>
                <span>(Signature of Applicant)</span>
              </div>
            </div>
          </div>

          <div class="leave-paper-section-title">7. Action on Application</div>

          <div class="leave-paper-row leave-paper-row-action">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.A Certification of Leave Credits</span>
              <div class="leave-paper-credit-note">As of <span class="leave-paper-credit-line">${shouldShowCreditComputation ? escapeHtml(formatDateDisplay(creditSnapshot.creditAsOf)) : ""}</span></div>
              <table class="leave-paper-credit-table" aria-label="Leave credits certification">
                <thead>
                  <tr>
                    <th></th>
                    <th>Vacation Leave</th>
                    <th>Sick Leave</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Earned</td>
                    <td>${escapeHtml(creditCells.vacation.current)}</td>
                    <td>${escapeHtml(creditCells.sick.current)}</td>
                  </tr>
                  <tr>
                    <td>Less this application</td>
                    <td>${escapeHtml(creditCells.vacation.deduction)}</td>
                    <td>${escapeHtml(creditCells.sick.deduction)}</td>
                  </tr>
                  <tr>
                    <td>Balance</td>
                    <td>${escapeHtml(creditCells.vacation.balance)}</td>
                    <td>${escapeHtml(creditCells.sick.balance)}</td>
                  </tr>
                </tbody>
              </table>
              <div class="leave-paper-officer">
                <div class="leave-paper-line">SHERIL Q. BRIONES, HRMO</div>
                <span>(Authorized Officer)</span>
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.B Recommendation</span>
              <div class="leave-paper-action-box">
                <div class="leave-paper-bullets">
                ${renderLeavePaperOptionInput("radio", "recommendation", "approved", "For approval", request.recommendation === "approved" || request.status === "approved")}
                ${renderLeavePaperOptionInput("radio", "recommendation", "rejected", "For disapproval due to", request.recommendation === "rejected" || request.status === "rejected")}
                </div>
                <div class="leave-paper-action-writing">
                  ${renderStaticWritingLines(recommendationDetails, 3)}
                  <input type="hidden" name="recommendationDetails" value="${escapeAttribute(recommendationDetails)}">
                </div>
              </div>
              <div class="leave-paper-officer">
                <div class="leave-paper-line">${escapeHtml(recommendationOfficerName)}</div>
                <span>(Authorized Officer)</span>
              </div>
            </div>
          </div>

          <div class="leave-paper-row leave-paper-row-bottom">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.C Approved For</span>
              <div class="leave-paper-approval-lines">
                <label class="leave-paper-approval-item"><input class="leave-paper-input leave-paper-approval-input" type="number" min="0" step="1" name="approvedWithPayDays" value="${escapeAttribute(approvedWithPayDays)}"> days with pay</label>
                <label class="leave-paper-approval-item"><input class="leave-paper-input leave-paper-approval-input" type="number" min="0" step="1" name="approvedWithoutPayDays" value="${escapeAttribute(approvedWithoutPayDays)}"> days without pay</label>
                <label class="leave-paper-approval-item"><input class="leave-paper-input leave-paper-approval-input leave-paper-approval-wide" type="text" name="approvedOtherDetails" placeholder="Specify other approval" value="${escapeAttribute(approvedOtherDetails)}"> others (Specify)</label>
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.D Disapproved Due To</span>
              <div class="leave-paper-action-box">
                <div class="leave-paper-action-writing">
                  <textarea class="leave-paper-action-textarea" name="disapprovalDetails" rows="3">${escapeHtml(request.disapproval_details || "")}</textarea>
                </div>
              </div>
            </div>
            <div class="leave-paper-authorized leave-paper-authorized-wide">
              <div class="leave-paper-line">${escapeHtml(approvalAuthorizedOfficialName)}</div>
              <span>(Authorized Official)</span>
            </div>
          </div>
        </div>
        <input type="hidden" name="daysRequested" value="${escapeAttribute(String(request.days_requested || ""))}">
      </form>
    `;
  }

  function renderLeavePaperOptionInput(type, name, value, label, isChecked, isDisabled = false) {
    return `
      <label class="leave-option">
        <input type="${type}" name="${escapeAttribute(name)}" value="${escapeAttribute(value)}" ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderLeavePaperLeaveTypeOption(value, label, reference, isChecked, isDisabled = false) {
    return `
      <label class="leave-option leave-type-option">
        <input type="checkbox" name="leaveType" value="${escapeAttribute(value)}" ${isChecked ? "checked" : ""} ${isDisabled ? "disabled" : ""}>
        <span>${escapeHtml(label)} <small>${escapeHtml(reference)}</small></span>
      </label>
    `;
  }

  function getRecommendationDetailsDisplay(value) {
    const text = String(value || "").trim();
    return text.startsWith("Month-end accrual rate: 1.25 credit. Approved leave is deducted immediately.")
      ? ""
      : text;
  }

  function getApprovedOtherDetailsDisplay(value) {
    const text = String(value || "").trim();
    return text === "Approved absent days were deducted immediately from the current balance."
      ? ""
      : text;
  }

  function renderLeavePaperOptionDisplay(label, isChecked, note) {
    return `
      <label class="leave-option leave-paper-detail-option">
        <input type="checkbox" ${isChecked ? "checked" : ""} disabled>
        <span>${escapeHtml(label)}</span>
        <span class="leave-paper-detail-line leave-paper-detail-line-readonly">${escapeHtml(note || "")}</span>
      </label>
    `;
  }

  function renderStaticWritingLines(content, lineCount) {
    const text = String(content || "").trim();
    if (!text) {
      return Array.from({ length: lineCount }, () => '<div class="leave-paper-action-line"></div>').join("");
    }

    const lines = text.split(/\n+/).slice(0, lineCount);
    while (lines.length < lineCount) {
      lines.push("");
    }

    return lines.map((line) => `<div class="leave-paper-action-line">${escapeHtml(line)}</div>`).join("");
  }

  function printAdminLeaveRequest(request) {
    const printWindow = window.open("", "_blank", "width=960,height=1200");
    if (!printWindow) {
      window.alert("Allow pop-ups to print or save this leave form as PDF.");
      return;
    }

    printWindow.document.write(buildAdminRequestDocument(request, "print"));
    printWindow.document.close();
    printWindow.focus();
  }

  function downloadAdminLeaveRequestWord(request) {
    const documentHtml = buildAdminRequestDocument(request, "word");
    const blob = new Blob(["\ufeff", documentHtml], { type: "application/msword" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leave-request-${request.id}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function buildAdminRequestDocument(request, mode) {
    const title = `Leave Request ${request.id}`;
    const autoPrint = mode === "print"
      ? "<script>window.addEventListener('load', function () { window.print(); });<\/script>"
      : "";

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 4mm; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f3f4f6;
            color: #111;
          }
          .print-shell {
            width: 202mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
          .leave-paper {
            width: 100%;
            min-height: auto;
            box-sizing: border-box;
            background: #fff;
            border: 0;
            font-family: Arial, sans-serif;
            color: #111;
          }
          .leave-paper-topline,
          .leave-paper-row,
          .leave-paper-panel-grid,
          .leave-paper-form {
            display: grid;
          }
          .leave-paper-form {
            border: 1px solid #111;
          }
          .leave-paper-topline {
            display: block;
            position: relative;
            padding: 4mm 12mm 0;
          }
          .leave-paper-form-series {
            display: grid;
            gap: 0.4mm;
          }
          .leave-paper-note,
          .leave-paper-government {
            margin: 0;
          }
          .leave-paper-note {
            font-size: 8px;
            font-style: italic;
            line-height: 1.2;
          }
          .leave-paper-stamp {
            position: absolute;
            top: 11mm;
            right: 12mm;
            min-width: 27mm;
            padding: 1.6mm 2mm;
            border: 1px solid #111;
            text-align: center;
            font-size: 7px;
            font-weight: 800;
          }
          .leave-paper-heading-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: start;
            justify-items: center;
            position: relative;
            padding: 0 12mm 3mm;
            border-bottom: 1px solid #111;
          }
          .leave-paper-heading-spacer {
            display: none;
          }
          .leave-paper-seal-wrap {
            position: static;
            justify-self: end;
            margin-right: 9mm;
            margin-top: 0;
            padding: 0;
          }
          .leave-paper-seal {
            width: 16mm;
            height: 16mm;
            object-fit: contain;
          }
          .leave-paper-heading {
            grid-column: 2;
            text-align: center;
            min-width: 72mm;
            padding-top: 4mm;
          }
          .leave-paper-government {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            line-height: 1.15;
          }
          .leave-paper-heading h3 {
            margin: 6mm 0 0;
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .leave-paper-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .leave-paper-row-compact {
            grid-template-columns: 1.08fr 1fr 0.72fr;
          }
          .leave-paper-cell,
          .leave-paper-panel {
            min-width: 0;
            padding: 1.8mm 2.2mm;
            border-right: 1px solid #111;
            border-bottom: 1px solid #111;
          }
          .leave-paper-row > .leave-paper-cell:last-child,
          .leave-paper-panel:last-child {
            border-right: 0;
          }
          .leave-paper-label {
            display: block;
            font-size: 8px;
            text-transform: uppercase;
          }
          .leave-paper-name-header {
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: end;
            gap: 2mm;
            margin-bottom: 0.6mm;
          }
          .leave-paper-name-header .leave-paper-label {
            margin-bottom: 0;
          }
          .leave-paper-inline-captions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1.4mm;
            text-align: center;
            font-size: 7px;
          }
          .leave-paper-inline-fields,
          .leave-paper-date-range {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1.4mm;
          }
          .leave-paper-date-range {
            grid-template-columns: 1fr 1fr;
          }
          .leave-paper-inline-line,
          .leave-paper-readonly,
          .leave-paper-line {
            min-height: 5.2mm;
            border-bottom: 1px solid #111;
            font-size: 9px;
            color: #111;
            font-weight: 800;
          }
          .leave-paper-input,
          .leave-paper-inline-input,
          .leave-paper-table-input,
          .leave-paper-action-textarea {
            width: 100%;
            border: 0;
            border-bottom: 1px solid #111;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
            color: #111;
            font: inherit;
          }
          .leave-paper-input,
          .leave-paper-inline-input,
          .leave-paper-table-input {
            padding: 0.8mm 0.4mm;
          }
          .leave-paper-input-line {
            padding-left: 0;
            padding-right: 0;
          }
          .leave-paper-table-input {
            text-align: center;
          }
          .leave-paper-credit-input {
            display: inline-block;
            width: 30mm;
            margin-left: 1.5mm;
          }
          .leave-paper-approval-input {
            width: 12mm;
          }
          .leave-paper-approval-wide {
            width: 12mm;
          }
          .leave-paper-action-textarea {
            min-height: 12mm;
            padding: 0.8mm 0;
            resize: none;
          }
          .leave-paper-inline-line,
          .leave-paper-readonly {
            padding-top: 1.2mm;
          }
          .leave-paper-tight-field .leave-paper-input,
          .leave-paper-tight-field .leave-paper-readonly {
            text-align: center;
          }
          .leave-paper-readonly-centered {
            text-align: center;
          }
          .leave-paper-section-title {
            padding: 0.8mm 3mm;
            border-top: 1px solid #111;
            border-bottom: 1px solid #111;
            text-align: center;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .leave-paper-panel-grid,
          .leave-paper-row-detail,
          .leave-paper-row-action,
          .leave-paper-row-bottom {
            grid-template-columns: 1fr 1fr;
          }
          .leave-paper-panel {
            margin: 0;
            border-top: 0;
            border-left: 0;
          }
          .leave-paper-panel-grid .leave-paper-panel:last-child {
            display: grid;
            grid-template-rows: auto repeat(5, minmax(0, 1fr));
            min-height: 72mm;
            align-content: stretch;
          }
          .leave-paper-panel legend {
            padding: 1.6mm 0.8mm 0;
            font-size: 8px;
            font-weight: 400;
            text-transform: uppercase;
          }
          .leave-type-grid,
          .leave-paper-bullets,
          .leave-paper-action-writing,
          .leave-paper-approval-lines,
          .leave-paper-officer,
          .leave-paper-authorized,
          .leave-paper-subline-group,
          .leave-paper-form-series,
          .leave-paper-action-box,
          .leave-paper-other-line,
          .leave-paper-subgroup {
            display: grid;
            gap: 1mm;
          }
          .leave-paper-other-line {
            margin-top: 8mm;
          }
          .leave-paper-other-line span,
          .leave-paper-other-line label {
            font-style: italic;
          }
          .leave-paper-other-line .leave-paper-readonly,
          .leave-paper-other-line .leave-paper-input {
            width: 66mm;
            max-width: 100%;
          }
          .leave-option {
            display: flex;
            align-items: flex-start;
            gap: 1.5mm;
            font-size: 9px;
            line-height: 1.2;
          }
          .leave-type-grid .leave-option span {
            padding-left: 0;
          }
          .leave-type-grid .leave-option small {
            font-size: 6.5px;
            line-height: 1.05;
          }
          .leave-option input {
            width: 2.8mm;
            height: 2.8mm;
            margin: 0.4mm 0 0;
            appearance: none;
            border: 1px solid #111;
            border-radius: 0;
            background: #fff;
            display: inline-grid;
            place-items: center;
            vertical-align: top;
          }
          .leave-option input::before {
            content: "";
            font-size: 8px;
            line-height: 1;
            color: #111;
          }
          .leave-option input:checked::before {
            content: "✓";
          }
          .leave-paper-subgroup p,
          .leave-paper-signature span,
          .leave-paper-officer span,
          .leave-paper-authorized span,
          .leave-paper-credit-note {
            margin: 0;
            font-size: 9px;
          }
          .leave-paper-subgroup p {
            font-style: italic;
          }
          .leave-paper-panel-grid .leave-paper-panel:last-child .leave-paper-subgroup {
            align-content: start;
            margin-bottom: 0;
          }
          .leave-paper-panel-grid .leave-paper-panel:last-child .leave-paper-subgroup:nth-of-type(n + 2) {
            padding-top: 1.8mm;
          }
          .leave-paper-detail-option {
            align-items: center;
          }
          .leave-paper-detail-option-static {
            display: flex;
          }
          .leave-paper-detail-option-static > span:first-child {
            padding-left: 0;
            font-size: 7px;
            line-height: 1.1;
            white-space: nowrap;
          }
          .leave-paper-detail-line {
            flex: 1 1 auto;
            min-width: 18mm;
            margin-left: 1.5mm;
          }
          .leave-paper-detail-line-readonly {
            display: inline-block;
            min-height: 4.2mm;
            padding-top: 0.4mm;
            padding-left: 0;
            border-bottom: 1px solid #111;
            font-size: 9px;
            line-height: 1.1;
          }
          .leave-paper-approval-lines {
            gap: 0;
            margin-top: 0.2mm;
          }
          .leave-paper-approval-item {
            display: flex;
            align-items: center;
            gap: 0.8mm;
            font-size: 8px;
            line-height: 1;
            white-space: nowrap;
          }
          .leave-paper-approval-item .leave-paper-input {
            min-height: 0;
            padding: 0;
            line-height: 1;
          }
          .leave-paper-row-bottom .leave-paper-cell {
            min-height: 18mm;
            padding: 1.1mm 1.8mm 0;
            border-bottom: 0;
          }
          .leave-paper-row-bottom .leave-paper-cell:first-child {
            border-right: 0;
          }
          .leave-paper-row-bottom .leave-paper-label {
            margin-bottom: 0;
            font-size: 7px;
            font-weight: 400;
          }
          .leave-paper-row-bottom .leave-paper-approval-item,
          .leave-paper-row-bottom .leave-paper-approval-item .leave-paper-input {
            font-weight: 400;
          }
          .leave-paper-row-bottom .leave-paper-action-box {
            min-height: 11mm;
          }
          .leave-paper-row-bottom .leave-paper-action-writing {
            gap: 0;
            margin-top: 1.8mm;
          }
          .leave-paper-row-bottom .leave-paper-action-textarea {
            min-height: 10mm;
            padding: 0;
            border: 0;
            line-height: 3.2mm;
            background-image: repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent 3mm,
              #111 3.1mm,
              transparent 3.2mm
            );
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .leave-paper-row-bottom .leave-paper-approval-lines {
            margin-top: 0.4mm;
            margin-left: 7mm;
          }
          .leave-paper-authorized-wide {
            grid-column: 1 / -1;
            margin-top: 0;
            padding: 3.8mm 2.2mm 1.6mm;
          }
          .leave-paper-authorized-wide .leave-paper-line {
            width: 74mm;
            margin: 0 auto;
            font-size: 8px;
            font-weight: 800;
          }
          .leave-paper-subgroup p,
          .leave-paper-reason-field label {
            font-size: 7px;
            line-height: 1.1;
          }
          .leave-paper-credit-note {
            text-align: center;
            margin-bottom: 1mm;
          }
          .leave-paper-credit-line {
            display: inline-block;
            min-width: 30mm;
            margin-left: 1.5mm;
            border-bottom: 1px solid #111;
            vertical-align: -1.1mm;
          }
          .leave-paper-credit-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
            margin-bottom: 2mm;
          }
          .leave-paper-credit-table th,
          .leave-paper-credit-table td {
            border: 1px solid #111;
            padding: 0.8mm;
            text-align: center;
            vertical-align: middle;
          }
          .leave-paper-credit-table th:first-child,
          .leave-paper-credit-table td:first-child {
            text-align: left;
          }
          .leave-paper-inline-blank {
            display: inline-block;
            min-width: 14mm;
            border-bottom: 1px solid #111;
            font-size: 9px;
          }
          .leave-paper-signature,
          .leave-paper-officer,
          .leave-paper-authorized {
            text-align: center;
            margin-top: 2mm;
          }
          .leave-paper-action-line {
            min-height: 4mm;
            border-bottom: 1px solid #111;
            font-size: 9px;
          }
          @media print {
            body {
              background: #fff;
            }
            .print-shell {
              width: 202mm;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-shell">
          ${buildAdminRequestPaperMarkup(request)}
        </div>
        ${autoPrint}
      </body>
      </html>
    `;
  }

  function bindSignOut() {
    const button = document.getElementById("sign-out-button");
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      clearSession();
      window.location.href = "/login";
    });
  }

  function saveSession(session) {
    window.localStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function getSession() {
    try {
      const value = window.localStorage.getItem(sessionKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("Unable to parse session data.", error);
      return null;
    }
  }

  function clearSession() {
    window.localStorage.removeItem(sessionKey);
  }

  function getAdminEmployeeProfileById(employeeId) {
    return adminEmployeeProfiles.find((profile) => Number(profile.id) === Number(employeeId)) || null;
  }

  function buildLeaveCreditSnapshot(request) {
    const employee = getAdminEmployeeProfileById(request.employee_id);
    const creditColumn = getLeaveCreditColumn(request);
    const currentCredits = Number(employee?.leave_credits || 0);
    const storedCreditsBeforeDeduction = Number(creditColumn === "sick" ? request.credit_earned_sick : request.credit_earned_vacation);
    const storedBalanceAfterDeduction = Number(creditColumn === "sick" ? request.credit_balance_sick : request.credit_balance_vacation);
    const daysRequested = Number(request.days_requested || 0);
    const deduction = getLeaveCreditDeductionDays(request);
    const creditsBeforeDeduction = Number.isFinite(storedCreditsBeforeDeduction)
      ? storedCreditsBeforeDeduction
      : currentCredits;
    const projectedBalance = Number.isFinite(storedBalanceAfterDeduction)
      ? storedBalanceAfterDeduction
      : Math.max(creditsBeforeDeduction - deduction, 0);
    const paidDays = request.approved_with_pay_days === null || request.approved_with_pay_days === undefined
      ? getDefaultApprovedWithPayDays(request, creditsBeforeDeduction)
      : Number(request.approved_with_pay_days);
    const unpaidDays = request.approved_without_pay_days === null || request.approved_without_pay_days === undefined
      ? Math.max(daysRequested - paidDays, 0)
      : Number(request.approved_without_pay_days);

    return {
      currentCredits: creditsBeforeDeduction,
      projectedBalance,
      deduction,
      paidDays,
      unpaidDays,
      monthlyGain: monthlyCreditGain,
      creditAsOf: request.credit_as_of || new Date().toISOString().slice(0, 10)
    };
  }

  function buildCreditCellValues(request, snapshot) {
    const creditColumn = getLeaveCreditColumn(request);

    return {
      vacation: {
        current: creditColumn === "vacation" ? formatNumberDisplay(snapshot.currentCredits) : "-",
        deduction: creditColumn === "vacation" ? formatNumberDisplay(snapshot.deduction) : "-",
        balance: creditColumn === "vacation" ? formatNumberDisplay(snapshot.projectedBalance) : "-"
      },
      sick: {
        current: creditColumn === "sick" ? formatNumberDisplay(snapshot.currentCredits) : "-",
        deduction: creditColumn === "sick" ? formatNumberDisplay(snapshot.deduction) : "-",
        balance: creditColumn === "sick" ? formatNumberDisplay(snapshot.projectedBalance) : "-"
      }
    };
  }

  function buildBlankCreditCellValues() {
    return {
      vacation: {
        current: "",
        deduction: "",
        balance: ""
      },
      sick: {
        current: "",
        deduction: "",
        balance: ""
      }
    };
  }

  function renderCreditComputationPage() {
    const container = document.getElementById("credit-computation-table");
    if (!container) {
      return;
    }

    const nextMonthEnd = getMonthEndIsoDate();
    const rows = adminEmployeeProfiles.map((profile) => {
      const currentCredits = Number(profile.leave_credits || 0);

      return {
        profile,
        currentCredits
      };
    });

    const currentTotal = rows.reduce((total, row) => total + row.currentCredits, 0);
    setText("credit-stat-employees", String(rows.length));
    setText("credit-stat-current-total", formatCreditAmount(currentTotal));
    setText("credit-stat-next-run", formatDateShort(nextMonthEnd) || "-");

    if (!rows.length) {
      container.innerHTML = '<p class="empty-state">No employee credit records found.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table credit-computation-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Current Credits</th>
            <th>Latest Approved Leave</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ profile, currentCredits }) => `
            <tr>
              <td data-label="Employee">
                <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong><br>
                ${escapeHtml(profile.employee_no || "No employee number")}<br>
                ${escapeHtml(profile.department || "-")}
              </td>
              <td data-label="Current Credits">${escapeHtml(formatCreditAmount(currentCredits))}</td>
              <td data-label="Latest Approved Leave">${buildLatestApprovedLeaveMarkup(profile.id)}</td>
              <td data-label="Action">
                <div class="credit-action-stack">
                  <button type="button" class="button button-muted" data-deduct-late="${profile.id}">Enter Minutes</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    bindCreditDeductionActions(container);
  }

  function bindCreditDeductionActions(container) {
    Array.from(container.querySelectorAll("[data-deduct-late]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const employeeId = Number(button.getAttribute("data-deduct-late"));
        const profile = getAdminEmployeeProfileById(employeeId);
        if (!profile) {
          return;
        }

        openCreditDeductionModal(profile);
      });
    });

  }

  function bindCreditDeductionModal() {
    const form = document.getElementById("credit-deduction-form");
    const minutesInput = document.getElementById("credit-deduction-entry-minutes");
    const noteInput = document.getElementById("credit-deduction-entry-note");
    const addEntryButton = document.getElementById("credit-deduction-add-entry");
    const closeElements = Array.from(document.querySelectorAll("[data-close-credit-deduction-modal]"));

    if (!form) {
      return;
    }

    closeElements.forEach((element) => {
      element.addEventListener("click", closeCreditDeductionModal);
    });

    minutesInput?.addEventListener("input", updateCreditDeductionPreview);
    minutesInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCreditDeductionEntry();
      }
    });
    noteInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCreditDeductionEntry();
      }
    });
    addEntryButton?.addEventListener("click", addCreditDeductionEntry);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!selectedCreditDeductionProfile) {
        return;
      }

      addPendingCreditDeductionEntry();
      const formData = new FormData(form);
      const minutes = Number(formData.get("lateMinutes"));
      const reason = String(formData.get("deductionReason") || "").trim();

      if (!Number.isFinite(minutes) || minutes <= 0) {
        setText("credit-deduction-error", "Add at least one late-minute entry.");
        return;
      }

      const finishSubmit = beginFormSubmit(form, "Applying...");
      if (!finishSubmit) {
        return;
      }

      try {
        await handleLateMinuteDeduction(selectedCreditDeductionProfile, minutes, reason, creditDeductionEntries);
      } finally {
        finishSubmit();
      }
    });
  }

  function openCreditDeductionModal(profile) {
    const modal = document.getElementById("credit-deduction-modal");
    const form = document.getElementById("credit-deduction-form");
    const minutesInput = document.getElementById("credit-deduction-entry-minutes");

    if (!modal || !form) {
      return;
    }

    selectedCreditDeductionProfile = profile;
    creditDeductionEntries = [];
    form.reset();
    setText("credit-deduction-employee", getEmployeeDisplayName(profile));
    setText("credit-deduction-current", formatCreditAmount(profile.leave_credits));
    setText("credit-deduction-error", "");
    renderCreditDeductionEntries();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    minutesInput?.focus();
  }

  function closeCreditDeductionModal() {
    const modal = document.getElementById("credit-deduction-modal");
    if (!modal) {
      return;
    }

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    selectedCreditDeductionProfile = null;
    creditDeductionEntries = [];
  }

  function addCreditDeductionEntry() {
    if (!selectedCreditDeductionProfile) {
      return;
    }

    const added = addPendingCreditDeductionEntry();
    if (!added) {
      setText("credit-deduction-error", "Enter valid minutes before adding.");
    }
  }

  function addPendingCreditDeductionEntry() {
    const minutesInput = document.getElementById("credit-deduction-entry-minutes");
    const noteInput = document.getElementById("credit-deduction-entry-note");
    const minutes = Number(minutesInput?.value || 0);
    if (!Number.isFinite(minutes) || minutes <= 0 || !minutesInput?.value) {
      return false;
    }

    const normalizedMinutes = Math.round(minutes);
    creditDeductionEntries.push({
      note: String(noteInput?.value || "").trim(),
      minutes: normalizedMinutes
    });
    if (minutesInput) {
      minutesInput.value = "";
    }
    if (noteInput) {
      noteInput.value = "";
      noteInput.focus();
    }
    setText("credit-deduction-error", "");
    renderCreditDeductionEntries();
    return true;
  }

  function removeCreditDeductionEntry(index) {
    creditDeductionEntries.splice(index, 1);
    renderCreditDeductionEntries();
  }

  function renderCreditDeductionEntries() {
    const list = document.getElementById("credit-deduction-entry-list");
    const totalInput = document.getElementById("credit-deduction-total-minutes");
    if (!list) {
      return;
    }

    if (!creditDeductionEntries.length) {
      list.innerHTML = '<p class="empty-state">No late-minute entries added yet.</p>';
    } else {
      list.innerHTML = creditDeductionEntries.map((entry, index) => `
        <div class="credit-deduction-entry">
          <div>
            <strong>${escapeHtml(entry.note || `Entry ${index + 1}`)}</strong>
            <span>${escapeHtml(String(entry.minutes))} minute(s)</span>
          </div>
          <button type="button" class="button button-muted" data-remove-credit-deduction-entry="${index}">Remove</button>
        </div>
      `).join("");

      Array.from(list.querySelectorAll("[data-remove-credit-deduction-entry]")).forEach((button) => {
        button.addEventListener("click", () => {
          removeCreditDeductionEntry(Number(button.getAttribute("data-remove-credit-deduction-entry")));
        });
      });
    }

    const totalMinutes = getCreditDeductionTotalMinutes();
    if (totalInput) {
      totalInput.value = String(totalMinutes);
    }
    updateCreditDeductionPreview();
  }

  function getCreditDeductionTotalMinutes() {
    return creditDeductionEntries.reduce((total, entry) => total + Number(entry.minutes || 0), 0);
  }

  function updateCreditDeductionPreview() {
    if (!selectedCreditDeductionProfile) {
      return;
    }

    const totalMinutes = getCreditDeductionPreviewMinutes();
    if (!totalMinutes) {
      setText("credit-deduction-preview", "Add late-minute entries to preview the deduction.");
      return;
    }

    const previewEntryCount = getCreditDeductionPreviewEntryCount();
    const deduction = calculateLateDeduction(totalMinutes);
    const currentCredits = Number(selectedCreditDeductionProfile.leave_credits || 0);
    const updatedCredits = Math.max(currentCredits - deduction, 0);
    setText("credit-deduction-preview", `${previewEntryCount} entr${previewEntryCount === 1 ? "y" : "ies"} | ${totalMinutes} total minute(s) | Minus ${formatCreditAmount(deduction)} credit. New balance ${formatCreditAmount(updatedCredits)}.`);
  }

  function getCreditDeductionPreviewMinutes() {
    const minutesInput = document.getElementById("credit-deduction-entry-minutes");
    const pendingMinutes = Number(minutesInput?.value || 0);
    const normalizedPendingMinutes = Number.isFinite(pendingMinutes) && pendingMinutes > 0
      ? Math.round(pendingMinutes)
      : 0;
    return getCreditDeductionTotalMinutes() + normalizedPendingMinutes;
  }

  function getCreditDeductionPreviewEntryCount() {
    const minutesInput = document.getElementById("credit-deduction-entry-minutes");
    const pendingMinutes = Number(minutesInput?.value || 0);
    return creditDeductionEntries.length + (Number.isFinite(pendingMinutes) && pendingMinutes > 0 ? 1 : 0);
  }

  async function handleLateMinuteDeduction(profile, minutes, reasonText, entries = []) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setText("credit-deduction-error", "Add at least one late-minute entry.");
      return;
    }

    const normalizedMinutes = Math.round(minutes);
    const deduction = calculateLateDeduction(normalizedMinutes);
    const currentCredits = Number(profile.leave_credits || 0);
    const updatedCredits = Math.max(currentCredits - deduction, 0);
    const reason = reasonText || `Late for ${normalizedMinutes} minute(s)`;
    const updated = await updateEmployeeCreditBalance(profile, updatedCredits);
    if (!updated) {
      return;
    }

    await saveCreditDeductionLog(profile, {
      minutes,
      entries,
      deduction,
      reason,
      beforeCredits: currentCredits,
      afterCredits: updatedCredits,
      createdAt: new Date().toISOString()
    });

    if (db) {
      await loadAdminProfiles();
    } else {
      const currentProfile = getAdminEmployeeProfileById(profile.id);
      if (currentProfile) {
        currentProfile.leave_credits = updatedCredits;
      }
    }

    renderCreditComputationPage();
    closeCreditDeductionModal();
    setText("credit-deduction-status", `Deducted ${formatCreditAmount(deduction)} credit from ${getEmployeeDisplayName(profile)}.`);
  }

  async function updateEmployeeCreditBalance(profile, leaveCredits) {
    if (!db) {
      return true;
    }

    const { error } = await db.rpc("update_employee", {
      p_employee_id: profile.id,
      p_email: profile.email,
      p_password: null,
      p_first_name: profile.first_name,
      p_middle_name: profile.middle_name,
      p_last_name: profile.last_name,
      p_suffix: profile.suffix,
      p_department: profile.department,
      p_position_title: profile.position_title,
      p_contact_no: profile.contact_no,
      p_hire_date: profile.hire_date,
      p_employment_status: profile.employment_status || "active",
      p_leave_credits: leaveCredits
    });

    if (error) {
      window.alert(error.message);
      return false;
    }

    return true;
  }

  function calculateLateDeduction(minutes) {
    const normalizedMinutes = Math.max(Math.round(Number(minutes) || 0), 0);
    return Number(lateMinuteDeductionTable[normalizedMinutes] || (normalizedMinutes / workingMinutesPerDay).toFixed(3));
  }

  function formatCreditAmount(value) {
    return Number(value || 0).toFixed(3);
  }

  function getEmployeeDisplayName(profile) {
    return [profile.first_name, profile.middle_name, profile.last_name, profile.suffix]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || "Employee";
  }

  function getLocalCreditDeductionLogs() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(creditDeductionLogKey) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function getLocalEmployeeDeductionLogs(profile) {
    return getLocalCreditDeductionLogs()[String(profile.id)] || [];
  }

  async function getEmployeeDeductionLogs(profile) {
    if (!db) {
      return getLocalEmployeeDeductionLogs(profile);
    }

    const { data, error } = await db.rpc("get_credit_deduction_logs", {
      p_employee_id: profile.id
    });

    if (error) {
      window.alert(`Unable to load deduction logs: ${error.message}`);
      return getLocalEmployeeDeductionLogs(profile);
    }

    return Array.isArray(data) ? data.map(normalizeCreditDeductionLog) : [];
  }

  function normalizeCreditDeductionLog(entry) {
    return {
      employeeName: entry.employee_name || entry.employeeName || "",
      employeeNo: entry.employee_no || entry.employeeNo || "",
      minutes: Number(entry.minutes || 0),
      entries: Array.isArray(entry.entries) ? entry.entries : [],
      deduction: Number(entry.deduction || 0),
      reason: entry.reason || "",
      beforeCredits: Number(entry.before_credits ?? entry.beforeCredits ?? 0),
      afterCredits: Number(entry.after_credits ?? entry.afterCredits ?? 0),
      createdAt: entry.created_at || entry.createdAt || new Date().toISOString()
    };
  }

  async function saveCreditDeductionLog(profile, entry) {
    if (!db) {
      saveLocalCreditDeductionLog(profile, entry);
      return;
    }

    const { error } = await db.rpc("create_credit_deduction_log", {
      p_employee_id: profile.id,
      p_employee_name: getEmployeeDisplayName(profile),
      p_employee_no: profile.employee_no || null,
      p_minutes: Number(entry.minutes || 0),
      p_entries: entry.entries || [],
      p_deduction: entry.deduction,
      p_reason: entry.reason,
      p_before_credits: entry.beforeCredits,
      p_after_credits: entry.afterCredits
    });

    if (error) {
      saveLocalCreditDeductionLog(profile, entry);
      window.alert(`Credit was updated, but the Supabase deduction log was not saved: ${error.message}. A local browser backup was saved.`);
    }
  }

  function saveLocalCreditDeductionLog(profile, entry) {
    const logs = getLocalCreditDeductionLogs();
    const employeeKey = String(profile.id);
    logs[employeeKey] = Array.isArray(logs[employeeKey]) ? logs[employeeKey] : [];
    logs[employeeKey].push({
      employeeName: getEmployeeDisplayName(profile),
      employeeNo: profile.employee_no || "",
      ...entry
    });
    window.localStorage.setItem(creditDeductionLogKey, JSON.stringify(logs));
  }

  function slugifyFileName(value) {
    return String(value || "employee")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "employee";
  }

  function renderEmployeeDemo() {
    fillEmployeeHeader({
      first_name: "Juan",
      last_name: "Dela Cruz",
      employee_no: "EMP-0001",
      department: "Treasury",
      position_title: "Administrative Aide",
      leave_credits: 12.5
    });

    setText("stat-pending", "1");
    setText("stat-approved", "3");
    setText("stat-rejected", "1");

    const list = document.getElementById("employee-request-list");
    if (list) {
      list.innerHTML = `
        <li>
          <strong>Vacation</strong>
          <div>2026-05-28 to 2026-05-30</div>
          <div>3 day(s)</div>
          <div><span class="badge pending">For HRMO Review</span></div>
        </li>
        <li>
          <strong>Sick</strong>
          <div>2026-05-10 to 2026-05-11</div>
          <div>2 day(s)</div>
          <div><span class="badge approved">Approved</span></div>
        </li>
      `;
    }

    renderDemoDailyEntry();
  }

  function renderDemoDailyEntry() {
    var promptEl = document.getElementById("daily-entry-prompt");
    var textarea = document.getElementById("daily-entry-textarea");
    var dateLabel = document.getElementById("daily-entry-date-label");
    var savedText = document.getElementById("daily-entry-saved-text");
    var toggleHistoryBtn = document.getElementById("daily-entry-toggle-history");
    var historyEl = document.getElementById("daily-entry-history");
    var historyList = document.getElementById("daily-entry-history-list");
    var backBtn = document.getElementById("daily-entry-back-today-btn");
    var headingEl = document.querySelector(".daily-entry-card h3");

    var demoEntries = [
      { date: "2026-06-30", content: "Assisted clients at the front desk, processed 15 payment transactions, and prepared end-of-day report." },
      { date: "2026-06-29", content: "Processed leave applications, updated employee records, submitted report to HRMO." },
      { date: "2026-06-28", content: "Prepared monthly summary of transactions, attended coordination meeting with department heads." },
      { date: "2026-06-27", content: "Reviewed pending leave requests, encoded new employee data, filed accomplished documents." }
    ];

    var selectedDemoDate = "2026-06-30";

    function setDemoDate(dateStr) {
      selectedDemoDate = dateStr;
      var entry = demoEntries.find(function(e) { return e.date === dateStr; });
      if (dateLabel) {
        dateLabel.textContent = new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
          weekday: "long", year: "numeric", month: "long", day: "numeric"
        });
      }
      if (backBtn) backBtn.classList.toggle("hidden", dateStr === "2026-06-30");
      if (headingEl) headingEl.textContent = dateStr === "2026-06-30" ? "What did you do today?" : "Edit Entry";
      if (textarea) textarea.value = entry ? entry.content : "";
      if (savedText) savedText.classList.remove("hidden");
      if (historyList) {
        Array.from(historyList.querySelectorAll("li[data-entry-date]")).forEach(function(li) {
          li.classList.toggle("daily-entry-history-selected", li.getAttribute("data-entry-date") === dateStr);
        });
      }
    }

    if (promptEl) promptEl.classList.add("hidden");
    setDemoDate("2026-06-30");

    if (toggleHistoryBtn && historyEl) {
      toggleHistoryBtn.addEventListener("click", function() {
        var isHidden = historyEl.classList.contains("hidden");
        historyEl.classList.toggle("hidden");
        toggleHistoryBtn.textContent = isHidden ? "Hide History" : "View History";
        if (isHidden && historyList) {
          historyList.innerHTML = demoEntries.map(function(entry) {
            var date = new Date(entry.date + "T00:00:00").toLocaleDateString("en-PH", {
              weekday: "short", year: "numeric", month: "short", day: "numeric"
            });
            return '<li class="' + (entry.date === selectedDemoDate ? 'daily-entry-history-selected' : '') + '" data-entry-date="' + entry.date + '">' +
              '<div class="daily-entry-history-date">' + date + '</div>' +
              '<div class="daily-entry-history-content">' + entry.content + '</div></li>';
          }).join("");

          Array.from(historyList.querySelectorAll("li[data-entry-date]")).forEach(function(li) {
            li.addEventListener("click", function() {
              setDemoDate(li.getAttribute("data-entry-date"));
            });
          });
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", function() {
        setDemoDate("2026-06-30");
      });
    }

    var saveBtn = document.getElementById("daily-entry-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", function() {
        if (textarea && textarea.value.trim()) {
          window.alert("Demo mode: database not configured. Your entry for " + selectedDemoDate + " would be saved in production.");
        } else {
          window.alert("Please write something about your day before saving.");
        }
      });
    }
  }

  function renderAdminDemo() {
    const demoProfiles = [{
      id: 1,
      first_name: "Juan",
      last_name: "Dela Cruz",
      employee_no: "EMP-0001",
      email: "juan.delacruz@agdangan.gov.ph",
      department: "Treasury",
      position_title: "Administrative Aide",
      employment_status: "active",
      leave_credits: 12.5
    }];

    setText("admin-name", "Welcome, System Administrator");
    setText("admin-meta", "HR | Municipal Administrator");
    setText("stat-employees", String(demoProfiles.length));
    setText("stat-admin-pending", "5");
    setText("stat-admin-approved", "16");
    setText("stat-admin-rejected", "2");

    adminEmployeeProfiles = demoProfiles;
    renderAdminEmployeeTable(demoProfiles);

    const table = document.getElementById("admin-requests-table");
    if (table) {
      table.innerHTML = `
        <div class="admin-request-card-grid">
          <article class="admin-request-card">
            <div class="admin-request-card-top">
              <span class="badge pending">For HRMO Review</span>
              <span class="admin-request-card-id">Request #1</span>
            </div>
            <h4>Juan Dela Cruz</h4>
            <div class="admin-request-card-meta">Vacation</div>
            <div class="admin-request-card-meta">May 28, 2026 to May 30, 2026</div>
            <div class="admin-request-card-meta">3 day(s)</div>
            <p>Family travel</p>
            <div class="table-actions">
              <button type="button" class="button button-muted">View</button>
              <button type="button" class="button button-success">Approve</button>
              <button type="button" class="button button-danger">Reject</button>
            </div>
          </article>
        </div>
      `;
    }
  }

  function renderCreditComputationDemo() {
    adminEmployeeProfiles = [
      {
        id: 1,
        first_name: "Juan",
        last_name: "Dela Cruz",
        employee_no: "EMP-0001",
        department: "Treasury",
        leave_credits: 12.5
      },
      {
        id: 2,
        first_name: "Maria",
        last_name: "Santos",
        employee_no: "EMP-0002",
        department: "Accounting",
        leave_credits: 9.75
      }
    ];

    adminLeaveRequests = [
      {
        employee_id: 1,
        leave_type: "vacation",
        days_requested: 2,
        status: "approved",
        commutation: "requested",
        reviewed_at: "2026-05-25T08:00:00Z"
      }
    ];

    renderCreditComputationPage();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
    }
  }

  function normalizeOptionalText(value) {
    const text = String(value || "").trim();
    return text || null;
  }

  function capitalize(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function getRequestTrackingLabel(request) {
    const status = String(request?.status || "").toLowerCase();
    const recommendation = String(request?.recommendation || "").toLowerCase();

    if (status === "approved") {
      return "Approved";
    }

    if (status === "rejected") {
      return "Rejected";
    }

    if (recommendation === "approved") {
      return "For Mayor Approval";
    }

    if (recommendation === "rejected") {
      return "For Disapproval Review";
    }

    return "For HRMO Review";
  }

  function getRequestStatusClass(request) {
    const status = String(request?.status || "").toLowerCase();
    return status === "approved" || status === "rejected" ? status : "pending";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(String(value ?? ""));
  }

  function normalizeLeaveType(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getLeaveTypes(value) {
    return String(value || "")
      .split(",")
      .map((item) => normalizeLeaveType(item))
      .filter(Boolean);
  }

  function getLeaveCreditPolicy(value) {
    const leaveTypes = getLeaveTypes(value);
    const creditLeaveType = leaveTypes.find((leaveType) => leaveType === "vacation" || leaveType === "sick")
      || leaveTypes.find((leaveType) => leaveCreditPolicies[leaveType]?.deductsCredit)
      || leaveTypes[0];
    const policy = leaveCreditPolicies[creditLeaveType] || { freeDays: Infinity, deductsCredit: false, column: null };
    if (!policy.deductsCredit) {
      return policy;
    }

    const freeDays = leaveTypes.reduce((total, leaveType) => {
      const leavePolicy = leaveCreditPolicies[leaveType];
      if (!leavePolicy?.deductsCredit || leavePolicy.column !== policy.column) {
        return total;
      }

      return total + Number(leavePolicy.freeDays || 0);
    }, 0);

    return { ...policy, freeDays };
  }

  function getLeaveCreditDeductionDays(request) {
    const daysRequested = Math.max(Number(request?.days_requested || 0), 0);
    const policy = getLeaveCreditPolicy(request?.leave_type);
    if (!policy.deductsCredit) {
      return 0;
    }

    return Math.max(daysRequested - Number(policy.freeDays || 0), 0);
  }

  function getLeaveCreditColumn(request) {
    const deduction = getLeaveCreditDeductionDays(request);
    if (deduction <= 0) {
      return null;
    }

    return getLeaveCreditPolicy(request?.leave_type).column;
  }

  function getDefaultApprovedWithPayDays(request, creditsBeforeDeduction) {
    const daysRequested = Math.max(Number(request?.days_requested || 0), 0);
    const deduction = getLeaveCreditDeductionDays(request);
    if (deduction <= 0) {
      return daysRequested;
    }

    const freeDays = Math.max(daysRequested - deduction, 0);
    return Math.min(daysRequested, freeDays + Math.floor(Number(creditsBeforeDeduction || 0)));
  }

  function getLeaveCreditDeductionLabel(request) {
    const deduction = getLeaveCreditDeductionDays(request);
    return deduction > 0 ? `${formatNumberDisplay(deduction)} day(s) deducted` : "No credit deduction";
  }

  function buildLatestApprovedLeaveMarkup(employeeId) {
    const latestApprovedRequest = adminLeaveRequests
      .filter((request) => Number(request.employee_id) === Number(employeeId) && request.status === "approved")
      .sort((left, right) => {
        const leftValue = String(left.reviewed_at || left.created_at || "");
        const rightValue = String(right.reviewed_at || right.created_at || "");
        return rightValue.localeCompare(leftValue);
      })[0];

    if (!latestApprovedRequest) {
      return '<span class="muted">No approved leave yet</span>';
    }

    return `
      <div class="credit-request-chip">
        <strong>${escapeHtml(formatLeaveType(latestApprovedRequest.leave_type))}</strong>
        <span>${escapeHtml(getLeaveCreditDeductionLabel(latestApprovedRequest))}</span>
        <span>approved ${escapeHtml(formatDateShort(getReviewedAtDate(latestApprovedRequest)))}</span>
      </div>
    `;
  }

  function normalizeFormNumber(value) {
    if (value === null || value === undefined || value === "" || value === "-") {
      return "";
    }

    return String(value);
  }

  function normalizeApprovalDayDisplay(value) {
    const normalized = normalizeFormNumber(value);
    return normalized === "0" ? "" : normalized;
  }

  function getApplicantFullName(request) {
    return [
      request.applicant_first_name,
      request.applicant_middle_name,
      request.applicant_last_name
    ].filter(Boolean).join(" ").trim();
  }

  function formatDateDisplay(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function getSelectedLeaveDates(request) {
    return Array.isArray(request?.selected_leave_dates)
      ? request.selected_leave_dates.filter(Boolean).map((value) => String(value)).sort()
      : [];
  }

  function formatSelectedLeaveDates(values) {
    return values.map((value) => formatDateDisplay(value)).join(", ");
  }

  function formatLeaveDateSummary(request) {
    const selectedLeaveDates = getSelectedLeaveDates(request);
    if (selectedLeaveDates.length > 1) {
      return formatSelectedLeaveDates(selectedLeaveDates);
    }

    if (request?.start_date && request?.end_date) {
      return `${formatDateDisplay(request.start_date)} to ${formatDateDisplay(request.end_date)}`;
    }

    if (request?.start_date) {
      return formatDateDisplay(request.start_date);
    }

    return "-";
  }

  function formatDateLong(value) {
    if (!value) {
      return "";
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function formatDateShort(value) {
    if (!value) {
      return "";
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatNumberDisplay(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value);
  }

  function formatIntegerDisplay(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return String(value);
  }

  function countWorkingDaysInRange(startValue, endValue) {
    if (!startValue || !endValue) {
      return 0;
    }

    const currentDate = new Date(`${startValue}T00:00:00`);
    const endDate = new Date(`${endValue}T00:00:00`);
    if (Number.isNaN(currentDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < currentDate) {
      return 0;
    }

    let workingDays = 0;

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays += 1;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  function formatLeaveType(value) {
    const keys = getLeaveTypes(value);
    if (!keys.length) {
      return "";
    }

    return keys.map((key) => leaveTypeLabels[key] || capitalize(key)).join(" / ");
  }

  function getReviewedAtDate(request) {
    const reviewedAt = String(request?.reviewed_at || "").trim();
    return reviewedAt ? reviewedAt.slice(0, 10) : "";
  }

  function getMonthEndIsoDate(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const monthEnd = new Date(year, month + 1, 0);
    const monthEndYear = monthEnd.getFullYear();
    const monthEndMonth = String(monthEnd.getMonth() + 1).padStart(2, "0");
    const monthEndDay = String(monthEnd.getDate()).padStart(2, "0");
    return `${monthEndYear}-${monthEndMonth}-${monthEndDay}`;
  }

  const burger = document.querySelector("[data-burger]");
  if (burger) {
    burger.addEventListener("click", function () {
      const header = this.closest(".site-header");
      header.classList.toggle("is-open");
      this.classList.toggle("is-open");
      this.setAttribute("aria-label", this.classList.contains("is-open") ? "Close menu" : "Open menu");
    });

    document.addEventListener("click", function (e) {
      const header = burger.closest(".site-header");
      if (header.classList.contains("is-open") && !header.contains(e.target)) {
        header.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-label", "Open menu");
      }
    });
  }
})();
