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

const slug = (DOMAIN || `lead-${LEAD_ID}`)
  .replace(/[^a-z0-9-]/gi, '-')
  .toLowerCase()
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const clientSlug = CLIENT_ID || 'default';
const outputDir = path.join(__dirname, '..', clientSlug, slug);
const outputFile = path.join(outputDir, 'index.html');

const prompt = `Build a complete professional single-page website for a real business lead. Write ONLY the HTML file to: ${outputFile}

Business: ${COMPANY_NAME}
Industry: ${INDUSTRY}
Location: ${LOCATION || 'United States'}
Domain: ${DOMAIN || 'their business'}

DESIGN RULES:
- Dark navy hero (#0f172a) with white text and amber/gold accent (#f59e0b)
- Clean sans-serif font (system font stack)
- Mobile-responsive with CSS Grid and Flexbox
- Professional spacing: 16px base, sections use 80px padding

SECTIONS TO BUILD:
1. Nav: logo left, links center, phone number right in accent color
2. Hero: bold headline, 2-line subheadline, two CTA buttons (Call Now + Get Quote), service card floating right
3. Services: 3-column grid, icon + title + description per service
4. Why Choose Us: 4 trust signals with numbers (years experience, jobs done, response time, satisfaction rate)
5. Testimonials: 2 customer quotes with star ratings
6. CTA Banner: accent background, headline, book now button
7. Footer: contact info, services list, copyright

COPY RULES:
- Write real industry-specific copy, not placeholder text
- Phone: (555) 000-0000 as placeholder
- Include local city name in copy
- CTAs focused on urgency and local trust

Create the directory if needed. Output valid HTML only. No explanations.`;

fs.mkdirSync(outputDir, { recursive: true });

console.log(`Building demo for ${COMPANY_NAME} (${INDUSTRY}) → ${outputFile}`);

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

  if (!fs.existsSync(outputFile)) {
    console.error('Claude did not create the output file');
    process.exit(1);
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
