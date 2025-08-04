const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration and Rate Limiting for SMS Sender ---
let smsEnabled = true; // Admin toggle: set to false to disable SMS sending
const smsAttempts = new Map();
const MAX_SMS_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

// Function to clean up old attempts from the map
setInterval(() => {
    const now = Date.now();
    smsAttempts.forEach((attempts, ip) => {
        attempts = attempts.filter(time => now - time < ATTEMPT_WINDOW_MS);
        if (attempts.length > 0) {
            smsAttempts.set(ip, attempts);
        } else {
            smsAttempts.delete(ip);
        }
    });
}, 30 * 60 * 1000); // Run every 30 minutes

// Middleware to get user's IP
app.set('trust proxy', true); // Enable if running behind a proxy like Nginx or Heroku
// --- End Admin Configuration ---

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers (for POST data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Corrected Root route to serve Operator.html from the public directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

// Existing proxy API for Operator Check
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

// Existing API for SIM Data Search (used for CNIC search by mobile number)
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
            body: new URLSearchParams({
                mobileNumber: mobile,
                submit: ''
            })
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

// Existing API for Crown One SMS Sender (SECURE)
app.post('/send-crownone-sms', async (req, res) => {
    // 1. Check if SMS feature is enabled by admin
    if (!smsEnabled) {
        return res.status(403).json({ error: 'SMS service is currently disabled.' });
    }

    // 2. Check for rate limiting
    const userIp = req.ip;
    const now = Date.now();
    let attempts = smsAttempts.get(userIp) || [];
    attempts = attempts.filter(time => now - time < ATTEMPT_WINDOW_MS);

    if (attempts.length >= MAX_SMS_ATTEMPTS) {
        return res.status(429).json({ error: `You have reached the maximum of ${MAX_SMS_ATTEMPTS} SMS attempts per hour.` });
    }

    // 3. Get data from the client
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
        // 4. Securely make the API call from the server
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

        // 5. Update the rate limit attempts for the user's IP
        attempts.push(now);
        smsAttempts.set(userIp, attempts);

        const result = await apiRes.json();

        if (apiRes.ok) {
            res.json({ success: true, api_response: result });
        } else {
            res.status(apiRes.status).json({ success: false, error: 'API returned an error.', api_response: result });
        }

    } catch (err) {
        console.error('Crown One API Error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
        
