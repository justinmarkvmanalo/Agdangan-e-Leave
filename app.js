(function () {
  const config = window.SUPABASE_CONFIG || {};
  const isConfigured =
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    config.url !== "YOUR_SUPABASE_URL" &&
    config.anonKey !== "YOUR_SUPABASE_ANON_KEY";

  let supabase = null;

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
        window.alert("Profile record not found. Confirm the user exists in public.profiles.");
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

    await Promise.all([loadAdminProfiles(), loadAdminRequests()]);
  }

  async function fetchCurrentProfile() {
    if (!supabase) {
      return null;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user && authData.user.id;

    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
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
      .select("id, employee_no, first_name, last_name, department, position_title, role")
      .eq("role", "employee")
      .order("last_name", { ascending: true });

    if (error) {
      window.alert(error.message);
      return;
    }

    setText("stat-employees", String(data.length));

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
      employee_no: "EMP-001",
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

    const list = document.getElementById("admin-summary-list");
    if (list) {
      list.innerHTML = `
        <li>
          <strong>Juan Dela Cruz</strong>
          <div>EMP-001</div>
          <div>Treasury | Administrative Aide</div>
        </li>
        <li>
          <strong>Maria Santos</strong>
          <div>EMP-002</div>
          <div>Accounting | Records Officer</div>
        </li>
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

  function capitalize(value) {
    return String(value || "").replace(/^\w/, (match) => match.toUpperCase());
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
