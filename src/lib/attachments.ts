// Shared (client + server) logic for gating file attachments by a model's
// actual input capabilities. opencode's `/api/model` (v2) reports each
// model's `capabilities.input` as an array of media types it accepts —
// verified live against a real `opencode serve` (opencode-ai@1.18.25):
// `capabilities: { tools: boolean, input: string[], output: string[] }`,
// with `input` containing some subset of "text"/"image"/"audio"/"video"/"pdf"
// (a plain-text-only model reports just `["text"]`). See
// docs/01_hardcoded_demo.md's attachment findings for why this exists:
// attachments are forwarded to the model as-is, so a model that doesn't
// declare a media type as input will fail (or, per that doc, opencode zen's
// free models may fail regardless of what they advertise).

export interface ModelCapabilities {
	tools: boolean;
	input: string[];
	output: string[];
}

export type AttachmentCategory = 'image' | 'video' | 'audio' | 'pdf';

const ATTACHMENT_CATEGORIES: AttachmentCategory[] = ['image', 'video', 'audio', 'pdf'];

export function attachmentCategory(mime: string): AttachmentCategory | null {
	if (mime === 'application/pdf') return 'pdf';
	const [type] = mime.split('/');
	if (type === 'image' || type === 'video' || type === 'audio') return type;
	return null;
}

function supportedCategories(capabilities: ModelCapabilities | null | undefined): AttachmentCategory[] {
	if (!capabilities) return [];
	return ATTACHMENT_CATEGORIES.filter((c) => capabilities.input.includes(c));
}

/** Whether the model accepts *any* attachment at all — used to enable/disable the attach control. */
export function supportsAnyAttachment(capabilities: ModelCapabilities | null | undefined): boolean {
	return supportedCategories(capabilities).length > 0;
}

/** Whether a specific file's mime type is safe to send to this model. */
export function supportsAttachment(mime: string, capabilities: ModelCapabilities | null | undefined): boolean {
	const category = attachmentCategory(mime);
	if (!category) return false;
	return supportedCategories(capabilities).includes(category);
}

/** Builds an `<input type="file" accept="...">` value from a model's supported input types. */
export function acceptAttribute(capabilities: ModelCapabilities | null | undefined): string {
	return supportedCategories(capabilities)
		.map((c) => (c === 'pdf' ? '.pdf' : `${c}/*`))
		.join(',');
}

/** Human-readable list for the attach button's label, e.g. "image/video". */
export function supportedCategoryLabel(capabilities: ModelCapabilities | null | undefined): string {
	return supportedCategories(capabilities).join('/');
}
