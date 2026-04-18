#!/usr/bin/env node
// build-demo.js — runs Claude Code headlessly to build a demo site
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

// Build the slug for the folder name
const slug = (DOMAIN || `lead-${LEAD_ID}`)
  .replace(/[^a-z0-9-]/gi, '-')
  .toLowerCase()
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const clientSlug = CLIENT_ID || 'default';
const outputDir = path.join(__dirname, '..', clientSlug, slug);
const outputFile = path.join(outputDir, 'index.html');

// Read skill files
const uiUxSkill = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'ui-ux-pro-max.md'),
  'utf8'
);
const frontendSkill = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'frontend-design.md'),
  'utf8'
);

// Build the Claude prompt
const prompt = `
You are building a professional demo website for a real business lead.

## YOUR SKILLS (apply these fully):

### UI/UX PRO MAX SKILL:
${uiUxSkill}

### FRONTEND DESIGN SKILL:
${frontendSkill}

## TASK:
Build a complete, professional single-page demo website for:
- Business: ${COMPANY_NAME}
- Industry: ${INDUSTRY}
- Location: ${LOCATION || 'United States'}
- Domain: ${DOMAIN || 'their business'}

## REQUIREMENTS:
1. Apply the UI/UX Pro Max skill fully — use proper design system, spacing, typography
2. Apply Frontend Design skill — proper layout, component patterns, visual hierarchy
3. Write compelling, industry-specific copy (not generic placeholder text)
4. Mobile-responsive design
5. Include: hero section, services/about section, trust signals, clear CTA with phone/contact

## OUTPUT:
Write ONLY the complete HTML file content to: ${outputFile}
Create the directory if needed. The file must be valid HTML that renders correctly in a browser.
Do not explain — just build and write the file.
`;

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

console.log(`Building demo for ${COMPANY_NAME} (${INDUSTRY}) → ${outputFile}`);

try {
  // Run Claude Code CLI headlessly (spawnSync bypasses shell — no escaping issues)
  const result = spawnSync('claude', ['--print', prompt], {
    env: { ...process.env, ANTHROPIC_API_KEY },
    stdio: 'inherit',
    timeout: 300000, // 5 min max
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `claude exited with status ${result.status}`);
  }

  // Verify file was created
  if (!fs.existsSync(outputFile)) {
    console.error('Claude did not create the output file');
    process.exit(1);
  }

  const deployUrl = `https://iamleoddsantos-ux.github.io/Lead-Demos/${clientSlug}/${slug}/`;
  console.log(`Deploy URL: ${deployUrl}`);

  // Write deploy info for GitHub Actions to read
  fs.writeFileSync(
    path.join(__dirname, '..', 'deploy-result.json'),
    JSON.stringify({ deployUrl, leadId: LEAD_ID, clientId: CLIENT_ID, slug })
  );

  console.log('Demo built successfully');
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
