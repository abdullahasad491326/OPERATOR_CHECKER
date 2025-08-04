const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Credentials and SMS Configuration ---
const ADMIN_USERNAME = 'PAKCYBER';
const ADMIN_PASSWORD = '24113576';
let smsEnabled = true;

// --- SMS Logging and Rate Limiting ---
const smsLogs = []; // In-memory storage for SMS logs
const smsAttempts = new Map();
const MAX_SMS_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Middleware to get user's IP
app.set('trust proxy', true);

// Body parsers (for POST data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route serves Operator.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

// Admin Panel Login route
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // In a real application, you would use a secure session/token here
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

// Admin Panel route to serve the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Protected API to fetch SMS logs
app.get('/api/admin/logs', (req, res) => {
    // Note: In a real app, this would be protected by an authentication check
    res.json({ success: true, logs: smsLogs });
});

// Protected API to get and toggle SMS service status
app.post('/api/admin/toggle-sms', (req, res) => {
    // Note: In a real app, this would be protected by an authentication check
    smsEnabled = !smsEnabled;
    res.json({ success: true, newStatus: smsEnabled });
});
app.get('/api/admin/status', (req, res) => {
    res.json({ success: true, status: smsEnabled });
});

// API endpoint for SMS sending
app.post('/send-sms', async (req, res) => {
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
        return res.status(429).json({ error: `You have reached the maximum of ${MAX_SMS_ATTEMPTS} SMS attempts per day.` });
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
        
        // 6. Log the SMS details to our in-memory array
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
                                   
