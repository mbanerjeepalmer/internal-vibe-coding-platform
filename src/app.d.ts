/// <reference path="../worker-configuration.d.ts" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Wrangler only includes declared bindings in generated types. These are
	// deployment secrets, so they remain explicitly typed here rather than
	// being committed to wrangler.jsonc.
	interface Env {
		BETTER_AUTH_SECRET: string;
		BETTER_AUTH_URL?: string;
		RESEND_API_KEY: string;
		RESEND_FROM_EMAIL: string;
		DAYTONA_API_KEY: string;
		CLOUDFLARE_API_TOKEN: string;
		CLOUDFLARE_ACCOUNT_ID: string;
	}

	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image?: string | null;
				createdAt: Date;
				updatedAt: Date;
			} | null;
			session: {
				id: string;
				userId: string;
				expiresAt: Date;
				createdAt: Date;
				updatedAt: Date;
				token: string;
				ipAddress?: string | null;
				userAgent?: string | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}
	}
}

export {};
