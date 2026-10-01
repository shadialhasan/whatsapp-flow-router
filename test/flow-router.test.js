const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadWorkflow, StateMachineEngine, parseSimpleYaml } = require('../workflow-loader');
const { generateQrSvg, buildWhatsAppUrl, generateWhatsAppQrSvg } = require('../qr-generator');
const { handleStateFlow, USER_STATES, app } = require('../server');

test('State Machine Transitions - Direct transitions', () => {
  const engine = new StateMachineEngine({
    initial_state: 'INIT',
    states: {
      INIT: {
        reply: 'Welcome! Reply 1 for Sales, 2 for Support.',
        transitions: { '1': 'SALES', '2': 'SUPPORT', default: 'INIT' }
      },
      SALES: {
        reply: 'Sales department.',
        transitions: { '0': 'INIT', default: 'AWAITING_INFO' }
      },
      SUPPORT: {
        reply: 'Tech support desk.',
        transitions: { '0': 'INIT', default: 'INIT' }
      },
      AWAITING_INFO: {
        reply: 'Thank you for your inquiry.',
        transitions: { default: 'INIT' }
      }
    }
  });

  // Test 1: From INIT with '1' -> SALES
  let res = engine.transition('INIT', '1');
  assert.equal(res.nextState, 'SALES');
  assert.equal(res.previousState, 'INIT');
  assert.ok(res.reply.includes('Sales department'));

  // Test 2: From INIT with '2' -> SUPPORT
  res = engine.transition('INIT', '2');
  assert.equal(res.nextState, 'SUPPORT');
  assert.ok(res.reply.includes('support desk'));

  // Test 3: Multi-step transition chain
  let current = 'INIT';
  res = engine.transition(current, '1');
  current = res.nextState;
  assert.equal(current, 'SALES');

  res = engine.transition(current, 'We need 50 licenses');
  current = res.nextState;
  assert.equal(current, 'AWAITING_INFO');

  res = engine.transition(current, 'done');
  current = res.nextState;
  assert.equal(current, 'INIT');
});

test('State Machine Transitions - Fallback & Unknown State', () => {
  const engine = new StateMachineEngine({
    initial_state: 'INIT',
    states: {
      INIT: {
        reply: 'Welcome',
        transitions: { '1': 'NEXT' }
      }
    }
  });

  // Unknown state resets to initial_state
  const res = engine.transition('NON_EXISTENT_STATE', 'hello');
  assert.equal(res.nextState, 'INIT');
});

test('YAML Workflow Loader - Load and parse workflow.yaml', () => {
  const workflowPath = path.join(__dirname, '..', 'workflow.yaml');
  const workflow = loadWorkflow(workflowPath);

  assert.ok(workflow);
  assert.equal(workflow.initial_state, 'INIT');
  assert.ok(workflow.states.INIT);
  assert.ok(workflow.states.MAIN_MENU);
  assert.ok(workflow.states.SALES_MENU);
  assert.ok(workflow.states.TECH_SUPPORT);

  const engine = new StateMachineEngine(workflow);
  const res = engine.transition('INIT', '1');
  assert.equal(res.nextState, 'SALES_MENU');
});

test('YAML Parser - parseSimpleYaml handles key values and structures', () => {
  const yamlText = `
initial_state: START
states:
  START:
    reply: "Hello world"
    code: 100
    active: true
`;
  const parsed = parseSimpleYaml(yamlText);
  assert.equal(parsed.initial_state, 'START');
  assert.equal(parsed.states.START.reply, 'Hello world');
  assert.equal(parsed.states.START.code, 100);
  assert.equal(parsed.states.START.active, true);
});

test('Server State Management - handleStateFlow updates USER_STATES', () => {
  const testUser = 'user_test_9988';
  USER_STATES.delete(testUser);

  const step1 = handleStateFlow(testUser, '1');
  assert.equal(USER_STATES.get(testUser), 'SALES_MENU');

  const step2 = handleStateFlow(testUser, 'Acme Enterprise Cloud');
  assert.equal(USER_STATES.get(testUser), 'AWAITING_LEAD_INFO');

  const step3 = handleStateFlow(testUser, '0');
  assert.equal(USER_STATES.get(testUser), 'MAIN_MENU');
});

test('QR Code SVG Generator - Valid SVG generation', () => {
  const phone = '+963934005922';
  const message = 'Hello CTO Shadi';
  const url = buildWhatsAppUrl(phone, message);
  assert.equal(url, 'https://wa.me/963934005922?text=Hello%20CTO%20Shadi');

  const svg = generateWhatsAppQrSvg({ phone, message });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('viewBox='));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('<path'));
  assert.ok(svg.endsWith('</svg>'));
});
