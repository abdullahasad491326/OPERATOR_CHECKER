// A 30-line Express proxy that forwards the GraphQL call to Rebtel
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(cors());          //  Access-Control-Allow-Origin: *
app.use(express.json());  //  parse JSON bodies

app.post('/lookup', async (req, res) => {
  try {
    // Front-end already sends the full GraphQL body
    const response = await axios.post(
      'https://prod-mp.rebtel.com/graphql',
      req.body,
      {
        headers: {
          'Content-Type' : 'application/json',
          'Authorization': 'application 7443a5f6-01a7-4ce7-8e87-c36212fad4f5',
          'Origin'       : 'https://www.rebtel.com',
          'User-Agent'   : 'Mozilla/5.0 (Linux; Android 12)'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
    res.status(502).json({ error: 'Proxy request failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
