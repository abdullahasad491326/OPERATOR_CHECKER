const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// public فولڈر کو اسٹاٹک فائلز کے لیے define کریں
app.use(express.static(path.join(__dirname, 'public')));

// پراکسی API روٹ
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

// اگر کسی اور روٹ کو ہینڈل کرنا ہو تو یہاں لکھیں، مثلا:
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
