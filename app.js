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
  let leaveTemplateDataUrlPromise = null;
  const leaveTemplateImagePath = "8bc64884-13da-46ba-9175-41349fe27db7.jpeg";
  const leaveTypeLabels = {
    vacation: "Vacation Leave",
    "mandatory-forced": "Mandatory/Forced Leave",
    sick: "Sick Leave",
    maternity: "Maternity Leave",
    paternity: "Paternity Leave",
    "special-privilege": "Special Privilege Leave",
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
    if (pageName === "login.html") {
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

    if (configStatus) {
      configStatus.hidden = isConfigured;
      configStatus.textContent = isConfigured
        ? ""
        : "Supabase is not configured yet. Open supabase-config.js and set your project values first.";
    }

    switchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const role = button.getAttribute("data-role-switch");
        switchButtons.forEach((item) => item.classList.toggle("active", item === button));
        roleInput.value = role;
        title.textContent = role === "admin" ? "Admin Sign In" : "Employee Sign In";
        subtitle.textContent = role === "admin"
          ? "Use your admin table credentials to review and approve leave requests."
          : "Use your employee table credentials to open your leave dashboard.";
      });
    });

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

    const syncLeaveTypeState = () => {
      if (leaveOtherInput) {
        leaveOtherInput.disabled = false;
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

    leaveTypeInputs.forEach((input) => input.addEventListener("change", syncLeaveTypeState));
    startDateInput?.addEventListener("change", syncDaysRequested);
    endDateInput?.addEventListener("change", syncDaysRequested);
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
        days_requested: Number(formData.get("daysRequested") || 0),
        other_leave_details: String(document.getElementById("leave-other")?.value || "").trim(),
        vacation_location: vacationLocation,
        sick_leave_details: sickLeaveDetails,
        commutation: String(formData.get("commutation") || ""),
        reason: String(formData.get("reason") || "")
      };

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

    container.querySelector("[data-admin-print-request]")?.addEventListener("click", async () => {
      await printAdminLeaveRequest(request);
    });

    container.querySelector("[data-admin-download-word]")?.addEventListener("click", async () => {
      await downloadAdminLeaveRequestWord(request);
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

    return `
      <section class="admin-request-paper">
        <div class="admin-paper-header">
          <div>
            <div class="admin-paper-eyebrow">Republic of the Philippines</div>
            <h4>Application for Leave</h4>
          </div>
          <div class="badge ${escapeHtml(request.status)}">${escapeHtml(capitalize(request.status))}</div>
        </div>

        <div class="admin-paper-grid admin-paper-grid-two">
          <div class="admin-paper-field">
            <span class="admin-paper-label">1. Office / Department</span>
            <div class="admin-paper-value">${escapeHtml(request.office_department || "-")}</div>
          </div>
          <div class="admin-paper-field">
            <span class="admin-paper-label">2. Applicant</span>
            <div class="admin-paper-value">${escapeHtml(getApplicantFullName(request) || "-")}</div>
          </div>
        </div>

        <div class="admin-paper-grid admin-paper-grid-three">
          <div class="admin-paper-field">
            <span class="admin-paper-label">3. Date of Filing</span>
            <div class="admin-paper-value">${escapeHtml(formatDateDisplay(request.filing_date))}</div>
          </div>
          <div class="admin-paper-field">
            <span class="admin-paper-label">4. Position</span>
            <div class="admin-paper-value">${escapeHtml(request.position_title || "-")}</div>
          </div>
          <div class="admin-paper-field">
            <span class="admin-paper-label">5. Salary</span>
            <div class="admin-paper-value">${escapeHtml(request.salary_display || "N/A")}</div>
          </div>
        </div>

        <div class="admin-paper-section-title">6. Details of Application</div>

        <div class="admin-paper-grid admin-paper-grid-two">
          <div class="admin-paper-panel">
            <span class="admin-paper-label">6.A Type of Leave to Be Availed Of</span>
            <div class="admin-paper-option-list">
              ${renderAdminOptionRow("Vacation Leave", leaveType === "vacation")}
              ${renderAdminOptionRow("Mandatory/Forced Leave", leaveType === "mandatory-forced")}
              ${renderAdminOptionRow("Sick Leave", leaveType === "sick")}
              ${renderAdminOptionRow("Maternity Leave", leaveType === "maternity")}
              ${renderAdminOptionRow("Paternity Leave", leaveType === "paternity")}
              ${renderAdminOptionRow("Special Privilege Leave", leaveType === "special-privilege")}
              ${renderAdminOptionRow("Solo Parent Leave", leaveType === "solo-parent")}
              ${renderAdminOptionRow("Study Leave", leaveType === "study")}
              ${renderAdminOptionRow("10-Day VAWC Leave", leaveType === "vawc")}
              ${renderAdminOptionRow("Rehabilitation Privilege", leaveType === "rehabilitation-privilege")}
              ${renderAdminOptionRow("Special Leave Benefits for Women", leaveType === "special-benefits-women")}
              ${renderAdminOptionRow("Special Emergency (Calamity) Leave", leaveType === "special-emergency-calamity")}
              ${renderAdminOptionRow("Adoption Leave", leaveType === "adoption")}
              ${renderAdminOptionRow("Others", leaveType === "others")}
            </div>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Others</span>
              <div class="admin-paper-value">${escapeHtml(request.other_leave_details || "-")}</div>
            </div>
          </div>

          <div class="admin-paper-panel">
            <span class="admin-paper-label">6.B Details of Leave</span>
            <div class="admin-paper-subsection">
              <strong>Vacation / Special Privilege Leave</strong>
              ${renderAdminOptionRow("Within the Philippines", vacationLocations.includes("within-ph"))}
              ${renderAdminOptionRow("Abroad (Specify)", vacationLocations.includes("abroad"))}
            </div>
            <div class="admin-paper-subsection">
              <strong>Sick Leave</strong>
              ${renderAdminOptionRow("In Hospital (Specify Illness)", sickDetails.includes("in-hospital"))}
              ${renderAdminOptionRow("Out Patient (Specify Illness)", sickDetails.includes("out-patient"))}
            </div>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Specify Purpose / Reason</span>
              <div class="admin-paper-value admin-paper-value-block">${escapeHtml(request.reason || "-")}</div>
            </div>
          </div>
        </div>

        <div class="admin-paper-grid admin-paper-grid-two">
          <div class="admin-paper-panel">
            <span class="admin-paper-label">6.C Number of Working Days Applied For</span>
            <div class="admin-paper-value">${escapeHtml(String(request.days_requested || "-"))}</div>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Inclusive Dates</span>
              <div class="admin-paper-value">${escapeHtml(formatDateDisplay(request.start_date))} to ${escapeHtml(formatDateDisplay(request.end_date))}</div>
            </div>
          </div>
          <div class="admin-paper-panel">
            <span class="admin-paper-label">6.D Commutation</span>
            ${renderAdminOptionRow("Not Requested", request.commutation === "not-requested")}
            ${renderAdminOptionRow("Requested", request.commutation === "requested")}
          </div>
        </div>

        <div class="admin-paper-section-title">7. Action on Application</div>

        <div class="admin-paper-grid admin-paper-grid-two">
          <div class="admin-paper-panel">
            <span class="admin-paper-label">7.A Certification of Leave Credits</span>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">As of</span>
              <div class="admin-paper-value">${escapeHtml(formatDateDisplay(request.credit_as_of))}</div>
            </div>
            <table class="admin-paper-table">
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
                  <td>${escapeHtml(formatNumberDisplay(request.credit_earned_vacation))}</td>
                  <td>${escapeHtml(formatNumberDisplay(request.credit_earned_sick))}</td>
                </tr>
                <tr>
                  <td>Balance</td>
                  <td>${escapeHtml(formatNumberDisplay(request.credit_balance_vacation))}</td>
                  <td>${escapeHtml(formatNumberDisplay(request.credit_balance_sick))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-paper-panel">
            <span class="admin-paper-label">7.B Recommendation</span>
            ${renderAdminOptionRow("For approval", request.recommendation === "approved" || request.status === "approved")}
            ${renderAdminOptionRow("For disapproval", request.recommendation === "rejected" || request.status === "rejected")}
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Details</span>
              <div class="admin-paper-value admin-paper-value-block">${escapeHtml(request.recommendation_details || "-")}</div>
            </div>
          </div>
        </div>

        <div class="admin-paper-grid admin-paper-grid-two">
          <div class="admin-paper-panel">
            <span class="admin-paper-label">7.C Approved For</span>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Days with pay</span>
              <div class="admin-paper-value">${escapeHtml(formatIntegerDisplay(request.approved_with_pay_days))}</div>
            </div>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Days without pay</span>
              <div class="admin-paper-value">${escapeHtml(formatIntegerDisplay(request.approved_without_pay_days))}</div>
            </div>
            <div class="admin-paper-field admin-paper-subfield">
              <span class="admin-paper-label">Others</span>
              <div class="admin-paper-value">${escapeHtml(request.approved_other_details || "-")}</div>
            </div>
          </div>
          <div class="admin-paper-panel">
            <span class="admin-paper-label">7.D Disapproved Due To</span>
            <div class="admin-paper-value admin-paper-value-block">${escapeHtml(request.disapproval_details || "-")}</div>
          </div>
        </div>
      </section>
    `;
  }

  function renderAdminOptionRow(label, isChecked) {
    return `
      <div class="admin-paper-option">
        <span class="admin-paper-check">${isChecked ? "X" : "&nbsp;"}</span>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  async function printAdminLeaveRequest(request) {
    const printWindow = window.open("", "_blank", "width=960,height=1200");
    if (!printWindow) {
      window.alert("Allow pop-ups to print or save this leave form as PDF.");
      return;
    }

    printWindow.document.write(await buildAdminRequestDocument(request, "print"));
    printWindow.document.close();
    printWindow.focus();
  }

  async function downloadAdminLeaveRequestWord(request) {
    const documentHtml = await buildAdminRequestDocument(request, "word");
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

  async function buildAdminRequestDocument(request, mode) {
    const title = `Leave Request ${request.id}`;
    const autoPrint = mode === "print"
      ? "<script>window.addEventListener('load', function () { window.print(); });<\/script>"
      : "";
    const templateImage = await getLeaveTemplateDataUrl();
    const overlayMarkup = buildAdminRequestTemplateOverlayMarkup(request);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 0; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #e9ecef;
            color: #111;
          }
          .print-shell {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            box-sizing: border-box;
            background: #fff;
            position: relative;
            overflow: hidden;
          }
          .template-image {
            position: absolute;
            inset: 0;
            width: 210mm;
            height: 297mm;
            object-fit: cover;
          }
          .template-overlay {
            position: absolute;
            inset: 0;
            font-family: Arial, sans-serif;
            color: #111;
          }
          .field {
            position: absolute;
            font-weight: 700;
            line-height: 1.05;
            white-space: nowrap;
          }
          .field.small { font-size: 9px; }
          .field.medium { font-size: 10px; }
          .field.large { font-size: 11px; }
          .field.xlarge { font-size: 13px; }
          .field.wrap {
            white-space: normal;
            word-break: break-word;
          }
          .field.center { text-align: center; }
          .field.right { text-align: right; }
          .field.italic { font-style: italic; }
          .mark {
            position: absolute;
            font-weight: 700;
            font-size: 10px;
            line-height: 1;
          }
          .status-pill {
            position: absolute;
            top: 8mm;
            right: 8mm;
            padding: 1.2mm 2.5mm;
            border: 0.3mm solid #111;
            background: rgba(255, 255, 255, 0.9);
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="print-shell">
          <img class="template-image" src="${templateImage}" alt="Leave form template">
          <div class="status-pill">${escapeHtml(capitalize(request.status))}</div>
          <div class="template-overlay">
            ${overlayMarkup}
          </div>
        </div>
        ${autoPrint}
      </body>
      </html>
    `;
  }

  async function getLeaveTemplateDataUrl() {
    if (!leaveTemplateDataUrlPromise) {
      leaveTemplateDataUrlPromise = fetch(leaveTemplateImagePath)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Unable to load leave form template image.");
          }
          return response.blob();
        })
        .then((blob) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Unable to read leave form template image."));
          reader.readAsDataURL(blob);
        }))
        .catch((error) => {
          leaveTemplateDataUrlPromise = null;
          throw error;
        });
    }

    return leaveTemplateDataUrlPromise;
  }

  function buildAdminRequestTemplateOverlayMarkup(request) {
    const topScale = 0.594;
    const ty = (value) => `${(value * topScale).toFixed(2)}mm`;
    const leaveType = String(request.leave_type || "").toLowerCase();
    const vacationLocations = Array.isArray(request.vacation_location) ? request.vacation_location : [];
    const sickDetails = Array.isArray(request.sick_leave_details) ? request.sick_leave_details : [];
    const statusApproved = request.status === "approved";
    const statusRejected = request.status === "rejected";
    const applicantName = {
      last: request.applicant_last_name || "",
      first: request.applicant_first_name || "",
      middle: request.applicant_middle_name || ""
    };

    return `
      ${overlayField("13mm", ty(76.5), "58mm", applicantName.last, "xlarge center")}
      ${overlayField("83mm", ty(76.5), "42mm", applicantName.first, "xlarge center")}
      ${overlayField("136mm", ty(76.5), "38mm", applicantName.middle, "xlarge center")}
      ${overlayField("18mm", ty(76), "45mm", request.office_department || "", "xlarge center")}
      ${overlayField("36mm", ty(95.6), "28mm", formatDateShort(request.filing_date), "xlarge center")}
      ${overlayField("106mm", ty(95), "46mm", request.position_title || "", "xlarge center")}
      ${overlayField("174mm", ty(95), "22mm", request.salary_display || "", "xlarge right")}

      ${overlayMark("16mm", ty(121), leaveType === "vacation")}
      ${overlayMark("16mm", ty(132), leaveType === "mandatory-forced")}
      ${overlayMark("16mm", ty(143), leaveType === "sick")}
      ${overlayMark("16mm", ty(154), leaveType === "maternity")}
      ${overlayMark("16mm", ty(165), leaveType === "paternity")}
      ${overlayMark("16mm", ty(176), leaveType === "special-privilege")}
      ${overlayMark("16mm", ty(187), leaveType === "solo-parent")}
      ${overlayMark("16mm", ty(198), leaveType === "study")}
      ${overlayMark("16mm", ty(209), leaveType === "vawc")}
      ${overlayMark("16mm", ty(220), leaveType === "rehabilitation-privilege")}
      ${overlayMark("16mm", ty(231), leaveType === "special-benefits-women")}
      ${overlayMark("16mm", ty(242), leaveType === "special-emergency-calamity")}
      ${overlayMark("16mm", ty(253), leaveType === "adoption")}
      ${overlayField("23mm", ty(266), "49mm", request.other_leave_details || "", "large")}

      ${overlayMark("116mm", ty(127), vacationLocations.includes("within-ph"))}
      ${overlayMark("116mm", ty(138.5), vacationLocations.includes("abroad"))}
      ${overlayMark("116mm", ty(154), sickDetails.includes("in-hospital"))}
      ${overlayMark("116mm", ty(165.5), sickDetails.includes("out-patient"))}
      ${overlayField("151mm", ty(138), "45mm", vacationLocations.includes("abroad") ? (request.reason || "") : "", "medium")}
      ${overlayField("160mm", ty(154), "36mm", sickDetails.includes("in-hospital") ? (request.reason || "") : "", "medium")}
      ${overlayField("167mm", ty(165.5), "29mm", sickDetails.includes("out-patient") ? (request.reason || "") : "", "medium")}
      ${overlayField("122mm", ty(180), "74mm", leaveType === "special-benefits-women" ? (request.reason || "") : "", "medium")}
      ${overlayMark("116mm", ty(195), leaveType === "study" && /master/i.test(request.reason || ""))}
      ${overlayMark("116mm", ty(206), leaveType === "study" && /(bar|board)/i.test(request.reason || ""))}
      ${overlayField("143mm", ty(216.5), "53mm", leaveType === "study" ? (request.reason || "") : "", "medium")}
      ${overlayMark("116mm", ty(228), /monet/i.test(request.reason || ""))}
      ${overlayMark("116mm", ty(239.5), /terminal/i.test(request.reason || ""))}

      ${overlayField("35mm", ty(281), "40mm", String(request.days_requested || ""), "xlarge center")}
      ${overlayField("35mm", ty(296), "50mm", formatDateLong(request.start_date), "large center")}
      ${overlayField("152mm", ty(291), "12mm", request.commutation === "not-requested" ? "X" : "", "xlarge center")}
      ${overlayField("152mm", ty(302), "12mm", request.commutation === "requested" ? "X" : "", "xlarge center")}
      ${overlayField("145mm", ty(308), "50mm", getApplicantFullName(request), "large center")}

      ${overlayField("34mm", ty(350), "55mm", formatDateShort(request.credit_as_of), "large center")}
      ${overlayField("62mm", ty(364), "24mm", formatNumberDisplay(request.credit_earned_vacation), "large center")}
      ${overlayField("107mm", ty(364), "24mm", formatNumberDisplay(request.credit_earned_sick), "large center")}
      ${overlayField("62mm", ty(372.5), "24mm", formatIntegerDisplay(request.days_requested), "large center")}
      ${overlayField("107mm", ty(372.5), "24mm", formatIntegerDisplay(request.days_requested), "large center")}
      ${overlayField("62mm", ty(381), "24mm", formatNumberDisplay(request.credit_balance_vacation), "large center")}
      ${overlayField("107mm", ty(381), "24mm", formatNumberDisplay(request.credit_balance_sick), "large center")}
      ${overlayField("33mm", ty(398), "85mm", "SHERIL Q. BRIONES, HRMO", "xlarge center")}

      ${overlayMark("117mm", ty(353), statusApproved || request.recommendation === "approved")}
      ${overlayMark("117mm", ty(364), statusRejected || request.recommendation === "rejected")}
      ${overlayField("146mm", ty(363), "48mm", request.recommendation_details || request.disapproval_details || "", "medium")}
      ${overlayField("143mm", ty(397), "52mm", "HANILYN R. YARA", "xlarge center")}

      ${overlayField("35mm", ty(427), "20mm", formatIntegerDisplay(request.approved_with_pay_days), "xlarge center")}
      ${overlayField("35mm", ty(438), "20mm", formatIntegerDisplay(request.approved_without_pay_days), "xlarge center")}
      ${overlayField("35mm", ty(449), "38mm", request.approved_other_details || "", "medium")}
      ${overlayField("137mm", ty(427), "58mm", request.disapproval_details || "", "medium wrap")}
      ${overlayField("77mm", ty(462), "85mm", "HON. VICENTA C. AGUILAR, MUN. MAYOR", "xlarge center")}
    `;
  }

  function overlayField(left, top, width, value, classes) {
    return `<div class="field ${classes}" style="left:${left};top:${top};width:${width};">${escapeHtml(value || "")}</div>`;
  }

  function overlayMark(left, top, isChecked) {
    return isChecked ? `<div class="mark" style="left:${left};top:${top};">X</div>` : "";
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
