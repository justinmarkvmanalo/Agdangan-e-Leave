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
  const monthlyCreditGain = 1.25;
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

  if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(config.url, config.anonKey);
    db = supabase;
  }

  const pageName = window.location.pathname.split("/").pop() || "index.html";

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("login-form")) {
      initLoginPage();
      return;
    }

    if (pageName === "employee-dashboard.html") {
      initEmployeeDashboard();
      return;
    }

    if (pageName === "admin-dashboard.html") {
      initAdminDashboard();
    }
  });

  function initLoginPage() {
    const configStatus = document.getElementById("config-status");
    const switchButtons = Array.from(document.querySelectorAll("[data-role-switch]"));
    const title = document.getElementById("auth-title");
    const subtitle = document.getElementById("auth-subtitle");
    const roleInput = document.getElementById("selected-role");
    const loginForm = document.getElementById("login-form");
    const demoFillButton = document.getElementById("demo-fill");
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
        : "Supabase is not configured yet. Open supabase-config.js and set your project values first.";
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

    if (demoFillButton) {
      demoFillButton.addEventListener("click", () => {
        const role = roleInput.value;
        document.getElementById("email").value = role === "admin"
          ? "admin@agdangan.gov.ph"
          : "employee@agdangan.gov.ph";
        document.getElementById("password").value = "password123";
      });
    }

    if (!loginForm) {
      return;
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!db) {
        window.alert("Supabase is not configured yet. Update supabase-config.js first.");
        return;
      }

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

      window.location.href = account.role === "admin" ? "admin-dashboard.html" : "employee-dashboard.html";
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
      window.location.href = "login.html";
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
  }

  async function initAdminDashboard() {
    bindSignOut();

    if (!db) {
      renderAdminDemo();
      return;
    }

    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "login.html";
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
      leaveCredits.textContent = Number(profile.leave_credits || 0).toFixed(2);
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
        <div>${escapeHtml(request.start_date)} to ${escapeHtml(request.end_date)}</div>
        <div>${escapeHtml(request.days_requested)} day(s)</div>
        <div><span class="badge ${escapeHtml(request.status)}">${escapeHtml(capitalize(request.status))}</span></div>
      </li>
    `).join("");
  }

  function bindLeaveRequestForm(profile) {
    const form = document.getElementById("leave-request-form");
    if (!form) {
      return;
    }

    const startDateInput = form.querySelector("#start-date");
    const endDateInput = form.querySelector("#end-date");
    const daysRequestedInput = form.querySelector("#days-requested");
    const leaveOtherInput = form.querySelector("#leave-other");
    const leaveTypeInputs = Array.from(form.querySelectorAll('input[name="leaveType"]'));
    const groupedDetailInputs = {
      vacation: Array.from(form.querySelectorAll('input[name="leaveLocation"]')),
      sick: Array.from(form.querySelectorAll('input[name="sickDetail"]')),
      women: Array.from(form.querySelectorAll('input[name="leavePurpose"][value="women-illness"]')),
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

    const syncLeaveTypeState = () => {
      const selectedLeaveType = leaveTypeInputs.find((input) => input.checked)?.value || "";
      const enabledGroups = new Set(detailGroupRules[selectedLeaveType] || []);

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
        const otherSelected = selectedLeaveType === "others";
        leaveOtherInput.disabled = !otherSelected;
        if (!otherSelected) {
          leaveOtherInput.value = "";
        }
      }
    };

    const syncDaysRequested = () => {
      if (!startDateInput || !endDateInput || !daysRequestedInput) {
        return;
      }

      const startDateValue = startDateInput.value;
      const endDateValue = endDateInput.value;
      if (!startDateValue || !endDateValue) {
        return;
      }

      const startDate = new Date(`${startDateValue}T00:00:00`);
      const endDate = new Date(`${endDateValue}T00:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        return;
      }

      const millisecondsPerDay = 24 * 60 * 60 * 1000;
      const computedDays = Math.floor((endDate - startDate) / millisecondsPerDay) + 1;
      daysRequestedInput.value = String(computedDays);
    };

    const sanitizeDaysRequested = () => {
      if (!daysRequestedInput) {
        return;
      }

      const digitsOnly = String(daysRequestedInput.value || "").replace(/[^\d]/g, "");
      daysRequestedInput.value = digitsOnly;
    };

    leaveTypeInputs.forEach((input) => input.addEventListener("change", syncLeaveTypeState));
    startDateInput?.addEventListener("change", syncDaysRequested);
    endDateInput?.addEventListener("change", syncDaysRequested);
    daysRequestedInput?.addEventListener("input", sanitizeDaysRequested);
    syncLeaveTypeState();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const vacationLocation = formData.getAll("leaveLocation").map((value) => String(value));
      const sickLeaveDetails = formData.getAll("sickDetail").map((value) => String(value));

      const payload = {
        employee_id: profile.id,
        leave_type: String(formData.get("leaveType") || ""),
        office_department: String(document.getElementById("office-department")?.value || profile.department || ""),
        applicant_last_name: String(document.getElementById("applicant-last")?.value || profile.last_name || ""),
        applicant_first_name: String(document.getElementById("applicant-first")?.value || profile.first_name || ""),
        applicant_middle_name: String(document.getElementById("applicant-middle")?.value || profile.middle_name || ""),
        filing_date: String(document.getElementById("filing-date")?.value || ""),
        position_title: String(document.getElementById("position-title")?.value || profile.position_title || ""),
        salary_display: String(document.getElementById("salary-display")?.value || "N/A"),
        start_date: String(formData.get("startDate") || ""),
        end_date: String(formData.get("endDate") || ""),
        days_requested: Number.parseInt(String(formData.get("daysRequested") || "0"), 10),
        other_leave_details: String(document.getElementById("leave-other")?.value || "").trim(),
        vacation_location: vacationLocation,
        sick_leave_details: sickLeaveDetails,
        commutation: String(formData.get("commutation") || ""),
        reason: String(formData.get("reason") || "")
      };

      if (!Number.isInteger(payload.days_requested) || payload.days_requested <= 0) {
        window.alert("Working days must be a whole number greater than zero.");
        return;
      }

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
        p_days_requested: payload.days_requested,
        p_other_leave_details: payload.other_leave_details,
        p_vacation_location: payload.vacation_location,
        p_sick_leave_details: payload.sick_leave_details,
        p_commutation: payload.commutation,
        p_reason: payload.reason
      });

      if (error) {
        window.alert(error.message);
        return;
      }

      form.reset();
      populateLeaveApplicationProfile(profile);
      syncLeaveTypeState();
      await loadEmployeeRequests(profile.id);
      window.alert("Leave request submitted.");
    });
  }

  async function loadAdminProfiles() {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "login.html";
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

    const list = document.getElementById("admin-summary-list");
    if (!list) {
      return;
    }

    if (!data.length) {
      list.innerHTML = '<li class="empty-state">No employee profiles found.</li>';
      return;
    }

    list.innerHTML = data.map((profile) => `
      <li>
        <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong>
        <div>${escapeHtml(profile.employee_no || "No employee number")}</div>
        <div>${escapeHtml(profile.department)} | ${escapeHtml(profile.position_title)}</div>
      </li>
    `).join("");
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
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th>Status</th>
            <th>Credits</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${profiles.map((profile) => `
            <tr>
              <td>
                <strong>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</strong><br>
                ${escapeHtml(profile.employee_no || "No employee number")}<br>
                ${escapeHtml(profile.email || "No email")}
              </td>
              <td>${escapeHtml(profile.department)}<br>${escapeHtml(profile.position_title)}</td>
              <td><span class="badge ${profile.employment_status === "active" ? "approved" : profile.employment_status === "inactive" ? "pending" : "rejected"}">${escapeHtml(capitalize(profile.employment_status || "active"))}</span></td>
              <td>${escapeHtml(Number(profile.leave_credits || 0).toFixed(2))}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="button button-muted" data-edit-employee="${profile.id}">Edit</button>
                  <button type="button" class="button button-danger" data-delete-employee="${profile.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
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

    if (!form) {
      return;
    }

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

      if (employeeId) {
        await updateEmployeeAccount(employeeId, payload);
        return;
      }

      await createEmployeeAccount(payload);
    });

    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        resetEmployeeForm();
      });
    }
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
    setText("employee-number-preview", profile.employee_no || "Auto-generated on create");

    setText("employee-submit-button", "Update Employee");
    document.getElementById("employee-cancel-button")?.classList.remove("hidden");
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
    setText("employee-number-preview", "Auto-generated on create");
    setText("employee-submit-button", "Create Employee");
    document.getElementById("employee-cancel-button")?.classList.add("hidden");
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

    resetEmployeeForm();
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

    resetEmployeeForm();
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
      window.location.href = "login.html";
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
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Leave Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((request) => `
            <tr>
              <td>${escapeHtml(getApplicantFullName(request) || "Unnamed applicant")}</td>
              <td>${escapeHtml(formatLeaveType(request.leave_type))}</td>
              <td>${escapeHtml(request.start_date)}<br>${escapeHtml(request.end_date)}</td>
              <td>${escapeHtml(String(request.days_requested))}</td>
              <td><span class="badge ${escapeHtml(request.status)}">${escapeHtml(capitalize(request.status))}</span></td>
              <td>${escapeHtml(request.reason)}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="button button-muted" data-view-request="${request.id}">View Form</button>
                  <button type="button" class="button button-success" data-update-request="${request.id}" data-status="approved">Approve</button>
                  <button type="button" class="button button-danger" data-update-request="${request.id}" data-status="rejected">Reject</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    Array.from(container.querySelectorAll("[data-view-request]")).forEach((button) => {
      button.addEventListener("click", () => {
        const requestId = Number(button.getAttribute("data-view-request"));
        selectedAdminRequestId = requestId;
        renderSelectedAdminRequest();
      });
    });

    Array.from(container.querySelectorAll("[data-update-request]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const requestId = Number(button.getAttribute("data-update-request"));
        const status = button.getAttribute("data-status");
        selectedAdminRequestId = requestId;
        await updateLeaveStatus(requestId, status);
      });
    });
  }

  function syncSelectedAdminRequest() {
    if (!adminLeaveRequests.length) {
      selectedAdminRequestId = null;
      renderSelectedAdminRequest();
      return;
    }

    const selectedRequestExists = adminLeaveRequests.some((request) => request.id === selectedAdminRequestId);
    if (!selectedRequestExists) {
      selectedAdminRequestId = adminLeaveRequests[0].id;
    }

    renderSelectedAdminRequest();
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

    container.querySelector("[data-admin-approve-request]")?.addEventListener("click", async () => {
      await updateLeaveStatus(request.id, "approved");
    });

    container.querySelector("[data-admin-reject-request]")?.addEventListener("click", async () => {
      await updateLeaveStatus(request.id, "rejected");
    });
  }

  async function updateLeaveStatus(requestId, status) {
    const session = getSession();
    if (!session || session.role !== "admin") {
      window.location.href = "login.html";
      return;
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

  function buildAdminRequestPreviewMarkup(request) {
    return `
      <div class="admin-request-toolbar">
        <div>
          <strong>${escapeHtml(getApplicantFullName(request) || "Unnamed applicant")}</strong>
          <div class="muted">Request #${escapeHtml(String(request.id))} | ${escapeHtml(capitalize(request.status))}</div>
        </div>
        <div class="table-actions">
          <button type="button" class="button button-muted" data-admin-print-request>Print / Save PDF</button>
          <button type="button" class="button button-muted" data-admin-download-word>Download Word</button>
          <button type="button" class="button button-success" data-admin-approve-request>Approve</button>
          <button type="button" class="button button-danger" data-admin-reject-request>Reject</button>
        </div>
      </div>
      ${buildAdminRequestPaperMarkup(request)}
    `;
  }

  function buildAdminRequestPaperMarkup(request) {
    const leaveType = String(request.leave_type || "").toLowerCase();
    const vacationLocations = Array.isArray(request.vacation_location) ? request.vacation_location : [];
    const sickDetails = Array.isArray(request.sick_leave_details) ? request.sick_leave_details : [];
    const creditSnapshot = buildLeaveCreditSnapshot(request);
    const creditCells = buildCreditCellValues(request, creditSnapshot);
    const recommendationDetails = request.recommendation_details || `With pay: ${creditSnapshot.paidDays} day(s); without pay: ${creditSnapshot.unpaidDays} day(s).`;

    return `
      <section class="leave-paper admin-request-paper leave-paper-static">
        <div class="leave-paper-topline">
          <div class="leave-paper-form-series">
            <p class="leave-paper-note">Civil Service Form No. 6</p>
            <p class="leave-paper-note">Revised 2020</p>
          </div>
          <div class="leave-paper-stamp">Status: ${escapeHtml(capitalize(request.status))}</div>
        </div>

        <div class="leave-paper-heading-grid">
          <div class="leave-paper-seal-wrap">
            <img src="OIP (1).webp" alt="Agdangan seal" class="leave-paper-seal">
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
              <div class="leave-paper-readonly">${escapeHtml(request.office_department || "")}</div>
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
                <div class="leave-paper-inline-line">${escapeHtml(request.applicant_last_name || "")}</div>
                <div class="leave-paper-inline-line">${escapeHtml(request.applicant_first_name || "")}</div>
                <div class="leave-paper-inline-line">${escapeHtml(request.applicant_middle_name || "")}</div>
              </div>
            </div>
          </div>

          <div class="leave-paper-row leave-paper-row-compact">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">3. Date of Filing</span>
              <div class="leave-paper-readonly">${escapeHtml(formatDateDisplay(request.filing_date))}</div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">4. Position</span>
              <div class="leave-paper-readonly">${escapeHtml(request.position_title || "")}</div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">5. Salary</span>
              <div class="leave-paper-readonly">${escapeHtml(request.salary_display || "N/A")}</div>
            </div>
          </div>

          <div class="leave-paper-section-title">6. Details of Application</div>

          <div class="leave-paper-panel-grid">
            <fieldset class="leave-paper-panel">
              <legend>6.A Type of Leave to Be Availed Of</legend>
              <div class="leave-type-grid">
                ${renderLeavePaperOption("radio", "Vacation Leave", leaveType === "vacation")}
                ${renderLeavePaperOption("radio", "Mandatory/Forced Leave", leaveType === "mandatory-forced")}
                ${renderLeavePaperOption("radio", "Sick Leave", leaveType === "sick")}
                ${renderLeavePaperOption("radio", "Maternity Leave", leaveType === "maternity")}
                ${renderLeavePaperOption("radio", "Paternity Leave", leaveType === "paternity")}
                ${renderLeavePaperOption("radio", "Special Privilege Leave", leaveType === "special-privilege")}
                ${renderLeavePaperOption("radio", "Wellness Leave", leaveType === "wellness")}
                ${renderLeavePaperOption("radio", "Solo Parent Leave", leaveType === "solo-parent")}
                ${renderLeavePaperOption("radio", "Study Leave", leaveType === "study")}
                ${renderLeavePaperOption("radio", "10-Day VAWC Leave", leaveType === "vawc")}
                ${renderLeavePaperOption("radio", "Rehabilitation Privilege", leaveType === "rehabilitation-privilege")}
                ${renderLeavePaperOption("radio", "Special Leave Benefits for Women", leaveType === "special-benefits-women")}
                ${renderLeavePaperOption("radio", "Special Emergency (Calamity) Leave", leaveType === "special-emergency-calamity")}
                ${renderLeavePaperOption("radio", "Adoption Leave", leaveType === "adoption")}
                ${renderLeavePaperOption("radio", "Others", leaveType === "others")}
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
                  ${renderLeavePaperOption("checkbox", "Within the Philippines", vacationLocations.includes("within-ph"))}
                  ${renderLeavePaperOption("checkbox", "Abroad (Specify)", vacationLocations.includes("abroad"))}
                </div>
              </div>

              <div class="leave-paper-subgroup">
                <p>In case of Sick Leave:</p>
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOption("checkbox", "In Hospital (Specify Illness)", sickDetails.includes("in-hospital"))}
                  ${renderLeavePaperOption("checkbox", "Out Patient (Specify Illness)", sickDetails.includes("out-patient"))}
                </div>
              </div>

              <div class="field leave-paper-reason-field">
                <label>Specify Purpose / Reason / Details</label>
                <div class="leave-paper-readonly">${escapeHtml(request.reason || "")}</div>
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
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">6.D Commutation</span>
              <div class="leave-paper-bullets">
                ${renderLeavePaperOption("radio", "Not Requested", request.commutation === "not-requested")}
                ${renderLeavePaperOption("radio", "Requested", request.commutation === "requested")}
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
              <div class="leave-paper-credit-note">As of <span class="leave-paper-credit-line">${escapeHtml(formatDateDisplay(creditSnapshot.creditAsOf))}</span></div>
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
                <div class="leave-paper-line">${escapeHtml(formatNumberDisplay(creditSnapshot.monthlyGain))} monthly credit gain</div>
                <strong>Authorized Officer</strong>
                <span>(Authorized Officer)</span>
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.B Recommendation</span>
              <div class="leave-paper-action-box">
                <div class="leave-paper-bullets">
                  ${renderLeavePaperOption("checkbox", "For approval", request.recommendation === "approved" || request.status === "approved")}
                  ${renderLeavePaperOption("checkbox", "For disapproval due to", request.recommendation === "rejected" || request.status === "rejected")}
                </div>
                <div class="leave-paper-action-writing">
                  ${renderStaticWritingLines(recommendationDetails, 3)}
                </div>
              </div>
              <div class="leave-paper-officer">
                <div class="leave-paper-line">${escapeHtml(isCommutationRequested(request) ? "Commutation requested" : "Commutation not requested")}</div>
                <strong>Authorized Officer</strong>
                <span>(Authorized Officer)</span>
              </div>
            </div>
          </div>

          <div class="leave-paper-row leave-paper-row-bottom">
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.C Approved For</span>
              <div class="leave-paper-approval-lines">
                <div class="leave-paper-approval-item"><span class="leave-paper-inline-blank">${escapeHtml(formatIntegerDisplay(request.approved_with_pay_days))}</span> days with pay</div>
                <div class="leave-paper-approval-item"><span class="leave-paper-inline-blank">${escapeHtml(formatIntegerDisplay(request.approved_without_pay_days))}</span> days without pay</div>
                <div class="leave-paper-approval-item"><span class="leave-paper-inline-blank">${escapeHtml(request.approved_other_details || "-")}</span> others (Specify)</div>
              </div>
            </div>
            <div class="leave-paper-cell">
              <span class="leave-paper-label">7.D Disapproved Due To</span>
              <div class="leave-paper-action-box">
                <div class="leave-paper-action-writing">
                  ${renderStaticWritingLines(request.disapproval_details || "", 3)}
                </div>
              </div>
            </div>
          </div>

          <div class="leave-paper-authorized">
            <div class="leave-paper-line">${escapeHtml(getApplicantFullName(request) || "")}</div>
            <strong>Authorized Official</strong>
            <span>(Authorized Official)</span>
          </div>
        </div>
      </section>
    `;
  }

  function renderLeavePaperOption(type, label, isChecked) {
    return `
      <label class="leave-option">
        <input type="${type}" ${isChecked ? "checked" : ""} disabled>
        <span>${escapeHtml(label)}</span>
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
          @page { size: A4; margin: 10mm; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f3f4f6;
            color: #111;
          }
          .print-shell {
            width: 210mm;
            min-height: 277mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
          .leave-paper {
            width: 100%;
            box-sizing: border-box;
            background: #fff;
            border: 2px solid #111;
            font-family: Arial, sans-serif;
            color: #111;
          }
          .leave-paper-topline,
          .leave-paper-row,
          .leave-paper-panel-grid,
          .leave-paper-form {
            display: grid;
          }
          .leave-paper-topline {
            grid-template-columns: 1fr auto;
            gap: 4mm;
            padding: 3.5mm 4.5mm 1mm;
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
            font-size: 9px;
            font-style: italic;
            line-height: 1.2;
          }
          .leave-paper-stamp {
            align-self: start;
            min-width: 28mm;
            padding: 2mm 2.5mm;
            border: 1px solid #111;
            text-align: center;
            font-size: 9px;
          }
          .leave-paper-heading-grid {
            display: grid;
            grid-template-columns: 18mm 1fr 18mm;
            align-items: center;
            gap: 3mm;
            padding: 0 4.5mm 3mm;
            border-bottom: 1px solid #111;
          }
          .leave-paper-seal-wrap {
            display: flex;
            justify-content: center;
          }
          .leave-paper-seal {
            width: 14mm;
            height: 14mm;
            object-fit: contain;
          }
          .leave-paper-heading {
            text-align: center;
          }
          .leave-paper-government {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            line-height: 1.15;
          }
          .leave-paper-heading h3 {
            margin: 2.5mm 0 0;
            font-size: 22px;
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
            padding: 2.6mm 3mm;
            border-right: 1px solid #111;
            border-bottom: 1px solid #111;
          }
          .leave-paper-row > .leave-paper-cell:last-child,
          .leave-paper-panel:last-child {
            border-right: 0;
          }
          .leave-paper-form > .leave-paper-row:first-of-type > .leave-paper-cell:first-child,
          .leave-paper-form > .leave-paper-row:first-of-type > .leave-paper-cell:nth-child(2),
          .leave-paper-form > .leave-paper-row-compact > .leave-paper-cell:first-child,
          .leave-paper-form > .leave-paper-row-compact > .leave-paper-cell:nth-child(2),
          .leave-paper-form > .leave-paper-row-compact > .leave-paper-cell:nth-child(3) {
            border-right: 0;
          }
          .leave-paper-label {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
          }
          .leave-paper-name-header {
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: end;
            gap: 3mm;
            margin-bottom: 1mm;
          }
          .leave-paper-name-header .leave-paper-label {
            margin-bottom: 0;
          }
          .leave-paper-inline-captions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2mm;
            text-align: center;
            font-size: 8px;
          }
          .leave-paper-inline-fields,
          .leave-paper-date-range {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2mm;
          }
          .leave-paper-date-range {
            grid-template-columns: 1fr 1fr;
          }
          .leave-paper-inline-line,
          .leave-paper-readonly,
          .leave-paper-line {
            min-height: 7mm;
            border-bottom: 1px solid #111;
            font-size: 10px;
            color: #111;
          }
          .leave-paper-inline-line,
          .leave-paper-readonly {
            padding-top: 2mm;
          }
          .leave-paper-readonly-centered {
            text-align: center;
          }
          .leave-paper-section-title {
            padding: 1.2mm 4mm;
            border-top: 1px solid #111;
            border-bottom: 1px solid #111;
            text-align: center;
            font-size: 10px;
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
          .leave-paper-panel legend {
            padding: 0 1mm;
            font-size: 9px;
            font-weight: 800;
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
            gap: 1.4mm;
          }
          .leave-option {
            display: flex;
            align-items: flex-start;
            gap: 2mm;
            font-size: 10px;
            line-height: 1.2;
          }
          .leave-option input {
            width: 3.2mm;
            height: 3.2mm;
            margin: 0.4mm 0 0;
          }
          .leave-paper-subgroup p,
          .leave-paper-signature span,
          .leave-paper-officer span,
          .leave-paper-authorized span,
          .leave-paper-credit-note {
            margin: 0;
            font-size: 10px;
          }
          .leave-paper-credit-note {
            text-align: center;
            margin-bottom: 1.4mm;
          }
          .leave-paper-credit-line {
            display: inline-block;
            min-width: 30mm;
            margin-left: 1.5mm;
            border-bottom: 1px solid #111;
            vertical-align: middle;
          }
          .leave-paper-credit-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 3mm;
          }
          .leave-paper-credit-table th,
          .leave-paper-credit-table td {
            border: 1px solid #111;
            padding: 1.2mm;
            text-align: center;
            vertical-align: middle;
          }
          .leave-paper-credit-table th:first-child,
          .leave-paper-credit-table td:first-child {
            text-align: left;
          }
          .leave-paper-inline-blank {
            display: inline-block;
            min-width: 18mm;
            border-bottom: 1px solid #111;
            font-size: 10px;
          }
          .leave-paper-signature,
          .leave-paper-officer,
          .leave-paper-authorized {
            text-align: center;
            margin-top: 3mm;
          }
          .leave-paper-action-line {
            min-height: 5mm;
            border-bottom: 1px solid #111;
            font-size: 10px;
          }
          @media print {
            body {
              background: #fff;
            }
            .print-shell {
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
      window.location.href = "login.html";
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

  function isCommutationRequested(request) {
    return String(request?.commutation || "").toLowerCase() === "requested";
  }

  function buildLeaveCreditSnapshot(request) {
    const employee = getAdminEmployeeProfileById(request.employee_id);
    const currentCredits = Number(employee?.leave_credits || 0);
    const storedCreditsBeforeDeduction = Number(request.credit_earned_vacation);
    const storedBalanceAfterDeduction = Number(request.credit_balance_vacation);
    const daysRequested = Number(request.days_requested || 0);
    const creditsBeforeDeduction = Number.isFinite(storedCreditsBeforeDeduction)
      ? storedCreditsBeforeDeduction
      : currentCredits;
    const deduction = isCommutationRequested(request) ? daysRequested : 0;
    const projectedBalance = Number.isFinite(storedBalanceAfterDeduction)
      ? storedBalanceAfterDeduction
      : Math.max(creditsBeforeDeduction - deduction, 0);
    const paidDays = request.approved_with_pay_days === null || request.approved_with_pay_days === undefined
      ? Math.min(daysRequested, Math.floor(creditsBeforeDeduction))
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
    const useSickColumn = ["sick", "wellness"].includes(String(request.leave_type || "").toLowerCase());

    return {
      vacation: {
        current: useSickColumn ? "-" : formatNumberDisplay(snapshot.currentCredits),
        deduction: useSickColumn ? "-" : formatNumberDisplay(snapshot.deduction),
        balance: useSickColumn ? "-" : formatNumberDisplay(snapshot.projectedBalance)
      },
      sick: {
        current: useSickColumn ? formatNumberDisplay(snapshot.currentCredits) : "-",
        deduction: useSickColumn ? formatNumberDisplay(snapshot.deduction) : "-",
        balance: useSickColumn ? formatNumberDisplay(snapshot.projectedBalance) : "-"
      }
    };
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
          <div><span class="badge pending">Pending</span></div>
        </li>
        <li>
          <strong>Sick</strong>
          <div>2026-05-10 to 2026-05-11</div>
          <div>2 day(s)</div>
          <div><span class="badge approved">Approved</span></div>
        </li>
      `;
    }
  }

  function renderAdminDemo() {
    adminEmployeeProfiles = [{
      id: 1,
      leave_credits: 12.5
    }];

    setText("admin-name", "Welcome, System Administrator");
    setText("admin-meta", "HR | Municipal Administrator");
    setText("stat-employees", "24");
    setText("stat-admin-pending", "5");
    setText("stat-admin-approved", "16");
    setText("stat-admin-rejected", "2");
    setText("employee-number-preview", "Auto-generated on create");

    const list = document.getElementById("admin-summary-list");
    if (list) {
      list.innerHTML = `
        <li>
          <strong>Juan Dela Cruz</strong>
          <div>EMP-0001</div>
          <div>Treasury | Administrative Aide</div>
        </li>
        <li>
          <strong>Maria Santos</strong>
          <div>EMP-002</div>
          <div>Accounting | Records Officer</div>
        </li>
      `;
    }

    const employeesTable = document.getElementById("admin-employees-table");
    if (employeesTable) {
      employeesTable.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Status</th>
              <th>Credits</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Juan Dela Cruz</strong><br>EMP-0001<br>juan.delacruz@agdangan.gov.ph</td>
              <td>Treasury<br>Administrative Aide</td>
              <td><span class="badge approved">Active</span></td>
              <td>12.50</td>
              <td><div class="table-actions"><button type="button" class="button button-muted">Edit</button><button type="button" class="button button-danger">Delete</button></div></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const table = document.getElementById("admin-requests-table");
    if (table) {
      table.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Dates</th>
              <th>Days</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Juan Dela Cruz</td>
              <td>Vacation</td>
              <td>2026-05-28<br>2026-05-30</td>
              <td>3</td>
              <td><span class="badge pending">Pending</span></td>
              <td>Family travel</td>
              <td><div class="table-actions"><button type="button" class="button button-muted">View Form</button><button type="button" class="button button-success">Approve</button><button type="button" class="button button-danger">Reject</button></div></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const preview = document.getElementById("admin-request-preview");
    if (preview) {
      preview.innerHTML = buildAdminRequestPreviewMarkup({
        id: 1,
        employee_id: 1,
        status: "pending",
        leave_type: "vacation",
        office_department: "Treasury",
        applicant_last_name: "Dela Cruz",
        applicant_first_name: "Juan",
        applicant_middle_name: "S.",
        filing_date: "2026-05-21",
        position_title: "Administrative Aide",
        salary_display: "N/A",
        start_date: "2026-05-28",
        end_date: "2026-05-30",
        days_requested: 3,
        other_leave_details: "",
        vacation_location: ["within-ph"],
        sick_leave_details: [],
        commutation: "not-requested",
        reason: "Family travel",
        credit_as_of: null,
        credit_earned_vacation: null,
        credit_earned_sick: null,
        credit_balance_vacation: null,
        credit_balance_sick: null,
        recommendation: null,
        recommendation_details: "",
        approved_with_pay_days: null,
        approved_without_pay_days: null,
        approved_other_details: "",
        disapproval_details: ""
      });
    }
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function formatLeaveType(value) {
    const key = String(value || "").trim().toLowerCase();
    return leaveTypeLabels[key] || capitalize(key);
  }
})();
