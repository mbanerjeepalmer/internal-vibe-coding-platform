import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	assertSingleSafeStatement,
	grantExecutiveChef,
	listAdminActions,
	listExecutiveChefs,
	logAdminAction,
	requireExecutiveChef,
	revokeExecutiveChef
} from '$lib/server/executive';
import { getSandboxProvider } from '$lib/server/opencode/sandbox';

const RESULT_TRUNCATE = 4000;

function truncate(text: string): string {
	return text.length > RESULT_TRUNCATE ? `${text.slice(0, RESULT_TRUNCATE)}\n… (truncated)` : text;
}

export const load: PageServerLoad = async (event) => {
	const { db } = await requireExecutiveChef(event);
	const [admins, actions] = await Promise.all([listExecutiveChefs(db), listAdminActions(db)]);
	return { admins, actions, currentUserId: event.locals.user!.id };
};

function requireCommentOrForce(comment: string, force: boolean) {
	if (!comment.trim() && !force) {
		return fail(400, { message: 'A comment is required — or check "force" to skip it.' });
	}
	return null;
}

export const actions: Actions = {
	runSql: async (event) => {
		const { db, userId } = await requireExecutiveChef(event);
		const form = await event.request.formData();
		const sqlInput = String(form.get('sql') ?? '');
		const comment = String(form.get('comment') ?? '');
		const force = form.get('force') === 'on';

		const commentFailure = requireCommentOrForce(comment, force);
		if (commentFailure) return commentFailure;

		let status: 'ok' | 'error' = 'ok';
		let resultText: string;
		try {
			const sql = assertSingleSafeStatement(sqlInput);
			const isSelect = /^select\b/i.test(sql);
			if (isSelect) {
				const result = await db.prepare(sql).all();
				resultText = JSON.stringify(result.results, null, 2);
			} else {
				const result = await db.prepare(sql).run();
				resultText = `${result.meta.changes ?? 0} row(s) affected.`;
			}
		} catch (err) {
			status = 'error';
			resultText = err instanceof Error ? err.message : String(err);
		}

		await logAdminAction(db, {
			actorId: userId,
			kind: 'sql',
			command: sqlInput,
			comment: comment.trim() || null,
			forced: force,
			status,
			result: truncate(resultText)
		});

		if (status === 'error') return fail(400, { message: resultText });
		return { success: true, sqlResult: resultText };
	},

	runBash: async (event) => {
		const { db, userId } = await requireExecutiveChef(event);
		const form = await event.request.formData();
		const appId = String(form.get('appId') ?? '').trim();
		const command = String(form.get('command') ?? '');
		const comment = String(form.get('comment') ?? '');
		const force = form.get('force') === 'on';

		if (!appId) return fail(400, { message: 'Enter an App ID.' });
		const commentFailure = requireCommentOrForce(comment, force);
		if (commentFailure) return commentFailure;

		let status: 'ok' | 'error' = 'ok';
		let resultText: string;
		try {
			if (!command.trim()) throw new Error('Enter a command.');
			const { exitCode, output } = await getSandboxProvider().executeShellCommand(appId, command);
			resultText = `exit ${exitCode}\n${output}`;
			if (exitCode !== 0) status = 'error';
		} catch (err) {
			status = 'error';
			resultText = err instanceof Error ? err.message : String(err);
		}

		await logAdminAction(db, {
			actorId: userId,
			appId,
			kind: 'bash',
			command,
			comment: comment.trim() || null,
			forced: force,
			status,
			result: truncate(resultText)
		});

		if (status === 'error') return fail(400, { message: resultText });
		return { success: true, bashResult: resultText };
	},

	grant: async (event) => {
		const { db, userId } = await requireExecutiveChef(event);
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!email) return fail(400, { message: 'Enter an email address.' });
		try {
			await grantExecutiveChef(db, userId, email);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : String(err) });
		}
		return { success: true };
	},

	revoke: async (event) => {
		const { db, userId } = await requireExecutiveChef(event);
		const form = await event.request.formData();
		const targetUserId = String(form.get('userId') ?? '');
		try {
			await revokeExecutiveChef(db, userId, targetUserId);
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : String(err) });
		}
		return { success: true };
	}
};
