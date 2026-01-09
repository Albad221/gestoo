import express from 'express';
import { webhookHandler } from './handlers/webhook.js';
import { healthHandler } from './handlers/health.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Routes
app.get('/health', healthHandler);
app.post('/webhook', webhookHandler);

// Verification endpoint for WhatsApp
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot service running on port ${PORT}`);
});
