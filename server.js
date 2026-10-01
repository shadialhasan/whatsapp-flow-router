/**
 * WhatsApp Cloud API State Machine Flow Router
 * Author: Eng. MHD. Shadi AL-Hasan <mhd.shadi.alhasan@gmail.com>
 * Phone: +963934005922
 * Copyright (c) 2026 MHD. Shadi AL-Hasan
 */

const express = require('express');
const app = express();
app.use(express.json());

const USER_STATES = new Map();

// Verification webhook for Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === 'MY_VERIFY_TOKEN') {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming message handler
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body?.trim()?.toLowerCase();

    if (from && text) {
      handleStateFlow(from, text);
    }
    return res.sendStatus(200);
  }
  res.sendStatus(404);
});

function handleStateFlow(userId, userMessage) {
  const currentState = USER_STATES.get(userId) || 'INIT';
  console.log(`[FLOW] User ${userId} [${currentState}] -> "${userMessage}"`);

  if (currentState === 'INIT') {
    console.log(`[REPLY] Welcome! Reply 1 for Sales, 2 for Tech Support.`);
    USER_STATES.set(userId, 'MAIN_MENU');
  } else if (currentState === 'MAIN_MENU') {
    if (userMessage === '1') {
      console.log(`[REPLY] Connecting you with our Enterprise Solutions Team.`);
      USER_STATES.set(userId, 'AWAITING_LEAD_INFO');
    } else {
      console.log(`[REPLY] Support desk ticket initialized.`);
      USER_STATES.set(userId, 'INIT');
    }
  }
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`[*] WhatsApp Flow Router listening on port ${PORT}`);
});
