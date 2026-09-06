// A curated catalog of optional skills a Kitchen's Head Chef can turn on for
// every App in that Kitchen. Selection lives in the `kitchen_skills` table
// (skill ids only); the catalog itself — the actual SKILL.md content
// materialised into each App's sandbox — lives here in code, per AGENTS.md's
// wrapper step 5 ("Kitchen defaults ... materialised into the sandbox as
// agent instructions/skill files"). Adding a new skill is just adding an
// entry below; no migration needed.

export interface SkillDefinition {
	id: string;
	/** Shown to the Head Chef in the Kitchen settings UI. */
	name: string;
	/** One-line explanation shown next to the checkbox. */
	summary: string;
	/** The SKILL.md body materialised at `.opencode/skills/kitchen-<id>/SKILL.md`. */
	content: string;
}

function skill(id: string, name: string, summary: string, description: string, body: string): SkillDefinition {
	return {
		id,
		name,
		summary,
		content: `---
name: kitchen-${id}
description: ${description}
---

${body.trim()}
`
	};
}

export const SKILL_CATALOG: SkillDefinition[] = [
	skill(
		'plain-english',
		'Plain-English explanations',
		'Avoid jargon; explain plans and changes in non-technical language.',
		'Apply to every response. Use when the user is non-technical.',
		`# Plain-English explanations

Assume the user is not a programmer. Before making a change, briefly say what
you're about to do in everyday language, not technical jargon. After a
change, summarise what changed and why in a sentence or two — skip
implementation detail unless asked. Never use terms like "refactor",
"endpoint", or "deploy pipeline" without a plain explanation alongside them.`
	),
	skill(
		'accessibility-first',
		'Accessibility-first UI',
		'Build interfaces usable with a keyboard and screen reader by default.',
		'Load before writing or editing HTML, CSS, or UI components.',
		`# Accessibility-first UI

Every interactive element must be reachable and operable by keyboard alone.
Use semantic HTML elements (\`button\`, \`nav\`, \`label\`, headings in order)
rather than generic \`div\`/\`span\` with click handlers. Give every image
meaningful \`alt\` text (or \`alt=""\` if purely decorative), every form input a
visible \`label\`, and maintain a colour contrast ratio of at least 4.5:1 for
body text. Test that focus order matches visual order.`
	),
	skill(
		'mobile-first',
		'Mobile-first design',
		'Design layouts for small screens first, then scale up.',
		'Load before writing or editing HTML, CSS, or UI components.',
		`# Mobile-first design

Design and build for a narrow phone-width viewport first, then add
responsive rules for larger screens — never the reverse. Avoid fixed pixel
widths on containers; prefer relative units and flex/grid layouts. Touch
targets (buttons, links) should be at least 44x44 pixels. Test at 375px
width before considering a layout done.`
	),
	skill(
		'security-conscious',
		'Security-conscious by default',
		'Validate input, avoid injection, never log or expose secrets.',
		'Load before writing code that handles user input, secrets, or a database.',
		`# Security-conscious by default

Treat all user input as untrusted: validate and sanitise it, and use
parameterised queries for any database access — never build SQL by string
concatenation. Never print, log, or echo back an environment variable that
looks like a secret or credential. Escape any user-supplied content that gets
rendered as HTML to prevent XSS. Prefer the platform's own secret-management
tools over hardcoding a credential in source.`
	),
	skill(
		'thorough-testing',
		'Thorough testing before done',
		'Verify a change actually works before declaring it finished.',
		'Load before telling the user a change is complete or ready to deploy.',
		`# Thorough testing before done

Before telling the user something is finished, verify it actually works:
re-read the file you changed to confirm the edit landed correctly, and where
practical, run the app or a quick script to exercise the change rather than
assuming it works from reading the code. Call out anything you could not
verify (e.g. a feature that needs a live browser) rather than claiming it
was tested.`
	)
];

export function getSkill(id: string): SkillDefinition | undefined {
	return SKILL_CATALOG.find((s) => s.id === id);
}
