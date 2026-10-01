/**
 * YAML Workflow Definition Loader and State Machine Engine
 * 
 * Author: Eng. MHD. Shadi AL-Hasan <mhd.shadi.alhasan@gmail.com>
 * Phone: +963934005922
 * Copyright (c) 2026 MHD. Shadi AL-Hasan
 */

const fs = require('fs');
const path = require('path');

/**
 * Lightweight, zero-dependency YAML parser for nested workflow definitions.
 * Handles strings, numbers, booleans, maps, and lists.
 */
function parseSimpleYaml(content) {
  const lines = content.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  for (let rawLine of lines) {
    // Strip comments
    const commentIdx = rawLine.indexOf('#');
    const lineWithoutComment = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    if (!lineWithoutComment.trim()) continue;

    const indent = lineWithoutComment.search(/\S/);
    const trimmed = lineWithoutComment.trim();

    // Key-value or list item
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '');
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1].obj;

    if (rawVal === '') {
      const newObj = {};
      current[key] = newObj;
      stack.push({ indent, obj: newObj });
    } else {
      let parsedVal = rawVal;
      if (parsedVal.startsWith('"') && parsedVal.endsWith('"')) {
        parsedVal = parsedVal.slice(1, -1);
      } else if (parsedVal.startsWith("'") && parsedVal.endsWith("'")) {
        parsedVal = parsedVal.slice(1, -1);
      } else if (parsedVal === 'true') {
        parsedVal = true;
      } else if (parsedVal === 'false') {
        parsedVal = false;
      } else if (!isNaN(Number(parsedVal)) && parsedVal !== '') {
        parsedVal = Number(parsedVal);
      }
      current[key] = parsedVal;
    }
  }

  return root;
}

/**
 * Load and validate workflow from a YAML file.
 */
function loadWorkflow(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Workflow definition file not found: ${resolved}`);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  let data;
  try {
    // Attempt using js-yaml if installed
    const jsYaml = require('js-yaml');
    data = jsYaml.load(content);
  } catch {
    // Fall back to built-in zero-dependency parser
    data = parseSimpleYaml(content);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid workflow format: expected root object.');
  }

  if (!data.initial_state) {
    data.initial_state = 'INIT';
  }

  if (!data.states || typeof data.states !== 'object') {
    throw new Error('Invalid workflow: missing "states" object.');
  }

  return data;
}

/**
 * State Machine Flow Engine
 */
class StateMachineEngine {
  constructor(workflow) {
    if (typeof workflow === 'string') {
      this.workflow = loadWorkflow(workflow);
    } else {
      this.workflow = workflow || { initial_state: 'INIT', states: {} };
    }
    this.initialState = this.workflow.initial_state || 'INIT';
    this.states = this.workflow.states || {};
  }

  /**
   * Evaluate transition given current state and user input
   */
  transition(currentState, input) {
    const stateKey = currentState || this.initialState;
    const stateConfig = this.states[stateKey];

    if (!stateConfig) {
      // Unknown state fallback
      const initialConfig = this.states[this.initialState] || {};
      return {
        nextState: this.initialState,
        reply: initialConfig.reply || 'Welcome! How can we assist you today?'
      };
    }

    const cleanedInput = (input || '').toString().trim().toLowerCase();
    const transitions = stateConfig.transitions || {};

    let nextState = null;

    // Direct match
    if (transitions[cleanedInput] !== undefined) {
      nextState = transitions[cleanedInput];
    } else if (transitions['*'] !== undefined) {
      nextState = transitions['*'];
    } else if (transitions['default'] !== undefined) {
      nextState = transitions['default'];
    } else {
      nextState = this.initialState;
    }

    const nextStateConfig = this.states[nextState] || {};
    const reply = nextStateConfig.reply || stateConfig.reply || 'Processing your request...';

    return {
      previousState: stateKey,
      nextState: nextState,
      reply: reply
    };
  }
}

module.exports = {
  parseSimpleYaml,
  loadWorkflow,
  StateMachineEngine
};
