'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildMergeTags, serializeMergeTags, REQUIRED_MERGE_TAGS } = require('./server');

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
    assert(discover.data.configuration.templateId === '744153', 'Template 744153 should be configured on the backend.');
    assert(discover.data.configuredTemplateFound === true, 'Configured backend template should be discoverable.');
    assert(discover.data.ready === true, 'Backend Better Proposals mapping should be ready in mock mode.');

    const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample-create-draft-request.json'), 'utf8'));
    const materialSubtotal = sample.proposal.materialLineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    assert(materialSubtotal === 152500, 'Dummy material line items should total CAD 152,500.');
    assert(sample.proposal.laborEstimate.hours * sample.proposal.laborEstimate.hourlyRate === 127500, 'Dummy labour should total CAD 127,500.');
    assert(materialSubtotal + (sample.proposal.laborEstimate.hours * sample.proposal.laborEstimate.hourlyRate) === 280000, 'Dummy materials and labour should total CAD 280,000.');
    const mergeTags = buildMergeTags(sample);
    assert(mergeTags.length === REQUIRED_MERGE_TAGS.length, 'Dummy data should populate every required merge tag.');
    assert(REQUIRED_MERGE_TAGS.every((requiredTag) => mergeTags.some((entry) => entry.tag === requiredTag && entry.value.trim())), 'A required dummy merge tag is blank.');
    assert(mergeTags.every((entry) => JSON.stringify(entry).length <= 1000), 'A dummy merge-tag entry exceeds Better Proposals\' 1,000-character limit.');
    const materialPricing = mergeTags.find((entry) => entry.tag === 'material_pricing');
    assert(materialPricing.value.includes('cellpadding="10"'), 'Dummy material pricing should use the spaced HTML table.');
    assert(materialPricing.value.includes('rules="rows"'), 'Dummy material pricing should include row separators.');
    let mergeTagLimitError = '';
    try {
      serializeMergeTags(sample);
    } catch (error) {
      mergeTagLimitError = error.message;
    }
    assert(/configured Better Proposals MergeTags limit is 1,000 characters/.test(mergeTagLimitError), 'The configured direct API limit should be detected before a live request.');
    sample.intakeId = `VST-BP-TEST-${Date.now()}`;

    const first = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });
    assert(first.response.ok, `Draft creation failed: ${first.data.message || 'unknown error'}`);
    assert(first.data.duplicatePrevented === false, 'First draft should not be marked duplicate.');
    assert(first.data.draft.safety.sendEndpointExposedByThisPOC === false, 'Draft safety flag is incorrect.');

    const incompleteEstimate = JSON.parse(JSON.stringify(sample));
    incompleteEstimate.intakeId = `VST-BP-TEST-INCOMPLETE-${Date.now()}`;
    incompleteEstimate.proposal.materialLineItems = [];
    const rejectedEstimate = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incompleteEstimate),
    });
    assert(rejectedEstimate.response.status === 400, 'Missing material pricing should block draft creation.');

    const invalidQuantity = JSON.parse(JSON.stringify(sample));
    invalidQuantity.intakeId = `VST-BP-TEST-QUANTITY-${Date.now()}`;
    invalidQuantity.proposal.materialLineItems[0].quantity = 0;
    const rejectedQuantity = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidQuantity),
    });
    assert(rejectedQuantity.response.status === 400, 'A zero material quantity should block draft creation.');

    const invalidLabor = JSON.parse(JSON.stringify(sample));
    invalidLabor.intakeId = `VST-BP-TEST-LABOR-${Date.now()}`;
    invalidLabor.proposal.laborEstimate.hours = 0;
    const rejectedLabor = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidLabor),
    });
    assert(rejectedLabor.response.status === 400, 'Zero estimated labour hours should block draft creation.');

    const missingSurname = JSON.parse(JSON.stringify(sample));
    missingSurname.intakeId = `VST-BP-TEST-SURNAME-${Date.now()}`;
    missingSurname.recipient.lastName = '';
    const rejectedSurname = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missingSurname),
    });
    assert(rejectedSurname.response.status === 400, 'A missing recipient surname should block draft creation before the Better Proposals API call.');

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

    const alternateRecipient = JSON.parse(JSON.stringify(sample));
    alternateRecipient.intakeId = `VST-BP-TEST-ALTERNATE-${Date.now()}`;
    alternateRecipient.recipient.email = 'alternate-recipient@example.com';
    const accepted = await request('/api/bp/create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alternateRecipient),
    });
    assert(accepted.response.ok, 'The valid recipient entered in the form should be accepted.');

    console.log('All mock-mode POC tests passed.');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
