/**
 * WhatsApp Cloud API State Machine Flow Router
 * Author: Eng. MHD. Shadi AL-Hasan <mhd.shadi.alhasan@gmail.com>
 * Phone: +963934005922
 * Location: Damascus, Syria
 * Copyright (c) 2026 MHD. Shadi AL-Hasan
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { loadWorkflow, StateMachineEngine } = require('./workflow-loader');
const { generateWhatsAppQrSvg } = require('./qr-generator');

const app = express();
app.use(express.json());

const USER_STATES = new Map();

// Configuration
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MY_VERIFY_TOKEN';
const WORKFLOW_FILE = process.env.WORKFLOW_FILE || path.join(__dirname, 'workflow.yaml');
const BUSINESS_PHONE = process.env.WHATSAPP_BUSINESS_PHONE || '+963934005922';

// Initialize State Machine Workflow Engine
let engine;
try {
  if (fs.existsSync(WORKFLOW_FILE)) {
    engine = new StateMachineEngine(WORKFLOW_FILE);
    console.log(`[+] Loaded workflow definition from: ${WORKFLOW_FILE}`);
  } else {
    // Default fallback workflow
    engine = new StateMachineEngine({
      initial_state: 'INIT',
      states: {
        INIT: {
          reply: 'Welcome! Reply 1 for Sales, 2 for Tech Support.',
          transitions: { '1': 'SALES_MENU', default: 'MAIN_MENU' }
        },
        MAIN_MENU: {
          reply: 'Connecting you with our team.',
          transitions: { '1': 'AWAITING_LEAD_INFO', default: 'INIT' }
        },
        SALES_MENU: {
          reply: 'Connecting you with our Enterprise Solutions Team.',
          transitions: { default: 'AWAITING_LEAD_INFO' }
        },
        AWAITING_LEAD_INFO: {
          reply: 'Thank you! An engineer will be in touch.',
          transitions: { default: 'INIT' }
        }
      }
    });
    console.log('[*] Using built-in fallback state machine workflow');
  }
} catch (err) {
  console.error('[!] Error loading workflow, using default fallback:', err.message);
  engine = new StateMachineEngine();
}

/**
 * Handle conversational transitions for a given user
 */
function handleStateFlow(userId, userMessage) {
  const currentState = USER_STATES.get(userId) || engine.initialState;
  console.log(`[FLOW] User ${userId} [${currentState}] -> "${userMessage}"`);

  const result = engine.transition(currentState, userMessage);
  USER_STATES.set(userId, result.nextState);

  console.log(`[REPLY] [${result.nextState}]: ${result.reply}`);
  return result;
}

// Verification webhook for Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming message handler
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body && body.object) {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body?.trim();

    if (from && text) {
      const flowResult = handleStateFlow(from, text);
      return res.status(200).json({
        status: 'success',
        userId: from,
        currentState: flowResult.nextState,
        reply: flowResult.reply
      });
    }
    return res.sendStatus(200);
  }
  res.sendStatus(404);
});

// Onboarding QR Code SVG Endpoint
app.get('/qr.svg', (req, res) => {
  const phone = req.query.phone || BUSINESS_PHONE;
  const message = req.query.message || 'Hello! I would like to inquire about Enterprise Solutions.';
  const svg = generateWhatsAppQrSvg({ phone, message });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.status(200).send(svg);
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[*] WhatsApp Flow Router listening on port ${PORT}`);
    console.log(`[*] QR Code available at http://localhost:${PORT}/qr.svg`);
  });
}

module.exports = {
  app,
  engine,
  USER_STATES,
  handleStateFlow
};
