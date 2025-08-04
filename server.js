const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration and Rate Limiting for SMS Sender ---
let smsEnabled = true; // Admin toggle: set to false to disable SMS sending
const smsAttempts = new Map();
const MAX_SMS_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Middleware to get user's IP
app.set('trust proxy', true);

// Body parsers (for POST data)
app.use(express.json());

// Root route to serve the new sms.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'sms.html'));
});

// Generic API endpoint for SMS sending (SECURE)
app.post('/send-sms', async (req, res) => {
    // 1. Check if SMS feature is enabled by admin
    if (!smsEnabled) {
        return res.status(403).json({ error: 'SMS service is currently disabled.' });
    }

    // 2. Check for rate limiting (3 messages per day)
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
    
