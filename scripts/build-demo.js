#!/usr/bin/env node
// build-demo.js — personalizes a pre-built industry template for a lead
// Called by GitHub Actions with lead data as env vars

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  LEAD_ID,
  CLIENT_ID,
  COMPANY_NAME,
  DOMAIN,
  INDUSTRY,
  LOCATION,
  N8N_CALLBACK_URL,
  ANTHROPIC_API_KEY,
} = process.env;

if (!LEAD_ID || !COMPANY_NAME || !INDUSTRY) {
  console.error('Missing required env vars: LEAD_ID, COMPANY_NAME, INDUSTRY');
  process.exit(1);
}

const slug = (DOMAIN || `lead-${LEAD_ID}`)
  .replace(/[^a-z0-9-]/gi, '-')
  .toLowerCase()
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const clientSlug = CLIENT_ID || 'default';
const outputDir = path.join(__dirname, '..', clientSlug, slug);
const outputFile = path.join(outputDir, 'index.html');

// ── Map industry → template ──────────────────────────────────────────────────
const INDUSTRY_TEMPLATE_MAP = {
  // Plumbing
  plumbing: 'plumbing', plumber: 'plumbing', 'plumbing company': 'plumbing',
  // HVAC
  hvac: 'hvac', heating: 'hvac', cooling: 'hvac', 'air conditioning': 'hvac',
  'heating and cooling': 'hvac', 'heating & cooling': 'hvac', 'ac repair': 'hvac',
  // Electrician
  electrician: 'electrician', electrical: 'electrician', 'electrical contractor': 'electrician',
  'electric company': 'electrician',
  // Dentist
  dentist: 'dentist', dental: 'dentist', 'dental office': 'dentist',
  'dental clinic': 'dentist', orthodontist: 'dentist',
  // Roofing
  roofing: 'roofing', roofer: 'roofing', 'roofing company': 'roofing',
  'roof repair': 'roofing', 'roof replacement': 'roofing',
  // Landscaping
  landscaping: 'landscaping', landscaper: 'landscaping', 'lawn care': 'landscaping',
  'lawn service': 'landscaping', 'tree service': 'landscaping',
  // Restaurant / Food
  restaurant: 'restaurant', 'food service': 'restaurant', cafe: 'restaurant',
  diner: 'restaurant', 'bar and grill': 'restaurant', pizzeria: 'restaurant',
  // Auto Repair
  'auto repair': 'auto-repair', 'auto mechanic': 'auto-repair', mechanic: 'auto-repair',
  'car repair': 'auto-repair', 'auto service': 'auto-repair',
  // Ecommerce
  ecommerce: 'ecommerce', 'e-commerce': 'ecommerce', 'online store': 'ecommerce',
  'product business': 'ecommerce', retail: 'ecommerce',
  // General Contractor
  contractor: 'contractor', 'general contractor': 'contractor',
  construction: 'contractor', remodeling: 'contractor', renovation: 'contractor',
};

const industryKey = INDUSTRY.toLowerCase().trim();
const templateName = INDUSTRY_TEMPLATE_MAP[industryKey] || 'plumbing'; // default to plumbing
const templatePath = path.join(__dirname, '..', 'templates', templateName, 'index.html');

let templateHTML;
try {
  templateHTML = fs.readFileSync(templatePath, 'utf8');
  console.log(`Using template: ${templateName}`);
} catch (e) {
  console.log(`Template '${templateName}' not found, using plumbing template`);
  templateHTML = fs.readFileSync(path.join(__dirname, '..', 'templates', 'plumbing', 'index.html'), 'utf8');
}

fs.mkdirSync(outputDir, { recursive: true });
console.log(`Building demo for ${COMPANY_NAME} (${INDUSTRY}) → ${outputFile}`);

// ── Ask Claude to fill in the template variables ─────────────────────────────
const city = (LOCATION || 'United States').split(',')[0].trim();
const domain = DOMAIN || 'theirbusiness.com';

const prompt = `You are personalizing a website demo template for a real local business lead.

BUSINESS DETAILS:
- Company: ${COMPANY_NAME}
- Industry: ${INDUSTRY}
- City: ${city}
- Domain: ${domain}

TEMPLATE VARIABLES TO REPLACE (replace ALL occurrences):
- {{COMPANY_NAME}} → "${COMPANY_NAME}"
- {{CITY}} → "${city}"
- {{DOMAIN}} → "${domain}"
- {{YEAR_FOUNDED}} → a realistic founding year (pick something between 1995-2015, make it feel authentic)
- {{YEARS_EXP}} → calculate from founding year to 2025
- {{JOBS_DONE}} → a realistic number (1,200 to 5,000 range, pick based on years in business)

OUTPUT: Write the complete personalized HTML to this exact file path: ${outputFile}

The file already contains a professional template. Your ONLY job is to:
1. Replace all {{VARIABLE}} placeholders with real values
2. Optionally tweak any copy that references the wrong city or industry
3. Write the final file

Do NOT redesign or rewrite the page. Do NOT add explanations. Just replace variables and write the file.

TEMPLATE HTML:
${templateHTML}`;

try {
  const result = spawnSync('claude', ['--print', '--dangerously-skip-permissions', prompt], {
    env: { ...process.env, ANTHROPIC_API_KEY },
    stdio: 'inherit',
    timeout: 300000,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `claude exited with status ${result.status}`);
  }

  // If Claude didn't write the file (e.g. just printed HTML), do a simple variable swap
  if (!fs.existsSync(outputFile)) {
    console.log('Claude did not write the file — falling back to direct variable substitution');
    const yearFounded = 2008;
    const yearsExp = 2025 - yearFounded;
    const jobsDone = Math.floor(yearsExp * 180);
    let html = templateHTML
      .replace(/\{\{COMPANY_NAME\}\}/g, COMPANY_NAME)
      .replace(/\{\{CITY\}\}/g, city)
      .replace(/\{\{DOMAIN\}\}/g, domain)
      .replace(/\{\{YEAR_FOUNDED\}\}/g, yearFounded)
      .replace(/\{\{YEARS_EXP\}\}/g, yearsExp)
      .replace(/\{\{JOBS_DONE\}\}/g, jobsDone.toLocaleString());
    fs.writeFileSync(outputFile, html, 'utf8');
    console.log('Fallback variable substitution applied successfully');
  }

  const deployUrl = `https://iamleoddsantos-ux.github.io/Lead-Demos/${clientSlug}/${slug}/`;
  console.log(`Deploy URL: ${deployUrl}`);

  fs.writeFileSync(
    path.join(__dirname, '..', 'deploy-result.json'),
    JSON.stringify({ deployUrl, leadId: LEAD_ID, clientId: CLIENT_ID, slug })
  );

  console.log('Demo built successfully');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
