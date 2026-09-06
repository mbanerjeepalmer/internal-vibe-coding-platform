import { getKitchenSkillIds } from './control-plane';
import { SKILL_CATALOG } from './skills';
import { loadAppSource } from './app-source';
import type { SandboxStartOptions } from './opencode/sandbox';

/**
 * Resolves the Kitchen-derived half of a sandbox's start options — its
 * selected skills and, when a saved snapshot exists, a restore callback (see
 * SandboxStartOptions.restoreSnapshot) — so every route that can be the first
 * to provision an App's sandbox agrees on what a fresh one should contain.
 * `/models` runs before `/session` in the client's own startup sequence (see
 * OpencodeSession.init), so it — not `/session` — is usually the real
 * first-creation race winner; both, plus `/prompt` (which re-syncs guidance
 * and skills on every turn), must call this the same way.
 */
export async function resolveSandboxStartOptions(
	db: D1Database,
	app: { id: string; kitchenId: string; agentGuidance: string },
	platform: App.Platform | undefined,
	environment?: Record<string, string>
): Promise<SandboxStartOptions> {
	const skillIds = new Set(await getKitchenSkillIds(db, app.kitchenId));
	const kitchenSkills = SKILL_CATALOG.filter((s) => skillIds.has(s.id)).map((s) => ({ id: s.id, content: s.content }));
	const bucket = platform?.env.APP_SOURCE;
	return {
		kitchenGuidance: app.agentGuidance,
		kitchenSkills,
		environment,
		restoreSnapshot: bucket ? () => loadAppSource(bucket, app.id) : undefined
	};
}
