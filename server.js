'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'visture-better-proposals-poc')
  : path.join(ROOT, 'data');
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 8787);
const API_BASE = String(process.env.BP_API_BASE || 'https://api.betterproposals.io').replace(/\/+$/, '');
const TOKEN = String(process.env.BETTER_PROPOSALS_API_TOKEN || '').trim();
const MODE = String(process.env.BP_MODE || (TOKEN ? 'live' : 'mock')).toLowerCase();
const MERGE_TAG_LIMIT_INPUT = Number(process.env.BP_MERGE_TAG_LIMIT || '1000');
const BP_CONFIG = Object.freeze({
  templateId: String(process.env.BP_TEMPLATE_ID || '744153').trim(),
  coverId: String(process.env.BP_COVER_ID || '').trim(),
  brandId: String(process.env.BP_BRAND_ID || '').trim(),
  documentType: String(process.env.BP_DOCUMENT_TYPE || '1').trim(),
  currency: String(process.env.BP_CURRENCY || 'cad').trim().toLowerCase(),
  taxEnabled: String(process.env.BP_TAX_ENABLED || 'true').toLowerCase() === 'true',
  taxLabel: String(process.env.BP_TAX_LABEL || 'GST').trim(),
  taxAmount: String(process.env.BP_TAX_AMOUNT || '5').trim(),
  mergeTagLimit: Number.isFinite(MERGE_TAG_LIMIT_INPUT) && MERGE_TAG_LIMIT_INPUT > 0 ? Math.floor(MERGE_TAG_LIMIT_INPUT) : 1000,
});
const REQUIRED_MERGE_TAGS = [
  'project_name', 'site_address', 'client_objectives', 'client_constraints',
  'proposal_summary', 'scope_of_work', 'estimate_grouping', 'client_specifications',
  'material_pricing', 'material_subtotal', 'labour_pricing', 'labour_hours',
  'labour_hourly_rate', 'labour_total', 'estimate_subtotal', 'allowances',
  'quote_pending_items', 'pricing_summary', 'assumptions', 'exclusions', 'options',
  'proposal_total', 'intake_reference',
];

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DRAFTS_FILE)) fs.writeFileSync(DRAFTS_FILE, '{}\n');

function readDrafts() {
  try {
    const value = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch (_error) {
    return {};
  }
}

function writeDrafts(value) {
  const temp = `${DRAFTS_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, DRAFTS_FILE);
}

function json(res, statusCode, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function text(res, statusCode, value, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(value),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(value);
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseBody(req, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_error) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

async function bpRequest(endpoint, options = {}) {
  if (MODE !== 'live') throw new Error('Better Proposals live mode is not enabled.');
  if (!TOKEN) throw new Error('BETTER_PROPOSALS_API_TOKEN is missing.');

  const method = options.method || 'GET';
  const headers = {
    Bptoken: TOKEN,
    Accept: 'application/json',
  };
  let body;
  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = options.form.toString();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch (_error) {
      throw new Error(`Better Proposals returned non-JSON data (HTTP ${response.status}).`);
    }
    if (!response.ok || parsed.status === 'error') {
      const message = parsed.message || `HTTP ${response.status}`;
      const error = new Error(`Better Proposals API error: ${message}`);
      error.details = parsed;
      throw error;
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeList(response) {
  if (!response || typeof response !== 'object') return [];
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) return value;
    }
    return [data];
  }
  return [];
}

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function requiredString(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid recipient email is required.');
  return email;
}

const MATERIAL_UNITS = new Set(['each', 'sq ft', 'linear ft', 'allowance', 'lump sum']);

function normalizeMaterialLineItems(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('At least one material line item is required.');
  if (value.length > 50) throw new Error('Material line items cannot exceed 50 rows.');
  return value.map((item, index) => {
    const row = item && typeof item === 'object' ? item : {};
    const area = String(row.area || '').trim().slice(0, 120);
    const name = requiredString(row.name, `Material line item ${index + 1} name`).slice(0, 200);
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const unit = String(row.unit || '').trim();
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Material line item ${index + 1} quantity must be greater than zero.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Material line item ${index + 1} unit price must be zero or greater.`);
    if (!MATERIAL_UNITS.has(unit)) throw new Error(`Material line item ${index + 1} unit is unsupported.`);
    const cleanQuantity = Math.round(quantity * 100) / 100;
    const cleanUnitPrice = Math.round(unitPrice * 100) / 100;
    return {
      area,
      name,
      quantity: cleanQuantity,
      unit,
      unitPrice: cleanUnitPrice,
      total: Math.round(cleanQuantity * cleanUnitPrice * 100) / 100,
    };
  });
}

function cad(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function materialPricingHtml(items) {
  const rows = items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(`${item.quantity} ${item.unit}`)}</td><td>${escapeHtml(cad(item.unitPrice))}</td><td>${escapeHtml(cad(item.total))}</td></tr>`).join('');
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  return `<table width="100%" cellpadding="10" cellspacing="0" rules="rows"><tr bgcolor="#e6e3de"><th align="left">Item</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr>${rows}<tr><th colspan="3" align="right">Subtotal</th><th>${escapeHtml(cad(subtotal))}</th></tr></table>`;
}

function normalizeLaborEstimate(value) {
  const labor = value && typeof value === 'object' ? value : {};
  const hours = Number(labor.hours);
  const hourlyRate = Number(labor.hourlyRate);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 100000) throw new Error('Estimated total labour hours must be greater than zero.');
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || hourlyRate > 10000) throw new Error('Labour rate per hour must be greater than zero.');
  const cleanHours = Math.round(hours * 100) / 100;
  const cleanHourlyRate = Math.round(hourlyRate * 100) / 100;
  return {
    hours: cleanHours,
    hourlyRate: cleanHourlyRate,
    total: Math.round(cleanHours * cleanHourlyRate * 100) / 100,
  };
}

function laborPricingText(labor) {
  return `${labor.hours} estimated hours × ${cad(labor.hourlyRate)}/hour = ${cad(labor.total)}`;
}

function pricingSummaryText(notes, materialSubtotal, labor) {
  return [
    `Materials subtotal: ${cad(materialSubtotal)}`,
    `Labour: ${laborPricingText(labor)}`,
    `MATERIALS + LABOUR SUBTOTAL: ${cad(materialSubtotal + labor.total)}`,
    String(notes || '').trim(),
  ].filter(Boolean).join('\n');
}

function addIfPresent(form, key, value) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    form.append(key, String(value));
  }
}

function findValueDeep(input, keyPattern) {
  if (!input || typeof input !== 'object') return '';
  for (const [key, value] of Object.entries(input)) {
    if (keyPattern.test(key) && (typeof value === 'string' || typeof value === 'number')) return String(value);
    if (value && typeof value === 'object') {
      const found = findValueDeep(value, keyPattern);
      if (found) return found;
    }
  }
  return '';
}

function buildMergeTags(body) {
  const project = body.project || {};
  const intake = body.intake || {};
  const proposal = body.proposal || {};
  const materialLineItems = normalizeMaterialLineItems(proposal.materialLineItems);
  const materialSubtotal = materialLineItems.reduce((sum, item) => sum + item.total, 0);
  const labor = normalizeLaborEstimate(proposal.laborEstimate);
  const mapping = {
    project_name: project.name,
    site_address: project.siteAddress,
    client_objectives: intake.clientObjectives,
    client_constraints: intake.clientConstraints,
    proposal_summary: proposal.summary,
    scope_of_work: proposal.scope,
    estimate_grouping: proposal.estimateGrouping,
    client_specifications: proposal.specifications,
    material_pricing: materialPricingHtml(materialLineItems),
    material_subtotal: cad(materialSubtotal),
    labour_pricing: laborPricingText(labor),
    labour_hours: labor.hours,
    labour_hourly_rate: cad(labor.hourlyRate),
    labour_total: cad(labor.total),
    estimate_subtotal: cad(materialSubtotal + labor.total),
    allowances: proposal.allowances,
    quote_pending_items: proposal.quotePending,
    pricing_summary: pricingSummaryText(proposal.pricingNotes, materialSubtotal, labor),
    assumptions: proposal.assumptions,
    exclusions: proposal.exclusions,
    options: proposal.options,
    proposal_total: proposal.total,
    intake_reference: body.intakeId,
  };
  return Object.entries(mapping)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([tag, value]) => {
      const entry = { tag, value: String(value) };
      const entryLength = JSON.stringify(entry).length;
      if (entryLength > BP_CONFIG.mergeTagLimit) {
        throw new Error(`Better Proposals merge tag "${tag}" is too long (${entryLength.toLocaleString('en-CA')}/${BP_CONFIG.mergeTagLimit.toLocaleString('en-CA')} characters). Shorten this content before creating a draft.`);
      }
      return entry;
    });
}

function serializeMergeTags(body) {
  const serialized = JSON.stringify(buildMergeTags(body));
  if (serialized.length > BP_CONFIG.mergeTagLimit) {
    throw new Error(`The configured Better Proposals MergeTags limit is ${BP_CONFIG.mergeTagLimit.toLocaleString('en-CA')} characters. This draft requires ${serialized.length.toLocaleString('en-CA')}. Upgrade or correct BP_MERGE_TAG_LIMIT before retrying.`);
  }
  return serialized;
}

function buildCreateForm(body) {
  const project = body.project || {};
  const recipient = body.recipient || {};
  const config = BP_CONFIG;
  const form = new URLSearchParams();

  form.append('Company', String(recipient.company || recipient.fullName || 'Visture POC Test'));
  addIfPresent(form, 'Cover', config.coverId);
  form.append('Template', requiredString(config.templateId, 'Better Proposals template ID'));
  form.append('DocumentType', String(config.documentType || '1'));
  addIfPresent(form, 'Brand', config.brandId);
  form.append('Currency', String(config.currency || 'cad').toLowerCase());
  form.append('Tax', config.taxEnabled ? '1' : '0');
  if (config.taxEnabled) {
    form.append('TaxLabel', String(config.taxLabel || 'GST'));
    form.append('TaxAmount', String(config.taxAmount || '5'));
  }

  form.append('Contacts[0][FirstName]', requiredString(recipient.firstName, 'Recipient first name'));
  addIfPresent(form, 'Contacts[0][Surname]', recipient.lastName);
  form.append('Contacts[0][Email]', cleanEmail(recipient.email));
  form.append('Contacts[0][Signature]', recipient.signatureRequired === false ? '0' : '1');
  form.append('MergeTags', serializeMergeTags(body));

  // The public API does not document a title field. Put the test title into a merge tag.
  if (project.name) {
    const tags = buildMergeTags(body);
    if (!tags.some((item) => item.tag === 'project_name')) {
      tags.push({ tag: 'project_name', value: String(project.name) });
      form.set('MergeTags', JSON.stringify(tags));
    }
  }

  return form;
}

function validateCreateRequest(body) {
  if (!body || typeof body !== 'object') throw new Error('Request body is required.');
  requiredString(body.recipient && body.recipient.lastName, 'Recipient last name');
  const recipientEmail = cleanEmail(body.recipient && body.recipient.email);
  if (!body.release || body.release.forJGReview !== true) {
    throw new Error('The release-for-JG-review confirmation is required.');
  }
  if (String(body.release.reviewOwner || '').trim().toUpperCase() !== 'JG') {
    throw new Error('JG must be the designated final reviewer for this POC.');
  }
  requiredString(body.intakeId, 'Intake ID');
  requiredString(body.project && body.project.name, 'Project name');
  requiredString(body.proposal && body.proposal.scope, 'Proposal scope');
  requiredString(body.proposal && body.proposal.estimateGrouping, 'Estimate organization');
  normalizeMaterialLineItems(body.proposal && body.proposal.materialLineItems);
  normalizeLaborEstimate(body.proposal && body.proposal.laborEstimate);
  return recipientEmail;
}

function discoveryRecordId(item) {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  if (!item || typeof item !== 'object') return '';
  return String(item.id || item.ID || item.Id || item.TemplateID || item.template_id || item.code || item.Code || '');
}

function discoveryTagName(item) {
  if (typeof item === 'string') return item.replace(/[{}]/g, '');
  if (!item || typeof item !== 'object') return '';
  return String(item.tag || item.Tag || item.slug || item.Slug || item.name || item.Name || '').replace(/[{}]/g, '');
}

function assessDiscovery(result) {
  const templateIds = Array.isArray(result.templates) ? result.templates.map(discoveryRecordId) : [];
  const tags = Array.isArray(result.mergeTags) ? result.mergeTags.map(discoveryTagName) : [];
  const missingTags = REQUIRED_MERGE_TAGS.filter((tag) => !tags.includes(tag));
  const templateFound = templateIds.includes(BP_CONFIG.templateId);
  const coreListsReady = Array.isArray(result.documentTypes) && result.documentTypes.length > 0
    && Array.isArray(result.currencies) && result.currencies.length > 0;
  return {
    ready: templateFound && coreListsReady && missingTags.length === 0,
    configuredTemplateFound: templateFound,
    missingTags,
  };
}

async function discoverBetterProposals() {
  if (MODE !== 'live') {
    const result = {
      mode: 'mock',
      templates: [{ id: BP_CONFIG.templateId, name: 'Visture POC Master Proposal' }],
      documentTypes: [{ id: '1', name: 'Proposals' }],
      currencies: [{ id: 'cad', name: 'Canadian Dollar', code: 'cad' }],
      brands: [{ id: 'MOCK-BRAND-01', name: 'Visture' }],
      mergeTags: REQUIRED_MERGE_TAGS.map((tag) => ({ tag, name: tag })),
      settings: { note: 'Mock mode: add a real API token in .env to query the account.' },
      configuration: { ...BP_CONFIG },
    };
    return { ...result, ...assessDiscovery(result) };
  }

  const endpoints = {
    templates: '/template/',
    documentTypes: '/doctype/',
    currencies: '/currency/',
    settings: '/settings/',
    brands: '/settings/brand/',
    mergeTags: '/settings/merge_tag/?per_page=100',
  };
  const entries = await Promise.all(Object.entries(endpoints).map(async ([key, endpoint]) => {
    try {
      const response = await bpRequest(endpoint);
      return [key, key === 'settings' ? response.data || response : normalizeList(response)];
    } catch (error) {
      return [key, { error: safeMessage(error) }];
    }
  }));
  const result = { mode: 'live', ...Object.fromEntries(entries), configuration: { ...BP_CONFIG } };
  return { ...result, ...assessDiscovery(result) };
}

async function createDraft(body) {
  const recipientEmail = validateCreateRequest(body);
  if (MODE === 'live') {
    const discovery = await discoverBetterProposals();
    if (!discovery.ready) {
      const reason = !discovery.configuredTemplateFound
        ? `Configured Better Proposals template ${BP_CONFIG.templateId} was not found.`
        : `Better Proposals account mapping is incomplete. Missing tags: ${discovery.missingTags.join(', ') || 'none'}.`;
      throw new Error(reason);
    }
  }
  const idempotencySeed = [
    body.intakeId,
    body.revision || '1',
    recipientEmail,
    BP_CONFIG.templateId,
  ].join('|');
  const idempotencyKey = hashKey(idempotencySeed);
  const drafts = readDrafts();

  if (drafts[idempotencyKey]) {
    return {
      status: 'success',
      duplicatePrevented: true,
      idempotencyKey,
      draft: drafts[idempotencyKey],
      nextAction: 'Use the existing draft. Do not create a duplicate.',
    };
  }

  let apiResponse;
  if (MODE === 'live') {
    apiResponse = await bpRequest('/proposal/create/', {
      method: 'POST',
      form: buildCreateForm(body),
    });
  } else {
    apiResponse = {
      status: 'success',
      data: {
        ProposalID: `MOCK-${Date.now()}`,
        Status: 'New / Draft',
        PreviewURL: 'https://betterproposals.io/mock-preview-not-live',
      },
    };
  }

  const rawData = apiResponse.data || apiResponse;
  const proposalId = findValueDeep(rawData, /^(proposal_?id|proposalid|id)$/i);
  let statusResponse = null;
  let statusLookupError = '';
  if (MODE === 'live' && proposalId) {
    try {
      statusResponse = await getProposal(proposalId);
    } catch (error) {
      statusLookupError = safeMessage(error);
    }
  }
  const statusData = statusResponse && (statusResponse.data || statusResponse);
  const proposalStatus = findValueDeep(statusData, /^(proposal_?status|document_?status|status)$/i)
    || findValueDeep(rawData, /^(proposal_?status|document_?status|status)$/i)
    || 'Created; confirm draft status in Better Proposals';
  const proposalViewUrl = findValueDeep(statusData, /^proposal_?view$/i)
    || findValueDeep(rawData, /^proposal_?view$/i);
  const previewUrl = findValueDeep(statusData, /^(preview|preview_?url)$/i)
    || findValueDeep(rawData, /^(preview|preview_?url)$/i);
  const reviewUrl = proposalViewUrl
    || findValueDeep(statusData, /^(proposal_?url|document_?url|review_?url|url|link)$/i)
    || findValueDeep(rawData, /^(proposal_?url|document_?url|review_?url|url|link)$/i)
    || previewUrl;
  const record = {
    createdAt: new Date().toISOString(),
    mode: MODE,
    recipientEmail,
    projectName: body.project.name,
    proposalId,
    proposalStatus,
    reviewUrl,
    previewUrl,
    apiResponse,
    statusResponse,
    statusLookupError,
    safety: {
      createdAsDraftOnly: true,
      sendEndpointExposedByThisPOC: false,
      designatedReviewer: 'JG',
    },
  };
  drafts[idempotencyKey] = record;
  writeDrafts(drafts);

  return {
    status: 'success',
    duplicatePrevented: false,
    idempotencyKey,
    draft: record,
    nextAction: 'Open the draft in Better Proposals for JG review. Approval and sending are intentionally not automated by this POC.',
  };
}

async function getProposal(id) {
  const cleanId = requiredString(id, 'Proposal ID');
  if (!/^[A-Za-z0-9_\-:.]+$/.test(cleanId)) throw new Error('Proposal ID contains unsupported characters.');
  if (MODE !== 'live') {
    return {
      status: 'success',
      mode: 'mock',
      data: { ProposalID: cleanId, Status: 'New / Draft', Note: 'Mock mode cannot observe sent, opened, or signed activity.' },
    };
  }
  return bpRequest(`/proposal/${encodeURIComponent(cleanId)}/`);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    text(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      text(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    text(res, 200, data, types[ext] || 'application/octet-stream');
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        mode: MODE,
        tokenConfigured: Boolean(TOKEN),
        recipientPolicy: 'The validated email entered in the intake form is used as the document recipient.',
        sendAutomationAvailable: false,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/bp/discover') {
      json(res, 200, await discoverBetterProposals());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/bp/create-draft') {
      const body = await parseBody(req);
      json(res, 200, await createDraft(body));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/bp/proposal') {
      json(res, 200, await getProposal(url.searchParams.get('id')));
      return;
    }

    if (pathname === '/api/bp/send' || pathname === '/api/bp/approve' || pathname === '/api/bp/request-approval') {
      json(res, 405, {
        status: 'blocked',
        message: 'This POC intentionally exposes no approve or send endpoint. JG must review in Better Proposals, and an authorized human must click Send Document.',
      });
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res, pathname);
      return;
    }

    json(res, 404, { status: 'error', message: 'Not found.' });
  } catch (error) {
    const statusCode = /required|valid|unsupported|missing|must|too long|exceed|limit/i.test(safeMessage(error)) ? 400 : 502;
    json(res, statusCode, {
      status: 'error',
      message: safeMessage(error),
      details: error && error.details ? error.details : undefined,
    });
  }
}

if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`Visture Better Proposals POC running at http://localhost:${PORT}`);
    console.log(`Mode: ${MODE}. Recipient email is supplied by the intake form.`);
    if (MODE !== 'live') console.log('Add BETTER_PROPOSALS_API_TOKEN to .env and set BP_MODE=live for a real connection.');
  });
}

module.exports = { requestHandler, buildMergeTags, serializeMergeTags, REQUIRED_MERGE_TAGS };
