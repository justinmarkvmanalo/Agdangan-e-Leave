const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "file-data");
const deductionLogFile = path.join(dataDir, "credit-deduction-logs.txt");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function ensureFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(deductionLogFile)) {
    fs.writeFileSync(deductionLogFile, "[]");
  }
}

function compactExistingDeductionLogFile() {
  const logs = readDeductionLogs();
  writeDeductionLogs(logs);
}

function readDeductionLogs() {
  ensureFiles();
  const text = fs.readFileSync(deductionLogFile, "utf8").trim();
  if (!text) {
    return [];
  }

  try {
    const logs = JSON.parse(text);
    return Array.isArray(logs) ? logs.map(expandStoredLog) : [];
  } catch (error) {
    return [];
  }
}

function writeDeductionLogs(logs) {
  ensureFiles();
  fs.writeFileSync(deductionLogFile, JSON.stringify(logs.map(compactLog)));
}

function normalizeLog(body) {
  const employee = body.employee || {};
  const entry = body.entry || {};
  return {
    employee_id: Number(employee.id || 0),
    employee_name: employee.name || "Employee",
    employee_no: employee.employeeNo || "",
    current_credits: Number(entry.afterCredits ?? employee.leaveCredits ?? 0),
    minutes: Number(entry.minutes || 0),
    entries: Array.isArray(entry.entries) ? entry.entries : [],
    deduction: Number(entry.deduction || 0),
    reason: entry.reason || "",
    before_credits: Number(entry.beforeCredits || 0),
    after_credits: Number(entry.afterCredits || 0),
    created_at: entry.createdAt || new Date().toISOString()
  };
}

function compactLog(log) {
  return {
    i: Number(log.employee_id || log.i || 0),
    n: log.employee_name || log.n || "Employee",
    no: log.employee_no || log.no || "",
    c: roundNumber(log.current_credits ?? log.c ?? log.after_credits ?? log.a ?? 0),
    m: Number(log.minutes || log.m || 0),
    e: compactEntries(log.entries || log.e || []),
    d: roundNumber(log.deduction ?? log.d ?? 0),
    r: log.reason || log.r || "",
    b: roundNumber(log.before_credits ?? log.b ?? 0),
    a: roundNumber(log.after_credits ?? log.a ?? 0),
    t: log.created_at || log.t || new Date().toISOString()
  };
}

function expandStoredLog(log) {
  if (Object.prototype.hasOwnProperty.call(log, "employee_id")) {
    return log;
  }

  return {
    employee_id: Number(log.i || 0),
    employee_name: log.n || "Employee",
    employee_no: log.no || "",
    current_credits: Number(log.c || 0),
    minutes: Number(log.m || 0),
    entries: expandEntries(log.e || []),
    deduction: Number(log.d || 0),
    reason: log.r || "",
    before_credits: Number(log.b || 0),
    after_credits: Number(log.a || 0),
    created_at: log.t || new Date().toISOString()
  };
}

function compactEntries(entries) {
  return entries.map((entry) => ({
    m: Number(entry.minutes || entry.m || 0),
    n: entry.note || entry.n || ""
  }));
}

function expandEntries(entries) {
  return entries.map((entry) => ({
    minutes: Number(entry.m || entry.minutes || 0),
    note: entry.n || entry.note || ""
  }));
}

function roundNumber(value) {
  return Number(Number(value || 0).toFixed(3));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function serveStatic(response, url) {
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  let filePath = path.join(rootDir, cleanPath || "index.html");

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}

ensureFiles();
compactExistingDeductionLogFile();

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname === "/api/deduction-logs" && request.method === "GET") {
      const employeeId = Number(url.searchParams.get("employeeId") || 0);
      const logs = readDeductionLogs()
        .filter((log) => Number(log.employee_id) === employeeId)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      sendJson(response, 200, { data: logs, error: null });
      return;
    }

    if (url.pathname === "/api/deduction-logs" && request.method === "POST") {
      const body = await readBody(request);
      const logs = readDeductionLogs();
      const record = normalizeLog(body);
      logs.push(record);
      writeDeductionLogs(logs);
      sendJson(response, 200, { data: record, error: null });
      return;
    }

    serveStatic(response, url);
  } catch (error) {
    sendJson(response, 400, { data: null, error: { message: error.message } });
  }
}).listen(port, () => {
  console.log(`Agdangan e-Leave server running at http://localhost:${port}`);
  console.log(`Credit deduction logs are saved in ${deductionLogFile}`);
});
