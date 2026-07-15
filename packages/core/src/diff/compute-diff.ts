import { diffWordsWithSpace, structuredPatch } from "diff";
import type {
	ChangedFile,
	DiffHunk,
	DiffLine,
	DiffSegment,
	FileDiff,
	ReviewSnapshot,
} from "../schemas/review";

export type ComputeDiffOptions = {
	/** Context lines around each hunk. Defaults to 3. */
	context?: number;
};

/** Lines longer than this skip intra-line highlighting (too slow, too noisy). */
const MAX_INTRALINE_LENGTH = 1_000;

/**
 * If more than this fraction of a paired line changed, drop the segment
 * highlights: a fully-rewritten line reads better as plain removed/added.
 */
const MAX_CHANGED_RATIO = 0.65;

function countLines(content: string | null): number {
	if (content === null || content.length === 0) return 0;
	let count = 1;
	for (let i = 0; i < content.length; i += 1) {
		if (content[i] === "\n") count += 1;
	}
	// A trailing newline does not start another line.
	if (content.endsWith("\n")) count -= 1;
	return count;
}

function toSegments(
	oldLine: string,
	newLine: string,
): { old: DiffSegment[]; new: DiffSegment[] } | null {
	if (
		oldLine.length > MAX_INTRALINE_LENGTH ||
		newLine.length > MAX_INTRALINE_LENGTH
	) {
		return null;
	}

	const parts = diffWordsWithSpace(oldLine, newLine);
	const oldSegments: DiffSegment[] = [];
	const newSegments: DiffSegment[] = [];
	let changedOld = 0;
	let changedNew = 0;

	for (const part of parts) {
		if (part.added) {
			newSegments.push({ value: part.value, changed: true });
			changedNew += part.value.length;
		} else if (part.removed) {
			oldSegments.push({ value: part.value, changed: true });
			changedOld += part.value.length;
		} else {
			oldSegments.push({ value: part.value, changed: false });
			newSegments.push({ value: part.value, changed: false });
		}
	}

	const oldRatio = oldLine.length === 0 ? 0 : changedOld / oldLine.length;
	const newRatio = newLine.length === 0 ? 0 : changedNew / newLine.length;
	if (oldRatio > MAX_CHANGED_RATIO && newRatio > MAX_CHANGED_RATIO) {
		return null;
	}

	return { old: oldSegments, new: newSegments };
}

/**
 * Pair consecutive removed/added runs index-wise and attach word-level
 * segments so viewers can emphasize what actually changed inside a line.
 */
function attachIntraLineSegments(lines: DiffLine[]): void {
	let i = 0;
	while (i < lines.length) {
		if (lines[i]!.type !== "removed") {
			i += 1;
			continue;
		}

		let j = i;
		while (j < lines.length && lines[j]!.type === "removed") j += 1;
		let k = j;
		while (k < lines.length && lines[k]!.type === "added") k += 1;

		const pairs = Math.min(j - i, k - j);
		for (let p = 0; p < pairs; p += 1) {
			const removed = lines[i + p]!;
			const added = lines[j + p]!;
			const segments = toSegments(removed.content, added.content);
			if (segments) {
				removed.segments = segments.old;
				added.segments = segments.new;
			}
		}

		i = k;
	}
}

/**
 * Compute line-level hunks between two file versions using Myers diff.
 * `null` content means the file side does not exist (added/deleted files).
 */
export function computeFileDiff(
	oldContent: string | null,
	newContent: string | null,
	options: ComputeDiffOptions = {},
): FileDiff {
	const context = options.context ?? 3;
	const oldText = oldContent ?? "";
	const newText = newContent ?? "";

	const patch = structuredPatch("a", "b", oldText, newText, undefined, undefined, {
		context,
	});

	let additions = 0;
	let deletions = 0;

	const hunks: DiffHunk[] = patch.hunks.map((hunk) => {
		let oldNumber = hunk.oldStart;
		let newNumber = hunk.newStart;
		const lines: DiffLine[] = [];

		for (const raw of hunk.lines) {
			const marker = raw[0];
			const content = raw.slice(1);

			if (marker === "\\") {
				// "\ No newline at end of file" markers are noise for review.
				continue;
			}

			if (marker === "+") {
				additions += 1;
				lines.push({
					type: "added",
					oldNumber: null,
					newNumber: newNumber++,
					content,
				});
			} else if (marker === "-") {
				deletions += 1;
				lines.push({
					type: "removed",
					oldNumber: oldNumber++,
					newNumber: null,
					content,
				});
			} else {
				lines.push({
					type: "context",
					oldNumber: oldNumber++,
					newNumber: newNumber++,
					content,
				});
			}
		}

		attachIntraLineSegments(lines);

		return {
			oldStart: hunk.oldStart,
			oldLines: hunk.oldLines,
			newStart: hunk.newStart,
			newLines: hunk.newLines,
			lines,
		};
	});

	return {
		hunks,
		additions,
		deletions,
		oldLineCount: countLines(oldContent),
		newLineCount: countLines(newContent),
	};
}

/** Fill in `diff` for every hydrated file that does not have one yet. */
export function withComputedDiffs(snapshot: ReviewSnapshot): ReviewSnapshot {
	const files: ChangedFile[] = snapshot.files.map((file) => {
		if (file.diff) return file;
		if (file.oldContent === null && file.newContent === null) return file;
		const diff = computeFileDiff(file.oldContent, file.newContent);
		return {
			...file,
			diff,
			additions: file.additions ?? diff.additions,
			deletions: file.deletions ?? diff.deletions,
		};
	});
	return { ...snapshot, files };
}
