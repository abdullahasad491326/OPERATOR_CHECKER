const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/lookup', async (req, res) => {
  try {
    const response = await axios.post('https://prod-mp.rebtel.com/graphql', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'application 7443a5f6-01a7-4ce7-8e87-c36212fad4f5',
        'Origin': 'https://www.rebtel.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12)'
      }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
