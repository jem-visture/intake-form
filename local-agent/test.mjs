import http from 'node:http';
import { createEstimatorServer } from './server.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const modelResponse = {
  proposal: {
    summary: 'A preliminary client-facing renovation summary.',
    scope: 'Kitchen renovation organized by room.',
    estimateGrouping: 'room',
    specifications: 'Durable mid-range finishes pending client selections.',
    materialLineItems: [
      { area: 'Kitchen', name: 'Semi-custom cabinetry', quantity: 1, unit: 'lump sum', unitPrice: 42000 },
      { area: 'Kitchen', name: 'Quartz countertop', quantity: 55, unit: 'sq ft', unitPrice: 145 },
    ],
    laborEstimate: { hours: 520 },
    allowances: 'Appliance allowance excluded pending selection.',
    quotePending: 'Electrical service changes require a trade quote.',
    pricingNotes: 'Preliminary CAD pricing before GST.',
    total: 'This model value must be replaced by deterministic arithmetic.',
    assumptions: 'Existing walls are non-structural unless confirmed otherwise.',
    exclusions: 'Hazardous-material remediation is excluded.',
    options: 'Optional under-cabinet lighting package.',
  },
  warnings: [],
  missingInformation: ['Confirm electrical panel capacity.'],
};

const fakeOllama = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/tags') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: [{ name: 'test-model' }] }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert(request.model === 'test-model', 'Configured model was not used.');
      assert(request.format?.properties?.proposal, 'Structured response schema was not sent.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(modelResponse) }, done: true }));
    });
    return;
  }
  res.writeHead(404).end();
});

const ollamaPort = await listen(fakeOllama);
const { server: agent } = createEstimatorServer({
  port: 0,
  allowedOrigins: ['https://visture-test.vercel.app'],
  ollamaBaseUrl: `http://127.0.0.1:${ollamaPort}`,
  ollamaModel: 'test-model',
});
const agentPort = await listen(agent);

try {
  const health = await fetch(`http://127.0.0.1:${agentPort}/health`, { headers: { Origin: 'https://visture-test.vercel.app' } });
  const healthBody = await health.json();
  assert(health.ok && healthBody.ollamaReady, 'Health check did not detect the configured model.');

  const intake = {
    schemaVersion: '1.0',
    project: { name: 'Test renovation' },
    intake: {
      siteNotes: 'Renovate the existing kitchen.',
      measurements: 'Kitchen is 12 ft by 14 ft.',
      clientObjectives: 'Improve storage and durability.',
      clientConstraints: 'Condo work-hour restrictions apply.',
    },
    estimatingRules: { laborHourlyRate: 75 },
  };
  const form = new FormData();
  form.append('request', JSON.stringify(intake));
  const response = await fetch(`http://127.0.0.1:${agentPort}/estimate`, {
    method: 'POST',
    headers: { Origin: 'https://visture-test.vercel.app' },
    body: form,
  });
  const body = await response.json();
  assert(response.ok, body.message || 'Estimator request failed.');
  assert(body.proposal.total === '$88,975.00 before GST', 'The deterministic CAD total is incorrect.');
  assert(body.warnings.some((warning) => /JG review/i.test(warning)), 'Required JG review warning is missing.');

  const denied = await fetch(`http://127.0.0.1:${agentPort}/health`, { headers: { Origin: 'https://not-allowed.example' } });
  assert(denied.status === 403, 'An unapproved browser origin should be rejected.');
  console.log('All local estimator agent tests passed.');
} finally {
  await close(agent);
  await close(fakeOllama);
}
