const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration ---
const ADMIN_USERNAME = 'PAK-CYBER';
const ADMIN_PASSWORD = '82214760';

// Middleware to get user's IP
app.set('trust proxy', true);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for SMS logs, IP counts, blocked IPs, and admin sessions
const smsLogs = []; // Each: { ip, mobile, message, timestamp, type }
const ipSmsCount = {}; // { ip: { count, lastReset } }
const blockedIps = new Set(); // Store blocked IP strings
const sessions = new Set(); // Store logged-in admin sessions (simple token strings)

// SMS sending service status toggle
let serviceStatus = true; // true = ON, false = OFF

const SMS_LIMIT_PER_IP_PER_DAY = 3;

// Helper: Reset daily IP counts if date changed
function resetIpCountsIfNeeded(ip) {
  const now = new Date();
  if (!ipSmsCount[ip]) {
    ipSmsCount[ip] = { count: 0, lastReset: now };
  } else {
    const lastReset = ipSmsCount[ip].lastReset;
    if (
      now.getFullYear() !== lastReset.getFullYear() ||
      now.getMonth() !== lastReset.getMonth() ||
      now.getDate() !== lastReset.getDate()
    ) {
      ipSmsCount[ip].count = 0;
      ipSmsCount[ip].lastReset = now;
    }
  }
}

// Simple session token generator (not cryptographically secure, just for demo)
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15);
}

// Middleware: authenticate admin session from header 'x-admin-token'
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && sessions.has(token)) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

// --- Routes ---

// Serve Operator.html as main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

// Serve admin.html for admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin login - returns a session token on success
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateSessionToken();
    sessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Admin session check (client sends token via header)
app.get('/api/admin/session-check', (req, res) => {
  const token = req.headers['x-admin-token'];
  res.json({ isLoggedIn: token && sessions.has(token) });
});

// Admin logout (optional)
app.post('/admin/logout', adminAuth, (req, res) => {
  const token = req.headers['x-admin-token'];
  sessions.delete(token);
  res.json({ success: true });
});

// --- Tool API Endpoints ---

// Example: Operator Check
app.get('/proxy', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.status(400).json({ error: 'Number parameter missing' });

  try {
    const apiRes = await fetch(`https://www.easyload.com.pk/dingconnect.php?action=GetProviders&accountNumber=${number}`);
    if (!apiRes.ok) throw new Error('API request failed');
    const data = await apiRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// SIM Data Search
app.post('/sim-search', async (req, res) => {
  const mobile = req.body.mobileNumber;
  if (!mobile || !/^03\d{9}$/.test(mobile)) return res.status(400).json({ error: 'Invalid or missing mobile number' });

  try {
    const response = await fetch('https://minahilsimsdata.pro/search.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://minahilsimsdata.pro/search.php',
        Origin: 'https://minahilsimsdata.pro'
      },
      body: new URLSearchParams({ mobileNumber: mobile, submit: '' }),
    });
    const text = await response.text();
    if (text.includes('Data Not Found')) return res.status(404).json({ error: 'Data Not Found' });

    const dom = new JSDOM(text);
    const cells = [...dom.window.document.querySelectorAll('td')].map(td => td.textContent.trim()).filter(Boolean);
    const cnic = cells.find(c => /^\d{13}$/.test(c));
    if (!cnic) return res.status(404).json({ error: 'CNIC not found' });

    const cnicIndex = cells.indexOf(cnic);
    const name = cells.slice(1, cnicIndex).join(' ');
    const address = cells.slice(cnicIndex + 1).join(' ');
    res.json({ name, cnic, address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// CNIC Search
app.post('/cnic-search', async (req, res) => {
  const cnic = req.body.cnicNumber;
  if (!cnic || !/^\d{13}$/.test(cnic)) return res.status(400).json({ error: 'Invalid or missing CNIC number' });

  try {
    const response = await fetch('https://minahilsimsdata.pro/cnic.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://minahilsimsdata.pro/cnic.php',
        Origin: 'https://minahilsimsdata.pro'
      },
      body: new URLSearchParams({ cnicNumber: cnic, submit: '' }),
    });
    const text = await response.text();
    if (text.includes('Data Not Found')) return res.status(404).json({ error: 'Data Not Found' });

    const dom = new JSDOM(text);
    const cells = [...dom.window.document.querySelectorAll('td')].map(td => td.textContent.trim()).filter(Boolean);
    const name = cells[1] || 'N/A';
    const mobile = cells[2] || 'N/A';
    const address = cells.slice(3).join(' ') || 'N/A';
    res.json({ name, cnic, mobile, address });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- SMS sending endpoint (WITHOUT CrownOne API) ---
// Instead: reply with service blocked message if service OFF
app.post('/send-sms', (req, res) => {
  const { mobile, message } = req.body;
  const ip = req.ip;

  if (!mobile || !/^03\d{9}$/.test(mobile)) return res.status(400).json({ error: 'Invalid or missing mobile number' });
  if (!message || typeof message !== 'string' || message.trim().length === 0) return res.status(400).json({ error: 'Message is required' });

  // Check blocked IPs
  if (blockedIps.has(ip)) {
    return res.status(403).json({ error: 'Your IP is blocked from sending SMS.' });
  }

  // Check service status
  if (!serviceStatus) {
    return res.status(403).json({ error: 'SMS service is blocked by owner.' });
  }

  // Reset or init IP count
  resetIpCountsIfNeeded(ip);

  if (ipSmsCount[ip].count >= SMS_LIMIT_PER_IP_PER_DAY) {
    return res.status(429).json({ error: `SMS limit reached: max ${SMS_LIMIT_PER_IP_PER_DAY} messages per day per IP.` });
  }

  // For demo, we just log the message and increment count (no real SMS sending)
  smsLogs.push({
    ip,
    mobile,
    message,
    timestamp: new Date().toISOString(),
    type: 'send-sms',
  });

  ipSmsCount[ip].count++;

  res.json({ success: true, message: 'SMS sending is disabled. Your message was logged.' });
});

// --- Admin logs endpoint (requires auth) ---
app.get('/api/admin/logs', adminAuth, (req, res) => {
  res.json({ success: true, logs: smsLogs });
});

// --- Admin service status ---
app.get('/api/admin/status', adminAuth, (req, res) => {
  res.json({ success: true, status: serviceStatus });
});

// Toggle SMS service status (auth)
app.post('/api/admin/toggle-sms', adminAuth, (req, res) => {
  serviceStatus = !serviceStatus;
  res.json({ success: true, status: serviceStatus });
});

// --- Block IP ---
app.post('/api/admin/block-ip', adminAuth, (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: 'IP is required' });
  blockedIps.add(ip);
  res.json({ success: true, message: `IP ${ip} blocked.` });
});

// --- Unblock IP ---
app.post('/api/admin/unblock-ip', adminAuth, (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: 'IP is required' });
  blockedIps.delete(ip);
  res.json({ success: true, message: `IP ${ip} unblocked.` });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
