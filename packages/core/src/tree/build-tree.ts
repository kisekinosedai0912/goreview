import type { ChangeCategory, ChangedFile } from "../schemas/review";

export type TreeStats = {
	files: number;
	additions: number;
	deletions: number;
	added: number;
	modified: number;
	deleted: number;
	renamed: number;
};

export type FileTreeLeaf = {
	kind: "file";
	name: string;
	path: string;
	status: ChangedFile["status"];
	oldPath?: string;
	categories: ChangeCategory[];
	additions: number;
	deletions: number;
};

export type FileTreeDirectory = {
	kind: "directory";
	name: string;
	path: string;
	children: FileTreeNode[];
	stats: TreeStats;
};

export type FileTreeNode = FileTreeLeaf | FileTreeDirectory;

/** Minimal input so the builder works on shells before hydration. */
export type FileTreeInput = Pick<
	ChangedFile,
	"path" | "status" | "oldPath" | "categories"
> & {
	additions?: number;
	deletions?: number;
	diff?: { additions: number; deletions: number } | undefined;
};

function emptyStats(): TreeStats {
	return {
		files: 0,
		additions: 0,
		deletions: 0,
		added: 0,
		modified: 0,
		deleted: 0,
		renamed: 0,
	};
}

function addToStats(stats: TreeStats, leaf: FileTreeLeaf): void {
	stats.files += 1;
	stats.additions += leaf.additions;
	stats.deletions += leaf.deletions;
	stats[leaf.status] += 1;
}

type MutableDirectory = FileTreeDirectory & { childMap: Map<string, FileTreeNode> };

function makeDirectory(name: string, path: string): MutableDirectory {
	return {
		kind: "directory",
		name,
		path,
		children: [],
		stats: emptyStats(),
		childMap: new Map(),
	};
}

function sortChildren(nodes: FileTreeNode[]): FileTreeNode[] {
	return nodes.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

/**
 * Collapse single-child directory chains (`src` > `components` becomes
 * `src/components`), the way GitHub and editors render sparse trees.
 */
function compress(node: FileTreeNode): FileTreeNode {
	if (node.kind === "file") return node;

	let current = node;
	while (
		current.children.length === 1 &&
		current.children[0]!.kind === "directory"
	) {
		const only = current.children[0] as FileTreeDirectory;
		current = {
			...only,
			name: current.name === "" ? only.name : `${current.name}/${only.name}`,
		};
	}

	return {
		...current,
		children: sortChildren(current.children.map(compress)),
	};
}

function finalize(dir: MutableDirectory): FileTreeDirectory {
	const children = sortChildren(
		[...dir.childMap.values()].map((child) =>
			child.kind === "directory" ? finalize(child as MutableDirectory) : child,
		),
	);
	return {
		kind: "directory",
		name: dir.name,
		path: dir.path,
		children,
		stats: dir.stats,
	};
}

/**
 * Build a hierarchical directory tree from the flat changed-file list.
 * Every directory carries rollup stats so viewers can render counts and
 * +/- totals per folder without walking the subtree.
 */
export function buildFileTree(files: FileTreeInput[]): FileTreeDirectory {
	const root = makeDirectory("", "");

	for (const file of files) {
		const segments = file.path.split("/");
		const name = segments[segments.length - 1] ?? file.path;

		const leaf: FileTreeLeaf = {
			kind: "file",
			name,
			path: file.path,
			status: file.status,
			oldPath: file.oldPath,
			categories: file.categories,
			additions: file.additions ?? file.diff?.additions ?? 0,
			deletions: file.deletions ?? file.diff?.deletions ?? 0,
		};

		let cursor = root;
		addToStats(cursor.stats, leaf);

		for (let i = 0; i < segments.length - 1; i += 1) {
			const segment = segments[i]!;
			const dirPath = segments.slice(0, i + 1).join("/");
			let next = cursor.childMap.get(segment);
			if (!next || next.kind !== "directory") {
				next = makeDirectory(segment, dirPath);
				cursor.childMap.set(segment, next);
			}
			cursor = next as MutableDirectory;
			addToStats(cursor.stats, leaf);
		}

		cursor.childMap.set(name, leaf);
	}

	const finalized = finalize(root);
	// Compress below the root only; the root row itself is never rendered.
	return {
		...finalized,
		children: sortChildren(finalized.children.map(compress)),
	};
}

/** Depth-first flatten, useful for keyboard navigation and virtual lists. */
export function flattenTree(
	root: FileTreeDirectory,
	isExpanded: (path: string) => boolean = () => true,
): Array<{ node: FileTreeNode; depth: number }> {
	const rows: Array<{ node: FileTreeNode; depth: number }> = [];

	function walk(dir: FileTreeDirectory, depth: number) {
		for (const child of dir.children) {
			rows.push({ node: child, depth });
			if (child.kind === "directory" && isExpanded(child.path)) {
				walk(child, depth + 1);
			}
		}
	}

	walk(root, 0);
	return rows;
}
