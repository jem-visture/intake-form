'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cad(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function materialTableHtml(items) {
  const rows = items.map((item) =>
    `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(`${item.quantity} ${item.unit}`)}</td><td>${escapeHtml(cad(item.unitPrice))}</td><td>${escapeHtml(cad(item.quantity * item.unitPrice))}</td></tr>`
  ).join('');
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  return `<table width="100%" cellpadding="10" cellspacing="0" rules="rows"><tr bgcolor="#e6e3de"><th align="left">Item</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr>${rows}<tr><th colspan="3" align="right">Subtotal</th><th>${escapeHtml(cad(subtotal))}</th></tr></table>`;
}

async function main() {
  loadDotEnv(path.join(ROOT, '.env'));
  const items = [
    { name: 'Kitchen cabinetry', quantity: 1, unit: 'lump sum', unitPrice: 58000 },
    { name: 'Quartz countertops', quantity: 52, unit: 'sq ft', unitPrice: 165 },
    { name: 'Hardwood flooring', quantity: 1270, unit: 'sq ft', unitPrice: 14.5 },
    { name: 'Bathroom tile, fixtures and glass', quantity: 1, unit: 'allowance', unitPrice: 23040 },
    { name: 'Lighting and finishing materials', quantity: 1, unit: 'allowance', unitPrice: 15350 },
    { name: 'Rough-in and site materials', quantity: 1, unit: 'lump sum', unitPrice: 16300 },
    { name: 'Selection allowance', quantity: 1, unit: 'allowance', unitPrice: 12815 },
  ];
  const materialHtml = materialTableHtml(items);
  const mergeTags = [{ tag: 'material_pricing', value: materialHtml }];
  const mergeTagsJson = JSON.stringify(mergeTags);
  if (mergeTagsJson.length > 1000) throw new Error(`MergeTags exceeds Better Proposals' 1,000-character parameter limit (${mergeTagsJson.length}).`);
  if (process.argv.includes('--check-payload')) {
    console.log(`MergeTags parameter length: ${mergeTagsJson.length}/1000 characters`);
    return;
  }
  if (!process.argv.includes('--confirm-live-draft')) throw new Error('Refusing to create a record without --confirm-live-draft.');
  const token = String(process.env.BETTER_PROPOSALS_API_TOKEN || '').trim();
  if (!token) throw new Error('BETTER_PROPOSALS_API_TOKEN is missing.');

  const form = new URLSearchParams();
  form.set('Company', 'Visture POC Internal Test');
  form.set('Template', '744153');
  form.set('DocumentType', '1');
  form.set('Brand', '316756');
  form.set('Currency', 'cad');
  form.set('Tax', '1');
  form.set('TaxLabel', 'GST');
  form.set('TaxAmount', '5');
  form.set('Contacts[0][FirstName]', 'Jem');
  form.set('Contacts[0][Surname]', 'Test');
  form.set('Contacts[0][Email]', 'jem@visture.ca');
  form.set('Contacts[0][Signature]', '1');
  form.set('MergeTags', mergeTagsJson);

  const base = String(process.env.BP_API_BASE || 'https://api.betterproposals.io').replace(/\/+$/, '');
  const response = await fetch(`${base}/proposal/create/`, {
    method: 'POST',
    headers: { Bptoken: token, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') throw new Error(`Better Proposals create failed (HTTP ${response.status}): ${result.message || 'unknown error'}`);
  const data = result.data || {};

  const statusResponse = await fetch(`${base}/proposal/${encodeURIComponent(data.ID)}/`, {
    headers: { Bptoken: token, Accept: 'application/json' },
  });
  const statusResult = await statusResponse.json();
  const statusData = statusResult.data || {};
  console.log(JSON.stringify({
    proposalId: data.ID,
    templateId: data.TemplateID,
    preview: data.Preview,
    reviewView: data.ProposalView,
    dateSent: statusData.DateSent,
    approvedDate: statusData.ApprovedDate,
    signed: statusData.Signed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
