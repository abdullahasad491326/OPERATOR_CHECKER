const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration ---
const ADMIN_USERNAME = 'PAKCYBER';
const ADMIN_PASSWORD = '24113576';
let smsEnabled = true;

// --- SMS Logging and Rate Limiting ---
const smsLogs = []; // In-memory storage for SMS logs
const smsAttempts = new Map();
const MAX_SMS_ATTEMPTS = 2;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Middleware to get user's IP
app.set('trust proxy', true);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/api/admin/logs', (req, res) => {
    res.json({ success: true, logs: smsLogs });
});

app.post('/api/admin/toggle-sms', (req, res) => {
    smsEnabled = !smsEnabled;
    res.json({ success: true, newStatus: smsEnabled });
});

app.get('/api/admin/status', (req, res) => {
    res.json({ success: true, status: smsEnabled });
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

// API endpoint for SMS sending
app.post('/send-sms', async (req, res) => {
    if (!smsEnabled) {
        return res.status(403).json({ error: 'SMS service is currently disabled By Web Owner.' });
    }
    const userIp = req.ip;
    const now = Date.now();
    let attempts = smsAttempts.get(userIp) || [];
    attempts = attempts.filter(time => now - time < ATTEMPT_WINDOW_MS);
    if (attempts.length >= MAX_SMS_ATTEMPTS) {
        return res.status(429).json({ error: `You have reached the maximum of ${MAX_SMS_ATTEMPTS} SMS attempts per day.` });
    }

    const { mobile, message } = req.body;
    if (!mobile || !message || !/^03[0-9]{9}$/.test(mobile)) {
        return res.status(400).json({ error: 'Invalid mobile number or empty message.' });
    }

    const payload = {
        Code: 1234,
        Mobile: mobile,
        Message: message
    };

    try {
        const apiRes = await fetch("https://api.crownone.app/api/v1/Registration/verifysms", {
            method: "POST",
            headers: {
                "Host": "api.crownone.app",
                "accept": "application/json",
                "content-type": "application/json",
                "user-agent": "okhttp/4.9.2"
            },
            body: JSON.stringify(payload)
        });

        attempts.push(now);
        smsAttempts.set(userIp, attempts);
        
        smsLogs.push({
            ip: userIp,
            mobile: mobile,
            message: message,
            timestamp: new Date().toISOString()
        });

        const result = await apiRes.json();

        if (apiRes.ok) {
            res.json({ success: true, api_response: result });
        } else {
            res.status(apiRes.status).json({ success: false, error: 'API returned an error.', api_response: result });
        }
    } catch (err) {
        console.error('External API Error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
            
