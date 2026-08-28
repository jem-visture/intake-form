import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AGENT_DIR = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(AGENT_DIR, '.env'));

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    proposal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        scope: { type: 'string' },
        estimateGrouping: { type: 'string', enum: ['room', 'trade', 'phase', 'apartment'] },
        specifications: { type: 'string' },
        materialLineItems: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              area: { type: 'string' },
              name: { type: 'string' },
              quantity: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
              unit: { type: 'string', enum: ['each', 'sq ft', 'linear ft', 'allowance', 'lump sum'] },
              unitPrice: { type: 'number', minimum: 0, maximum: 10000000 },
            },
            required: ['area', 'name', 'quantity', 'unit', 'unitPrice'],
          },
        },
        laborEstimate: {
          type: 'object',
          additionalProperties: false,
          properties: { hours: { type: 'number', exclusiveMinimum: 0, maximum: 10000 } },
          required: ['hours'],
        },
        allowances: { type: 'string' },
        quotePending: { type: 'string' },
        pricingNotes: { type: 'string' },
        total: { type: 'string' },
        assumptions: { type: 'string' },
        exclusions: { type: 'string' },
        options: { type: 'string' },
      },
      required: [
        'summary', 'scope', 'estimateGrouping', 'specifications', 'materialLineItems',
        'laborEstimate', 'allowances', 'quotePending', 'pricingNotes', 'total',
        'assumptions', 'exclusions', 'options',
      ],
    },
    warnings: { type: 'array', items: { type: 'string' } },
    missingInformation: { type: 'array', items: { type: 'string' } },
  },
  required: ['proposal', 'warnings', 'missingInformation'],
};

const SYSTEM_PROMPT = `You are Visture's preliminary renovation estimating assistant for Canadian projects over CAD 50,000.
Convert site intake into a structured, client-ready draft estimate for human review.

Non-negotiable rules:
- Return only data matching the supplied JSON schema.
- Organize the scope consistently by room, trade, phase, or apartment.
- Separate material line items from labour. Labour is hours only; the application applies CAD 75/hour.
- Use plausible CAD test pricing, but never present uncertain figures as supplier quotes.
- Put unknown trade or supplier prices in quotePending and missing details in missingInformation.
- State assumptions and exclusions explicitly. Do not invent measurements, existing conditions, permits, or client decisions.
- Treat photographs as supporting evidence only and mention uncertainty when they are inconclusive.
- Keep proposal language persuasive but factual. This is a preliminary AI estimate and requires JG approval.
- Never instruct any system to create, approve, or send a proposal.`;

function numberSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function configFromEnv(overrides = {}) {
  const allowedOrigins = String(process.env.LOCAL_AGENT_ALLOWED_ORIGINS || 'http://localhost:8787,http://127.0.0.1:8787')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  return {
    host: process.env.LOCAL_AGENT_HOST || '127.0.0.1',
    port: numberSetting(process.env.LOCAL_AGENT_PORT, 8788),
    allowedOrigins,
    ollamaBaseUrl: String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
    ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:1b',
    ollamaTimeoutMs: numberSetting(process.env.OLLAMA_TIMEOUT_MS, 240000),
    connectivityMode: String(process.env.LOCAL_AGENT_CONNECTIVITY_MODE || 'false').toLowerCase() === 'true',
    maxRequestBytes: numberSetting(process.env.LOCAL_AGENT_MAX_REQUEST_MB, 25) * 1024 * 1024,
    maxPhotos: numberSetting(process.env.LOCAL_AGENT_MAX_PHOTOS, 6),
    ...overrides,
  };
}

function sendJson(res, statusCode, body, corsHeaders = {}) {
  const serialized = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(serialized),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders,
  });
  res.end(serialized);
}

function corsFor(req, config) {
  const origin = String(req.headers.origin || '');
  const allowed = !origin || config.allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === 'https://*.vercel.app') return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
    return allowedOrigin === origin;
  });
  const headers = { Vary: 'Origin, Access-Control-Request-Private-Network' };
  if (origin && allowed) headers['Access-Control-Allow-Origin'] = origin;
  return { origin, allowed, headers };
}

async function parseEstimateRequest(req, config) {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > config.maxRequestBytes) throw Object.assign(new Error('The estimator request is too large.'), { statusCode: 413 });
  if (!String(req.headers['content-type'] || '').startsWith('multipart/form-data')) {
    throw Object.assign(new Error('Content-Type must be multipart/form-data.'), { statusCode: 415 });
  }

  const webRequest = new Request('http://local-agent/estimate', {
    method: 'POST',
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: 'half',
  });
  const form = await webRequest.formData();
  const requestText = form.get('request');
  if (typeof requestText !== 'string' || !requestText.trim()) throw new Error('The multipart request field is required.');

  let intakeRequest;
  try { intakeRequest = JSON.parse(requestText); }
  catch (_error) { throw new Error('The request field must contain valid JSON.'); }

  const photographFiles = form.getAll('photographs').filter((entry) => typeof entry !== 'string');
  if (photographFiles.length > config.maxPhotos) throw new Error(`No more than ${config.maxPhotos} photographs may be processed at once.`);
  const totalPhotoBytes = photographFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalPhotoBytes > config.maxRequestBytes) throw Object.assign(new Error('The photographs exceed the configured request size limit.'), { statusCode: 413 });
  if (photographFiles.some((file) => !String(file.type || '').startsWith('image/'))) throw new Error('Only image files may be sent as photographs.');

  const images = [];
  for (const file of photographFiles) images.push(Buffer.from(await file.arrayBuffer()).toString('base64'));
  return { intakeRequest, images };
}

function validateIntake(request) {
  if (!request || typeof request !== 'object') throw new Error('The intake request is missing.');
  if (request.schemaVersion !== '1.0') throw new Error('Unsupported local-agent schema version.');
  const required = [
    ['project.name', request.project?.name],
    ['intake.siteNotes', request.intake?.siteNotes],
    ['intake.measurements', request.intake?.measurements],
    ['intake.clientObjectives', request.intake?.clientObjectives],
    ['intake.clientConstraints', request.intake?.clientConstraints],
  ];
  const missing = required.filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
  if (missing.length) throw new Error(`Required intake values are missing: ${missing.join(', ')}.`);
  if (Number(request.estimatingRules?.laborHourlyRate) !== 75) throw new Error('The approved labour rate must be CAD 75 per hour.');
}

function validateAndNormalizeAgentResponse(value) {
  const proposal = value?.proposal;
  if (!proposal || typeof proposal !== 'object') throw new Error('The model returned no proposal object.');
  if (!String(proposal.summary || '').trim() || !String(proposal.scope || '').trim()) throw new Error('The model returned incomplete summary or scope content.');
  if (!['room', 'trade', 'phase', 'apartment'].includes(proposal.estimateGrouping)) throw new Error('The model returned an invalid estimate grouping.');
  if (!Array.isArray(proposal.materialLineItems) || !proposal.materialLineItems.length || proposal.materialLineItems.length > 100) throw new Error('The model returned an invalid material item list.');
  const units = new Set(['each', 'sq ft', 'linear ft', 'allowance', 'lump sum']);
  proposal.materialLineItems = proposal.materialLineItems.map((item, index) => {
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    if (!String(item?.name || '').trim() || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10000000 || !units.has(item?.unit)) {
      throw new Error(`The model returned an invalid material item at row ${index + 1}.`);
    }
    return { area: String(item.area || '').trim(), name: String(item.name).trim(), quantity, unit: item.unit, unitPrice };
  });
  const laborHours = Number(proposal.laborEstimate?.hours);
  if (!Number.isFinite(laborHours) || laborHours <= 0 || laborHours > 10000) throw new Error('The model returned implausible labour hours; refine the intake or use a stronger local model.');
  proposal.laborEstimate = { hours: laborHours };
  const materialTotal = proposal.materialLineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const calculatedTotal = materialTotal + laborHours * 75;
  proposal.total = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(calculatedTotal) + ' before GST';
  const warnings = Array.isArray(value.warnings) ? value.warnings.map(String).filter(Boolean) : [];
  if (!warnings.some((warning) => /JG|human review/i.test(warning))) warnings.unshift('Preliminary AI-generated estimate; JG review is required before proposal creation.');
  return {
    proposal,
    warnings,
    missingInformation: Array.isArray(value.missingInformation) ? value.missingInformation.map(String).filter(Boolean) : [],
  };
}

function connectivityFallback(intakeRequest, modelError) {
  const projectName = String(intakeRequest.project?.name || 'Test renovation').trim();
  const siteNotes = String(intakeRequest.intake?.siteNotes || '').trim();
  const objectives = String(intakeRequest.intake?.clientObjectives || '').trim();
  return {
    proposal: {
      summary: `Connectivity-test estimate for ${projectName}. This fictional preliminary content confirms that the Vercel intake can reach the local estimator and return Section 3 for review.`,
      scope: `Preliminary test scope based on the supplied site notes: ${siteNotes}`,
      estimateGrouping: 'room',
      specifications: `Client objectives recorded for test assembly: ${objectives} Final products, quantities, colours, and performance requirements remain subject to confirmation.`,
      materialLineItems: [
        { area: 'Project-wide', name: 'Preliminary construction materials allowance', quantity: 1, unit: 'allowance', unitPrice: 45000 },
        { area: 'Project-wide', name: 'Preliminary fixtures and finishes allowance', quantity: 1, unit: 'allowance', unitPrice: 25000 },
      ],
      laborEstimate: { hours: 600 },
      allowances: 'Connectivity-test allowances only; replace with approved Visture estimating rules and supplier pricing.',
      quotePending: 'Trade quotations, permits, structural work, specialty items, and final product selections remain pending.',
      pricingNotes: 'Connectivity-test pricing in CAD. Labour is calculated at the application-controlled rate of CAD 75 per hour.',
      total: '$115,000.00 before GST',
      assumptions: 'The intake is sufficient only to prove connectivity. Existing conditions, access, quantities, and trade requirements require JG confirmation.',
      exclusions: 'Final design, permits, hazardous-material remediation, engineering, and work not expressly confirmed are excluded from this connectivity test.',
      options: 'No priced options are included in the connectivity test.',
    },
    warnings: [
      'CONNECTIVITY TEST ONLY: the tiny local model failed strict estimate validation, so safe fictional Section 3 values were substituted.',
      `Model validation detail: ${modelError.message}`,
      'JG review is required. Do not use these figures for a client proposal.',
    ],
    missingInformation: ['Approved estimating rules, historical pricing, trade quotations, product selections, and verified site conditions.'],
  };
}

async function callOllama(intakeRequest, images, config) {
  const prompt = `Prepare Section 3 from this intake JSON. Use CAD test pricing and identify every uncertainty.\n\n${JSON.stringify(intakeRequest, null, 2)}\n\nRequired response schema:\n${JSON.stringify(RESPONSE_SCHEMA)}`;
  let response;
  try {
    response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt, ...(images.length ? { images } : {}) },
        ],
        format: RESPONSE_SCHEMA,
        stream: false,
        options: { temperature: 0, num_ctx: 16384 },
      }),
      signal: AbortSignal.timeout(config.ollamaTimeoutMs),
    });
  } catch (error) {
    throw Object.assign(new Error(`Cannot reach Ollama at ${config.ollamaBaseUrl}. Start Ollama and confirm the configured model is installed.`), { cause: error, statusCode: 502 });
  }
  let body;
  try { body = await response.json(); }
  catch (_error) { throw Object.assign(new Error('Ollama returned an unreadable response.'), { statusCode: 502 }); }
  if (!response.ok) throw Object.assign(new Error(body.error || `Ollama HTTP ${response.status}.`), { statusCode: 502 });
  try { return JSON.parse(body.message?.content || ''); }
  catch (_error) { throw Object.assign(new Error('Ollama did not return valid structured JSON.'), { statusCode: 502 }); }
}

export function createEstimatorServer(options = {}) {
  const config = configFromEnv(options);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://local-agent');
    const cors = corsFor(req, config);
    if (!cors.allowed) {
      sendJson(res, 403, { message: `Origin ${cors.origin} is not allowed. Add it to LOCAL_AGENT_ALLOWED_ORIGINS.` }, cors.headers);
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors.headers,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        ...(req.headers['access-control-request-private-network'] === 'true' ? { 'Access-Control-Allow-Private-Network': 'true' } : {}),
      });
      res.end();
      return;
    }
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        let ollamaReady = false;
        let availableModels = [];
        try {
          const modelResponse = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
          const modelData = await modelResponse.json();
          availableModels = Array.isArray(modelData.models) ? modelData.models.map((model) => model.name).filter(Boolean) : [];
          ollamaReady = modelResponse.ok && availableModels.includes(config.ollamaModel);
        } catch (_error) { /* Report readiness below. */ }
        sendJson(res, 200, { status: 'ok', ollamaReady, configuredModel: config.ollamaModel, availableModels }, cors.headers);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/estimate') {
        const { intakeRequest, images } = await parseEstimateRequest(req, config);
        validateIntake(intakeRequest);
        const modelValue = await callOllama(intakeRequest, images, config);
        let result;
        try { result = validateAndNormalizeAgentResponse(modelValue); }
        catch (modelError) {
          if (!config.connectivityMode) throw modelError;
          result = connectivityFallback(intakeRequest, modelError);
        }
        sendJson(res, 200, result, cors.headers);
        return;
      }
      sendJson(res, 404, { message: 'Not found.' }, cors.headers);
    } catch (error) {
      const statusCode = Number(error.statusCode) || (/required|invalid|missing|unsupported|must|only|more than/i.test(error.message) ? 400 : 500);
      sendJson(res, statusCode, { message: error.message || 'Local estimator error.' }, cors.headers);
    }
  });
  return { server, config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, config } = createEstimatorServer();
  server.listen(config.port, config.host, () => {
    console.log(`Visture local estimator listening at http://${config.host}:${config.port}`);
    console.log(`Ollama model: ${config.ollamaModel}`);
    console.log('This service only generates Section 3 and has no Better Proposals create, approve, or send capability.');
  });
}
