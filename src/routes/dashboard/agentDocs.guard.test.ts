/**
 * Agent docs guard — keeps docs/agents/crm (the visual guide AI agents use to
 * drive the CRM in a browser) in step with the dashboard.
 *
 * Fails when:
 *   1. a dashboard view (access.ts ALL_VIEWS) has no top-bar button, or its
 *      button label is not named in the guide
 *   2. a visible default stage (store.ts STAGE_LABELS minus HIDDEN_STAGES) is
 *      missing from the stage reference (09-etapas.md)
 *   3. the README index links to a file that does not exist, or a guide file
 *      is missing from the index
 *
 * Fix: describe the new view or stage in docs/agents/crm, as seen in the browser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_VIEWS } from './access';
import { STAGE_LABELS, HIDDEN_STAGES } from './store';

const DOCS_DIR = join(process.cwd(), 'docs/agents/crm');
const PAGE = readFileSync(join(process.cwd(), 'src/routes/dashboard/+page.svelte'), 'utf8');

const guideFiles = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
const guideText = guideFiles.map((f) => readFileSync(join(DOCS_DIR, f), 'utf8')).join('\n');
const stagesDoc = readFileSync(join(DOCS_DIR, '09-etapas.md'), 'utf8');
const readme = readFileSync(join(DOCS_DIR, 'README.md'), 'utf8');

/** The visible label of the top-bar button that opens `view`. */
function topBarLabel(view: string): string | null {
  const button = new RegExp(`switchView\\('${view}'\\)}[^>]*>([^<]+)</button>`);
  return PAGE.match(button)?.[1].trim() ?? null;
}

describe('agent docs cover every dashboard view', () => {
  it.each(ALL_VIEWS)('%s', (view) => {
    const label = topBarLabel(view);
    expect(label, `no top-bar button found for view "${view}"`).not.toBeNull();
    expect(guideText, `docs/agents/crm never names the "${label}" view`).toContain(`\`${label}\``);
  });
});

describe('agent docs cover every visible default stage', () => {
  const visible = Object.entries(STAGE_LABELS).filter(([id]) => !HIDDEN_STAGES.has(id));
  it.each(visible)('%s', (_id, label) => {
    expect(stagesDoc, `09-etapas.md is missing the stage "${label}"`).toContain(`\`${label}\``);
  });
});

describe('agent docs index', () => {
  const linked = [...readme.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);

  it.each(linked)('links to an existing file: %s', (file) => {
    expect(existsSync(join(DOCS_DIR, file))).toBe(true);
  });

  it.each(guideFiles.filter((f) => f !== 'README.md'))('lists %s', (file) => {
    expect(linked).toContain(file);
  });
});
