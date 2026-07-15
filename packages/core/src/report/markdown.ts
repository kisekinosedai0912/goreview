import { explainEvents } from "../explain";
import { groupByCategory } from "../group-by-category";
import {
	buildFileTree,
	type FileTreeDirectory,
	type FileTreeNode,
} from "../tree/build-tree";
import type { ChangedFile, ReviewSnapshot } from "../schemas/review";

const STATUS_MARKERS: Record<ChangedFile["status"], string> = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
};

const MAX_TREE_ROWS = 120;

function renderNode(
	node: FileTreeNode,
	prefix: string,
	isLast: boolean,
	out: string[],
): void {
	if (out.length >= MAX_TREE_ROWS) return;

	const connector = isLast ? "└─ " : "├─ ";
	const childPrefix = prefix + (isLast ? "   " : "│  ");

	if (node.kind === "directory") {
		out.push(
			`${prefix}${connector}${node.name}/  (${node.stats.files} files, +${node.stats.additions} −${node.stats.deletions})`,
		);
		node.children.forEach((child, index) =>
			renderNode(child, childPrefix, index === node.children.length - 1, out),
		);
	} else {
		const stats =
			node.additions > 0 || node.deletions > 0
				? `  +${node.additions} −${node.deletions}`
				: "";
		out.push(
			`${prefix}${connector}[${STATUS_MARKERS[node.status]}] ${node.name}${stats}`,
		);
	}
}

export function renderTreeText(root: FileTreeDirectory): string {
	const out: string[] = [];
	root.children.forEach((child, index) =>
		renderNode(child, "", index === root.children.length - 1, out),
	);
	if (out.length >= MAX_TREE_ROWS) {
		out.push(`… truncated (${root.stats.files} files total)`);
	}
	return out.join("\n");
}

function categoryTable(snapshot: ReviewSnapshot): string {
	const groups = groupByCategory(snapshot.files);
	const rows = groups.map((group) => {
		const additions = group.files.reduce(
			(sum, file) => sum + (file.additions ?? file.diff?.additions ?? 0),
			0,
		);
		const deletions = group.files.reduce(
			(sum, file) => sum + (file.deletions ?? file.diff?.deletions ?? 0),
			0,
		);
		return `| ${group.category} | ${group.files.length} | +${additions} | −${deletions} |`;
	});

	return [
		"| Category | Files | Additions | Deletions |",
		"| --- | ---: | ---: | ---: |",
		...rows,
	].join("\n");
}

function highlightsSection(snapshot: ReviewSnapshot, limit = 12): string {
	const lines: string[] = [];
	for (const file of snapshot.files) {
		if (file.events.length === 0) continue;
		for (const explanation of explainEvents(file.events)) {
			lines.push(`- \`${file.path}\` — ${explanation.text}`);
			if (lines.length >= limit) break;
		}
		if (lines.length >= limit) break;
	}
	return lines.length > 0 ? lines.join("\n") : "";
}

export type ReviewReport = {
	/** Check run title, e.g. "6 files · +48 −12 · 4 categories". */
	title: string;
	/** Markdown body shared by the check run summary and PR comment. */
	summary: string;
};

export function buildReviewReport(
	snapshot: ReviewSnapshot,
	options: { reviewUrl?: string } = {},
): ReviewReport {
	const tree = buildFileTree(snapshot.files);
	const additions = tree.stats.additions;
	const deletions = tree.stats.deletions;
	const categories = new Set(
		snapshot.files.flatMap((file) => file.categories),
	).size;

	const title = `${tree.stats.files} files · +${additions} −${deletions} · ${categories} ${categories === 1 ? "category" : "categories"}`;

	const highlights = highlightsSection(snapshot);
	const sections = [
		`### Tree comparison`,
		"```text",
		renderTreeText(tree),
		"```",
		`### By category`,
		categoryTable(snapshot),
	];

	if (highlights) {
		sections.push(`### Highlights`, highlights);
	}

	if (options.reviewUrl) {
		sections.push(
			`---`,
			`[Open the full interactive review →](${options.reviewUrl})`,
		);
	}

	return { title, summary: sections.join("\n\n") };
}

export type CheckAnnotation = {
	path: string;
	start_line: number;
	end_line: number;
	annotation_level: "notice" | "warning";
	message: string;
	title: string;
};

const MAX_ANNOTATIONS = 50;

/**
 * Locate a line for an event by searching the new content, falling back
 * to the first changed line of the file's diff.
 */
function lineForEvent(file: ChangedFile, needle: string): number | null {
	if (file.newContent) {
		const index = file.newContent
			.split("\n")
			.findIndex((line) => line.includes(needle));
		if (index >= 0) return index + 1;
	}

	for (const hunk of file.diff?.hunks ?? []) {
		for (const line of hunk.lines) {
			if (line.type === "added" && line.newNumber !== null) {
				return line.newNumber;
			}
		}
	}

	return null;
}

export function buildAnnotations(snapshot: ReviewSnapshot): CheckAnnotation[] {
	const annotations: CheckAnnotation[] = [];

	for (const file of snapshot.files) {
		if (file.status === "deleted") continue;

		for (const event of file.events) {
			if (annotations.length >= MAX_ANNOTATIONS) return annotations;

			let needle: string;
			let title: string;
			let level: CheckAnnotation["annotation_level"] = "notice";

			switch (event.kind) {
				case "signature.changed":
					needle = event.symbol;
					title = `Signature changed: ${event.symbol}`;
					level = "warning";
					break;
				case "symbol.added":
					needle = event.symbol;
					title = `${event.type} added: ${event.symbol}`;
					break;
				case "dependency.added":
					needle = `"${event.name}"`;
					title = `Dependency added: ${event.name}`;
					break;
				case "dependency.updated":
					needle = `"${event.name}"`;
					title = `Dependency updated: ${event.name}`;
					level = "warning";
					break;
				case "dependency.removed":
				case "symbol.removed":
					// Removed things have no line on the new side to anchor to.
					continue;
			}

			const line = lineForEvent(file, needle);
			if (line === null) continue;

			const [explanation] = explainEvents([event]);
			annotations.push({
				path: file.path,
				start_line: line,
				end_line: line,
				annotation_level: level,
				message: explanation?.text ?? title,
				title,
			});
		}
	}

	return annotations;
}
