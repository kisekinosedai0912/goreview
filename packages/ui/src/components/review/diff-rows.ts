import type { ChangedFile, DiffHunk, DiffLine } from "@goreview/core";
import type { ViewMode } from "../DiffViewer";

export type DiffRow =
	| {
			type: "hunk";
			key: string;
			hunkIndex: number;
			collapsed: boolean;
			header: string;
			hiddenLines: number;
	  }
	| { type: "gap"; key: string; gapIndex: number; count: number }
	| { type: "line"; key: string; line: DiffLine; commentable: boolean }
	| {
			type: "pair";
			key: string;
			left: DiffLine | null;
			right: DiffLine | null;
			commentable: boolean;
	  };

function hunkHeader(hunk: DiffHunk): string {
	return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
}

/** Context appears on both sides; consecutive remove/add runs pair by index. */
export function pairHunkLines(
	lines: DiffLine[],
): Array<{ left: DiffLine | null; right: DiffLine | null }> {
	const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]!;
		if (line.type === "context") {
			pairs.push({ left: line, right: line });
			index += 1;
			continue;
		}

		if (line.type === "added") {
			pairs.push({ left: null, right: line });
			index += 1;
			continue;
		}

		let removedEnd = index;
		while (
			removedEnd < lines.length &&
			lines[removedEnd]!.type === "removed"
		) {
			removedEnd += 1;
		}
		let addedEnd = removedEnd;
		while (
			addedEnd < lines.length &&
			lines[addedEnd]!.type === "added"
		) {
			addedEnd += 1;
		}

		const removed = lines.slice(index, removedEnd);
		const added = lines.slice(removedEnd, addedEnd);
		const pairCount = Math.max(removed.length, added.length);
		for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
			pairs.push({
				left: removed[pairIndex] ?? null,
				right: added[pairIndex] ?? null,
			});
		}
		index = addedEnd;
	}

	return pairs;
}

type Gap = {
	newStart: number;
	newEnd: number;
	oldStart: number;
};

function computeGaps(hunks: DiffHunk[], newLineCount: number): Gap[] {
	const gaps: Gap[] = [];
	let previousOldEnd = 0;
	let previousNewEnd = 0;

	for (const hunk of hunks) {
		gaps.push({
			newStart: previousNewEnd + 1,
			newEnd: hunk.newStart - 1,
			oldStart: previousOldEnd + 1,
		});
		previousOldEnd = hunk.oldStart + hunk.oldLines - 1;
		previousNewEnd = hunk.newStart + hunk.newLines - 1;
	}
	gaps.push({
		newStart: previousNewEnd + 1,
		newEnd: newLineCount,
		oldStart: previousOldEnd + 1,
	});
	return gaps;
}

export function buildDiffRows(
	file: ChangedFile,
	mode: ViewMode,
	collapsedHunks: ReadonlySet<number>,
	expandedGaps: ReadonlySet<number>,
): DiffRow[] {
	const diff = file.diff;
	if (!diff) return [];
	const contextSource = (file.newContent ?? "").split("\n");
	const gaps = computeGaps(diff.hunks, diff.newLineCount);
	const result: DiffRow[] = [];

	const pushGap = (gapIndex: number) => {
		const gap = gaps[gapIndex];
		if (!gap) return;
		const count = gap.newEnd - gap.newStart + 1;
		if (count <= 0) return;
		if (!expandedGaps.has(gapIndex)) {
			result.push({
				type: "gap",
				key: `gap:${gapIndex}`,
				gapIndex,
				count,
			});
			return;
		}

		for (let lineNumber = gap.newStart; lineNumber <= gap.newEnd; lineNumber += 1) {
			const offset = lineNumber - gap.newStart;
			const line: DiffLine = {
				type: "context",
				oldNumber: gap.oldStart + offset,
				newNumber: lineNumber,
				content: contextSource[lineNumber - 1] ?? "",
			};
			if (mode === "unified") {
				result.push({
					type: "line",
					key: `ctx:${gapIndex}:${lineNumber}`,
					line,
					commentable: false,
				});
			} else {
				result.push({
					type: "pair",
					key: `ctx:${gapIndex}:${lineNumber}`,
					left: line,
					right: line,
					commentable: false,
				});
			}
		}
	};

	diff.hunks.forEach((hunk, hunkIndex) => {
		pushGap(hunkIndex);
		const collapsed = collapsedHunks.has(hunkIndex);
		result.push({
			type: "hunk",
			key: `hunk:${hunkIndex}`,
			hunkIndex,
			collapsed,
			header: hunkHeader(hunk),
			hiddenLines: hunk.lines.length,
		});
		if (collapsed) return;

		if (mode === "unified") {
			hunk.lines.forEach((line, lineIndex) => {
				result.push({
					type: "line",
					key: `line:${hunkIndex}:${lineIndex}`,
					line,
					commentable: true,
				});
			});
		} else {
			pairHunkLines(hunk.lines).forEach((pair, pairIndex) => {
				result.push({
					type: "pair",
					key: `pair:${hunkIndex}:${pairIndex}`,
					left: pair.left,
					right: pair.right,
					commentable: true,
				});
			});
		}
	});
	pushGap(diff.hunks.length);
	return result;
}
