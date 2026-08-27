'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const draftsPath = path.join(ROOT, 'data', 'drafts.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch (_error) {
      // Continue until the child process is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start.');
}

async function request(pathname, options) {
  const response = await fetch(`${BASE}${pathname}`, options);
  const data = await response.json();
  return { response, data };
}

async function main() {
  fs.mkdirSync(path.dirname(draftsPath), { recursive: true });
  fs.writeFileSync(draftsPath, '{}\n');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      BP_MODE: 'mock',
      BETTER_PROPOSALS_API_TOKEN: '',
      TEST_RECIPIENT_EMAILS: 'jem@visture.ca',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForServer();

    const health = await request('/api/health');
    assert(health.response.ok, 'Health endpoint failed.');
    assert(health.data.mode === 'mock', 'Server should be in mock mode.');
    assert(health.data.sendAutomationAvailable === false, 'Send automation must remain disabled.');

    const discover = await request('/api/bp/discover');
    assert(discover.response.ok, 'Discovery endpoint failed.');
    assert(Array.isArray(discover.data.templates) && discover.data.templates.length > 0, 'Mock templates were not returned.');

    const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-create-draft-request.json'), 'utf8'));
    sample.betterProposals.templateId = 'MOCK-TEMPLATE-01';
    sample.intakeId = `VST-BP-TEST-${Date.now()}`;

    const first = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });
    assert(first.response.ok, `Draft creation failed: ${first.data.message || 'unknown error'}`);
    assert(first.data.duplicatePrevented === false, 'First draft should not be marked duplicate.');
    assert(first.data.draft.safety.sendEndpointExposedByThisPOC === false, 'Draft safety flag is incorrect.');

    const second = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });
    assert(second.response.ok, 'Duplicate request failed.');
    assert(second.data.duplicatePrevented === true, 'Duplicate draft was not prevented.');

    const blocked = await request('/api/bp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert(blocked.response.status === 405, 'Send endpoint should be blocked.');

    const wrongRecipient = JSON.parse(JSON.stringify(sample));
    wrongRecipient.intakeId = `VST-BP-TEST-WRONG-${Date.now()}`;
    wrongRecipient.recipient.email = 'customer@example.com';
    const rejected = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wrongRecipient),
    });
    assert(rejected.response.status === 400, 'Non-allowlisted recipient should be rejected.');

    console.log('All mock-mode POC tests passed.');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
