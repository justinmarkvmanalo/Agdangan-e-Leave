(function () {
  const config = window.SUPABASE_CONFIG || {};
  const isConfigured =
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    config.url !== "YOUR_SUPABASE_URL" &&
    config.anonKey !== "YOUR_SUPABASE_ANON_KEY";

  let supabase = null;
  let adminEmployeeProfiles = [];

  if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(config.url, config.anonKey);
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
      configStatus.textContent = isConfigured
        ? "Supabase configuration detected. Sign in using an admin or employee account."
        : "Supabase is not configured yet. Open supabase-config.js and set your project values first.";
    }

    switchButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const role = button.getAttribute("data-role-switch");
        switchButtons.forEach((item) => item.classList.toggle("active", item === button));
        roleInput.value = role;
        title.textContent = role === "admin" ? "Admin Sign In" : "Employee Sign In";
        subtitle.textContent = role === "admin"
          ? "Use your administrator email and password to review and approve leave requests."
          : "Use your employee email and password to open your leave dashboard.";
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

      if (!supabase) {
        window.alert("Supabase is not configured yet. Update supabase-config.js first.");
        return;
      }

      const formData = new FormData(loginForm);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const selectedRole = String(formData.get("selectedRole") || "employee");

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        window.alert(error.message);
        return;
      }

      const profile = await fetchCurrentProfile();

      if (!profile) {
        window.alert("Profile record not found. The login worked, but the app could not load or create the matching profile.");
        return;
      }

      if (profile.role !== selectedRole) {
        await supabase.auth.signOut();
        window.alert("This account does not match the selected role.");
        return;
      }

      window.location.href = profile.role === "admin" ? "admin-dashboard.html" : "employee-dashboard.html";
    });
  }

  async function initEmployeeDashboard() {
    bindSignOut();

    if (!supabase) {
      renderEmployeeDemo();
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.href = "login.html";
      return;
    }

    const profile = await fetchCurrentProfile();
    if (!profile || profile.role !== "employee") {
      window.location.href = "login.html";
      return;
    }

    fillEmployeeHeader(profile);
    await loadEmployeeRequests(profile.id);
    bindLeaveRequestForm(profile.id);
  }

  async function initAdminDashboard() {
    bindSignOut();

    if (!supabase) {
      renderAdminDemo();
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.href = "login.html";
      return;
    }

    const profile = await fetchCurrentProfile();
    if (!profile || profile.role !== "admin") {
      window.location.href = "login.html";
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

    bindAdminEmployeeForm();
    await Promise.all([loadAdminProfiles(), loadAdminRequests()]);
  }

  async function fetchCurrentProfile() {
    if (!supabase) {
      return null;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    const userId = authUser && authUser.id;

    if (!userId) {
      return null;
    }

    const profileById = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profileById.error && profileById.data) {
      return profileById.data;
    }

    const ensuredProfile = await ensureProfileForCurrentUser(authUser);
    if (ensuredProfile) {
      return ensuredProfile;
    }

    const profileByEmail = await supabase
      .from("profiles")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();

    if (!profileByEmail.error && profileByEmail.data) {
      console.warn("Profile row exists by email but not by auth user id.", {
        authUserId: userId,
        profileId: profileByEmail.data.id
      });
      return profileByEmail.data;
    }

    console.error("Unable to load profile.", {
      byIdError: profileById.error,
      byEmailError: profileByEmail.error,
      authUserId: userId,
      authEmail: authUser.email
    });
    return null;
  }

  async function ensureProfileForCurrentUser(authUser) {
    if (!authUser || !authUser.id || !authUser.email) {
      return null;
    }

    const meta = authUser.user_metadata || {};
    const role = meta.role === "admin" ? "admin" : "employee";
    const profilePayload = {
      id: authUser.id,
      email: authUser.email,
      employee_no: meta.employee_no || null,
      role,
      first_name: meta.first_name || authUser.email.split("@")[0] || "User",
      middle_name: meta.middle_name || null,
      last_name: meta.last_name || "Account",
      suffix: meta.suffix || null,
      department: meta.department || "Unassigned",
      position_title: meta.position_title || (role === "admin" ? "Administrator" : "Employee"),
      contact_no: meta.contact_no || null,
      is_approved: true,
      employment_status: "active",
      leave_credits: 0
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Unable to bootstrap profile for current user.", error);
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

  async function loadEmployeeRequests(employeeId) {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

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
        <strong>${escapeHtml(capitalize(request.leave_type))}</strong>
        <div>${escapeHtml(request.start_date)} to ${escapeHtml(request.end_date)}</div>
        <div>${escapeHtml(request.days_requested)} day(s)</div>
        <div><span class="badge ${escapeHtml(request.status)}">${escapeHtml(capitalize(request.status))}</span></div>
      </li>
    `).join("");
  }

  function bindLeaveRequestForm(employeeId) {
    const form = document.getElementById("leave-request-form");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      const payload = {
        employee_id: employeeId,
        leave_type: String(formData.get("leaveType") || ""),
        start_date: String(formData.get("startDate") || ""),
        end_date: String(formData.get("endDate") || ""),
        days_requested: Number(formData.get("daysRequested") || 0),
        reason: String(formData.get("reason") || "")
      };

      const { error } = await supabase.from("leave_requests").insert(payload);

      if (error) {
        window.alert(error.message);
        return;
      }

      form.reset();
      await loadEmployeeRequests(employeeId);
      window.alert("Leave request submitted.");
    });
  }

  async function loadAdminProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, employee_no, email, first_name, middle_name, last_name, suffix, department, position_title, contact_no, employment_status, hire_date, leave_credits, role")
      .eq("role", "employee")
      .order("last_name", { ascending: true });

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
        const employeeId = button.getAttribute("data-edit-employee");
        const profile = adminEmployeeProfiles.find((item) => item.id === employeeId);
        if (profile) {
          populateEmployeeForm(profile);
        }
      });
    });

    Array.from(container.querySelectorAll("[data-delete-employee]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const employeeId = button.getAttribute("data-delete-employee");
        const profile = adminEmployeeProfiles.find((item) => item.id === employeeId);
        if (!profile) {
          return;
        }

        const confirmed = window.confirm(`Delete ${profile.first_name} ${profile.last_name}? This also removes the employee login and leave records.`);
        if (!confirmed) {
          return;
        }

        await deleteEmployeeAccount(employeeId);
      });
    });
  }

  function bindAdminEmployeeForm() {
    const form = document.getElementById("employee-management-form");
    const cancelButton = document.getElementById("employee-cancel-button");

    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const employeeId = String(formData.get("employeeRecordId") || "").trim();
      const payload = {
        email: String(formData.get("email") || "").trim(),
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
    const { error } = await supabase.rpc("admin_create_employee", {
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
    const { error } = await supabase.rpc("admin_update_employee", {
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
    const { error } = await supabase.rpc("admin_delete_employee", {
      p_employee_id: employeeId
    });

    if (error) {
      window.alert(error.message);
      return;
    }

    if (document.getElementById("employee-record-id")?.value === employeeId) {
      resetEmployeeForm();
    }

    await loadAdminProfiles();
    window.alert("Employee account deleted.");
  }

  async function loadAdminRequests() {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days_requested, reason, status, employee_id")
      .order("created_at", { ascending: false });

    if (error) {
      window.alert(error.message);
      return;
    }

    const pending = data.filter((item) => item.status === "pending").length;
    const approved = data.filter((item) => item.status === "approved").length;
    const rejected = data.filter((item) => item.status === "rejected").length;

    setText("stat-admin-pending", String(pending));
    setText("stat-admin-approved", String(approved));
    setText("stat-admin-rejected", String(rejected));

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
              <td>${escapeHtml(capitalize(request.leave_type))}</td>
              <td>${escapeHtml(request.start_date)}<br>${escapeHtml(request.end_date)}</td>
              <td>${escapeHtml(String(request.days_requested))}</td>
              <td><span class="badge ${escapeHtml(request.status)}">${escapeHtml(capitalize(request.status))}</span></td>
              <td>${escapeHtml(request.reason)}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="button button-success" data-update-request="${request.id}" data-status="approved">Approve</button>
                  <button type="button" class="button button-danger" data-update-request="${request.id}" data-status="rejected">Reject</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    const buttons = Array.from(container.querySelectorAll("[data-update-request]"));
    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        const requestId = button.getAttribute("data-update-request");
        const status = button.getAttribute("data-status");
        await updateLeaveStatus(requestId, status);
      });
    });
  }

  async function updateLeaveStatus(requestId, status) {
    const { data: authData } = await supabase.auth.getUser();
    const reviewerId = authData.user && authData.user.id;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      window.alert(error.message);
      return;
    }

    await loadAdminRequests();
  }

  function bindSignOut() {
    const button = document.getElementById("sign-out-button");
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (supabase) {
        await supabase.auth.signOut();
      }
      window.location.href = "login.html";
    });
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
              <td>Vacation</td>
              <td>2026-05-28<br>2026-05-30</td>
              <td>3</td>
              <td><span class="badge pending">Pending</span></td>
              <td>Family travel</td>
              <td><div class="table-actions"><button type="button" class="button button-success">Approve</button><button type="button" class="button button-danger">Reject</button></div></td>
            </tr>
          </tbody>
        </table>
      `;
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
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
})();
