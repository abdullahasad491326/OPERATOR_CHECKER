const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration ---
const ADMIN_USERNAME = 'PAKCYBER';
const ADMIN_PASSWORD = '24113576';

// Middleware to get user's IP
app.set('trust proxy', true);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for SMS logs and IP counts
const smsLogs = []; // Each log: { ip, mobile, message, timestamp, type }
const ipSmsCount = {}; // { ip: { count: Number, lastReset: Date } }
const SMS_LIMIT_PER_IP_PER_DAY = 3;

// Helper to reset counts daily at midnight
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

// Root route serves Operator.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

// --- Admin Panel Routes ---
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Tool API Endpoints ---

// API endpoint for Operator Check
app.get('/proxy', async (req, res) => {
  const number = req.query.number;
  if (!number) {
    return res.status(400).json({ error: 'Number parameter missing' });
  }
  try {
    const apiRes = await fetch(`https://www.easyload.com.pk/dingconnect.php?action=GetProviders&accountNumber=${number}`);
    if (!apiRes.ok) throw new Error('API request failed');
    const data = await apiRes.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// API endpoint for SIM Data Search (by Mobile Number)
app.post('/sim-search', async (req, res) => {
  const mobile = req.body.mobileNumber;
  if (!mobile || !/^03\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: 'Invalid or missing mobile number' });
  }
  try {
    const response = await fetch('https://minahilsimsdata.pro/search.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://minahilsimsdata.pro/search.php',
        Origin: 'https://minahilsimsdata.pro'
      },
      body: new URLSearchParams({ mobileNumber: mobile, submit: '' })
    });
    const text = await response.text();
    if (text.includes('Data Not Found')) {
      return res.status(404).json({ error: 'Data Not Found' });
    }
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

// NEW API endpoint for CNIC Search (by CNIC Number)
app.post('/cnic-search', async (req, res) => {
  const cnic = req.body.cnicNumber;
  if (!cnic || !/^\d{13}$/.test(cnic)) {
    return res.status(400).json({ error: 'Invalid or missing CNIC number' });
  }
  try {
    const response = await fetch('https://minahilsimsdata.pro/cnic.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://minahilsimsdata.pro/cnic.php',
        Origin: 'https://minahilsimsdata.pro'
      },
      body: new URLSearchParams({ cnicNumber: cnic, submit: '' })
    });
    const text = await response.text();
    if (text.includes('Data Not Found')) {
      return res.status(404).json({ error: 'Data Not Found' });
    }
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

// --- New API endpoint for sending SMS via CrownOne API with IP rate limit ---
app.post('/send-sms', async (req, res) => {
  const { mobile, message } = req.body;
  const ip = req.ip;

  if (!mobile || !/^03\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: 'Invalid or missing mobile number' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Reset or initialize count for IP
  resetIpCountsIfNeeded(ip);

  if (ipSmsCount[ip].count >= SMS_LIMIT_PER_IP_PER_DAY) {
    return res.status(429).json({ error: `SMS limit reached: max ${SMS_LIMIT_PER_IP_PER_DAY} messages per day per IP.` });
  }

  try {
    const apiResponse = await fetch("https://api.crownone.app/api/v1/Registration/verifysms", {
      method: "POST",
      headers: {
        "Host": "api.crownone.app",
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": "okhttp/4.9.2"
      },
      body: JSON.stringify({
        mobile: mobile,
        message: message
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return res.status(apiResponse.status).json({ error: `CrownOne API error: ${errorText}` });
    }

    const data = await apiResponse.json();

    // Log the SMS send event
    smsLogs.push({
      ip,
      mobile,
      message,
      timestamp: new Date().toISOString(),
      type: 'send-sms'
    });

    // Increase IP count
    ipSmsCount[ip].count++;

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error calling CrownOne API:', error);
    res.status(500).json({ error: 'Failed to send SMS via CrownOne API' });
  }
});

// --- Admin logs endpoint ---
app.get('/api/admin/logs', (req, res) => {
  // You can add auth/session check here for real use
  res.json({ success: true, logs: smsLogs });
});

// --- Admin service status toggle - placeholder ---
let serviceStatus = true;
app.get('/api/admin/status', (req, res) => {
  res.json({ success: true, status: serviceStatus });
});

app.post('/api/admin/toggle-sms', (req, res) => {
  serviceStatus = !serviceStatus;
  res.json({ success: true, status: serviceStatus });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
