export interface FileEntry {
	name: string;
	/** Path relative to the project root, forward-slash separated, no leading slash. */
	path: string;
	isDir: boolean;
	size: number;
}

/**
 * Drives an App's file tree viewer/uploader — one instance per open App page.
 * Directories load lazily, one level per expand, rather than walking the
 * whole project tree up front (a real project can grow a `node_modules`).
 * `selected` is the directory new uploads land in; clicking a directory in
 * the tree both expands it and selects it as the upload target.
 */
export class FileTree {
	children = $state<Record<string, FileEntry[]>>({});
	expanded = $state<Set<string>>(new Set());
	loading = $state<Set<string>>(new Set());
	selected = $state('');
	error = $state<string | null>(null);
	uploading = $state(false);

	constructor(private projectId: string) {}

	async init() {
		await this.load('');
	}

	isExpanded(path: string) {
		return this.expanded.has(path);
	}

	isLoading(path: string) {
		return this.loading.has(path);
	}

	select(path: string) {
		this.selected = path;
	}

	async toggle(path: string) {
		if (this.expanded.has(path)) {
			const next = new Set(this.expanded);
			next.delete(path);
			this.expanded = next;
			return;
		}
		this.expanded = new Set(this.expanded).add(path);
		if (!this.children[path]) await this.load(path);
	}

	async refresh(path: string = this.selected) {
		await this.load(path);
	}

	async upload(files: FileList | File[]) {
		const list = Array.from(files);
		if (!list.length) return;
		this.uploading = true;
		this.error = null;
		try {
			const body = new FormData();
			body.set('path', this.selected);
			for (const file of list) body.append('file', file);
			const res = await fetch(`/api/kitchen/${this.projectId}/files`, { method: 'POST', body });
			if (!res.ok) throw new Error(await res.text());
			await this.load(this.selected);
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.uploading = false;
		}
	}

	private async load(path: string) {
		this.loading = new Set(this.loading).add(path);
		this.error = null;
		try {
			const res = await fetch(`/api/kitchen/${this.projectId}/files?path=${encodeURIComponent(path)}`);
			if (!res.ok) throw new Error(await res.text());
			const { entries } = (await res.json()) as { entries: FileEntry[] };
			this.children = { ...this.children, [path]: entries };
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			const next = new Set(this.loading);
			next.delete(path);
			this.loading = next;
		}
	}
}
