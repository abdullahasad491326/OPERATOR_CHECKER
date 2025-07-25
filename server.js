const express = require('express');
const fetch = require('node-fetch'); // اگر آپ کا Node.js version 18+ ہے تو یہ ضروری نہیں
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
