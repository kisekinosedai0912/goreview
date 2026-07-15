import type { CommentAnchor, CommentSide } from "../schemas/comment";
import type { ChangedFile, DiffLine } from "../schemas/review";

function anchorKey(anchor: CommentAnchor): string {
	return `${anchor.path}:${anchor.side}:${anchor.line}`;
}

export function anchorsForDiffLine(
	path: string,
	line: DiffLine,
): CommentAnchor[] {
	if (line.type === "added" && line.newNumber !== null) {
		return [{ path, side: "RIGHT", line: line.newNumber }];
	}
	if (line.type === "removed" && line.oldNumber !== null) {
		return [{ path, side: "LEFT", line: line.oldNumber }];
	}

	const anchors: CommentAnchor[] = [];
	if (line.oldNumber !== null) {
		anchors.push({ path, side: "LEFT", line: line.oldNumber });
	}
	if (line.newNumber !== null) {
		anchors.push({ path, side: "RIGHT", line: line.newNumber });
	}
	return anchors;
}

export function getCommentableAnchors(file: ChangedFile): CommentAnchor[] {
	const anchors = new Map<string, CommentAnchor>();
	for (const hunk of file.diff?.hunks ?? []) {
		for (const line of hunk.lines) {
			for (const anchor of anchorsForDiffLine(file.path, line)) {
				anchors.set(anchorKey(anchor), anchor);
			}
		}
	}
	return [...anchors.values()];
}

export function isCommentableAnchor(
	file: ChangedFile,
	anchor: CommentAnchor,
): boolean {
	if (anchor.path !== file.path) return false;
	return getCommentableAnchors(file).some(
		(candidate) => anchorKey(candidate) === anchorKey(anchor),
	);
}

export function findFirstChangedAnchor(
	file: ChangedFile,
	preferredSide: CommentSide = "RIGHT",
): CommentAnchor | null {
	const anchors = getCommentableAnchors(file);
	return (
		anchors.find((anchor) => anchor.side === preferredSide) ??
		anchors[0] ??
		null
	);
}
