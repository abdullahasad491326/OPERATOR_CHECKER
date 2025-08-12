const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// --- Admin Configuration ---
const ADMIN_USERNAME = 'PAKCYBER';
const ADMIN_PASSWORD = '24113576';

// --- Limits and storage ---
const SMS_LIMIT_PER_IP_PER_DAY = 3;
const WHATSAPP_LIMIT_PER_IP_PER_MONTH = 2;
const smsLogs = []; 
const ipSmsCount = {}; 
const ipWhatsAppCount = {};
const blockedIPs = new Set(); 

// API Key for WhatsApp check
const WHATSAPP_API_KEY = "15fcbc8c6dmshaab7e0f690476fcp133d61jsn4a33a16a8bf8";

// Middleware
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper: reset IP count daily ---
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

// --- Helper: reset WhatsApp check count monthly ---
function resetWhatsAppCountsIfNeeded(ip) {
    const now = new Date();
    if (!ipWhatsAppCount[ip]) {
        ipWhatsAppCount[ip] = { count: 0, lastReset: now };
    } else {
        const lastReset = ipWhatsAppCount[ip].lastReset;
        if (
            now.getFullYear() !== lastReset.getFullYear() ||
            now.getMonth() !== lastReset.getMonth()
        ) {
            ipWhatsAppCount[ip].count = 0;
            ipWhatsAppCount[ip].lastReset = now;
        }
    }
}

// --- IP Block Middleware ---
app.use((req, res, next) => {
    if (blockedIPs.has(req.ip)) {
        return res.status(403).json({ error: 'Your IP is blocked by admin.' });
    }
    next();
});

// --- Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

// Serve WhatsApp Quick Check HTML
app.get('/whatsapp-check', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'whatsapp-check.html'));
});

// API to proxy WhatsApp RapidAPI calls with IP limit + API key check
app.get('/api/whatsapp', async (req, res) => {
    const ip = req.ip;
    const { phone, type, key } = req.query;

    if (key !== WHATSAPP_API_KEY) {
        return res.status(401).json({ error: "Invalid API key" });
    }

    if (!phone || !type) {
        return res.status(400).json({ error: "Missing phone or type" });
    }

    resetWhatsAppCountsIfNeeded(ip);
    if (ipWhatsAppCount[ip].count >= WHATSAPP_LIMIT_PER_IP_PER_MONTH) {
        return res.status(429).json({ error: `Limit reached: ${WHATSAPP_LIMIT_PER_IP_PER_MONTH} checks per month.` });
    }

    try {
        const url = `https://whatsapp-data.p.rapidapi.com/${type}?phone=${encodeURIComponent(phone)}`;
        const apiRes = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'whatsapp-data.p.rapidapi.com',
                'x-rapidapi-key': WHATSAPP_API_KEY
            }
        });

        const text = await apiRes.text();
        ipWhatsAppCount[ip].count++;

        res.setHeader('Content-Type', apiRes.headers.get('content-type') || 'application/json');
        res.send(text);
    } catch (err) {
        res.status(500).json({ error: "WhatsApp API request failed" });
    }
});

// --- Admin Login ---
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

// --- Operator Check ---
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

// --- SIM Search ---
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

// --- Send SMS with Debug ---
app.post('/send-sms', (req, res) => {
    const { mobile, message } = req.body;
    const ip = req.ip;

    if (!mobile || !/^03\d{9}$/.test(mobile)) {
        return res.status(400).json({ error: 'Invalid or missing mobile number' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
    }

    resetIpCountsIfNeeded(ip);
    if (ipSmsCount[ip].count >= SMS_LIMIT_PER_IP_PER_DAY) {
        return res.status(429).json({ error: `SMS limit reached: max ${SMS_LIMIT_PER_IP_PER_DAY} messages per day per IP.` });
    }

    const formattedMobile = mobile.startsWith("0") ? "92" + mobile.slice(1) : mobile;
    
    smsLogs.push({ ip, mobile: formattedMobile, message, timestamp: new Date().toISOString(), type: 'send-sms' });
    ipSmsCount[ip].count++;

    console.log('Simulated SMS sent successfully:', { mobile: formattedMobile, message });
    res.json({ success: true, message: "SMS logged successfully." });
});

// --- Admin Logs ---
app.get('/api/admin/logs', (req, res) => {
    res.json({ success: true, logs: smsLogs });
});

// --- Admin Status ---
let serviceStatus = true;
app.get('/api/admin/status', (req, res) => {
    res.json({ success: true, status: serviceStatus });
});

app.post('/api/admin/toggle-sms', (req, res) => {
    serviceStatus = !serviceStatus;
    res.json({ success: true, status: serviceStatus });
});

// --- IP Block/Unblock Endpoints ---
app.post('/api/admin/block-ip', (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP is required' });
    blockedIPs.add(ip);
    res.json({ success: true, blockedIPs: Array.from(blockedIPs) });
});

app.post('/api/admin/unblock-ip', (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP is required' });
    blockedIPs.delete(ip);
    res.json({ success: true, blockedIPs: Array.from(blockedIPs) });
});

// --- NEW Admin API Endpoints ---
app.get('/api/admin/blocked-ips', (req, res) => {
    res.json({ success: true, blockedIps: Array.from(blockedIPs) });
});

app.get('/api/admin/stats', (req, res) => {
    const totalMessages = smsLogs.length;
    const uniqueIps = new Set(smsLogs.map(log => log.ip));
    const totalVisitors = uniqueIps.size;
    
    res.json({ success: true, totalMessages, totalVisitors });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
