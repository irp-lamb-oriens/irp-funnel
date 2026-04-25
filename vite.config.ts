import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';

// ─── Evo project-version injection ────────────────────────────────────────
// Exposes the current commit hash and message as build-time constants so
// every exposure/interaction event logged from the funnel is stamped with
// the exact project version it was shipped under. Safe fallbacks ensure the
// build never fails if git isn't available (e.g. stripped CI containers).
function readGit(command: string, fallback: string): string {
	try {
		return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return fallback;
	}
}

const EVO_COMMIT = process.env.EVO_COMMIT || readGit('git rev-parse --short HEAD', 'unknown');
const EVO_COMMIT_MSG = process.env.EVO_COMMIT_MSG || readGit('git log -1 --pretty=%s', '');

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__EVO_COMMIT__: JSON.stringify(EVO_COMMIT),
		__EVO_COMMIT_MSG__: JSON.stringify(EVO_COMMIT_MSG)
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./vitest-setup.ts']
	}
});
