import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { emailToLegacyDocId, normalizeEmail, reconstructEmailFromProjectId } from './clientIdentity.ts';

describe('clientIdentity', () => {
	it('normalizes emails by trimming and lowercasing', () => {
		expect(normalizeEmail('  Hispath5@AOL.com ')).toBe('hispath5@aol.com');
	});

	it('derives the legacy id exactly as the server does', () => {
		expect(emailToLegacyDocId('john.doe@gmail.com')).toBe('john_doe_gmail_com');
		expect(emailToLegacyDocId('Lexwill@gmail.com')).toBe('Lexwill_gmail_com');
		expect(emailToLegacyDocId(normalizeEmail(' Oriens@Aiban.News '))).toBe('oriens_aiban_news');
	});

	it('reconstructs the email for the portal prefill', () => {
		expect(reconstructEmailFromProjectId('roxannefleszar_protonmail_com')).toBe('roxannefleszar@protonmail.com');
		expect(reconstructEmailFromProjectId('john_doe_gmail_com')).toBe('john.doe@gmail.com');
		expect(reconstructEmailFromProjectId('Lexwill_gmail_com')).toBe('lexwill@gmail.com');
	});

	it('returns an empty string for ids that are not email-shaped', () => {
		expect(reconstructEmailFromProjectId('')).toBe('');
		expect(reconstructEmailFromProjectId('nounderscore')).toBe('');
		expect(reconstructEmailFromProjectId('gmail_com')).toBe('');
		expect(reconstructEmailFromProjectId(undefined as unknown as string)).toBe('');
	});
});

/**
 * Guard: the email ↔ id conversion must not be written inline anywhere else.
 * If this fails, call the functions in `$lib/clientIdentity.ts` instead (add
 * one there if what you need is missing).
 */
describe('client identity conversions live only in $lib/clientIdentity.ts', () => {
	const SRC = join(process.cwd(), 'src');
	const ALLOWED = new Set(['lib/clientIdentity.ts', 'lib/clientIdentity.test.ts']);
	const BANNED: Array<{ name: string; re: RegExp }> = [
		{ name: 'email → id slug regex', re: /\[@\\?\.\]|\[\\?\.@\]/ },
		{ name: 'id → email reconstruction', re: /replace\(\s*\/_\/g\s*,\s*['"]\.['"]\s*\)/ },
	];

	function* sourceFiles(dir: string): Generator<string> {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) yield* sourceFiles(full);
			else if (/\.(ts|js|svelte)$/.test(entry.name)) yield full;
		}
	}

	it('has no inline conversions', () => {
		const violations: string[] = [];
		for (const file of sourceFiles(SRC)) {
			const rel = relative(SRC, file).split('\\').join('/');
			if (ALLOWED.has(rel)) continue;
			readFileSync(file, 'utf8')
				.split('\n')
				.forEach((line, i) => {
					for (const { name, re } of BANNED) {
						if (re.test(line)) violations.push(`src/${rel}:${i + 1} (${name})`);
					}
				});
		}
		expect(violations).toEqual([]);
	});
});
