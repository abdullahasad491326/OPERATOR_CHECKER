const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 10000;

// Static فولڈر
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers (POST ڈیٹا کے لیے)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// آپ کا موجودہ proxy API
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

// نیا sim-search API
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

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Operator.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
