import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	ChangedFile,
	CommentAnchor,
	CommentThread,
	CreateCommentInput,
	DiffHunk,
	DiffLine,
	DiffSegment,
	ReplyToCommentInput,
	ReviewComment,
} from "@goreview/core";
import { anchorsForDiffLine } from "@goreview/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	useAppTheme,
	useHighlightedFile,
} from "../highlight/use-highlighted";
import type { TokenLine, TokenSpan } from "../highlight/types";
import InlineComments from "./review/InlineComments";

export type ViewMode = "unified" | "split";

type DiffRow =
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

type DiffViewerProps = {
	file: ChangedFile;
	mode?: ViewMode;
	onModeChange?: (mode: ViewMode) => void;
	/** Render into the parent's scroll flow instead of creating a nested scroller. */
	continuous?: boolean;
	commentThreads?: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
};

const LINE_HEIGHT = 24;

function hunkHeader(hunk: DiffHunk): string {
	return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
}

/** Pair a hunk's lines for split view: context on both sides, removed/added runs index-paired. */
function pairHunkLines(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
	const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i]!;

		if (line.type === "context") {
			pairs.push({ left: line, right: line });
			i += 1;
			continue;
		}

		let j = i;
		while (j < lines.length && lines[j]!.type === "removed") j += 1;
		let k = j;
		while (k < lines.length && lines[k]!.type === "added") k += 1;

		const removed = lines.slice(i, j);
		const added = lines.slice(j, k);
		const max = Math.max(removed.length, added.length);
		for (let p = 0; p < max; p += 1) {
			pairs.push({ left: removed[p] ?? null, right: added[p] ?? null });
		}
		i = k;
	}

	return pairs;
}

type Gap = {
	/** 1-based inclusive range on the new side (old side offset separately). */
	newStart: number;
	newEnd: number;
	oldStart: number;
};

function computeGaps(hunks: DiffHunk[], newLineCount: number): Gap[] {
	const gaps: Gap[] = [];
	let prevOldEnd = 0;
	let prevNewEnd = 0;

	for (const hunk of hunks) {
		gaps.push({
			newStart: prevNewEnd + 1,
			newEnd: hunk.newStart - 1,
			oldStart: prevOldEnd + 1,
		});
		prevOldEnd = hunk.oldStart + hunk.oldLines - 1;
		prevNewEnd = hunk.newStart + hunk.newLines - 1;
	}

	gaps.push({
		newStart: prevNewEnd + 1,
		newEnd: newLineCount,
		oldStart: prevOldEnd + 1,
	});

	return gaps;
}

function DiffViewer({
	file,
	mode: controlledMode,
	onModeChange,
	continuous = false,
	commentThreads = [],
	onCreateComment,
	onReplyToComment,
}: DiffViewerProps) {
	const [localMode, setLocalMode] = useState<ViewMode>("split");
	const mode = controlledMode ?? localMode;
	const setMode = useCallback(
		(next: ViewMode) => {
			if (controlledMode === undefined) setLocalMode(next);
			onModeChange?.(next);
		},
		[controlledMode, onModeChange],
	);
	const [collapsedHunks, setCollapsedHunks] = useState<ReadonlySet<number>>(
		new Set(),
	);
	const [expandedGaps, setExpandedGaps] = useState<ReadonlySet<number>>(
		new Set(),
	);

	const theme = useAppTheme();
	const oldTokens = useHighlightedFile(file.oldContent, file.language, theme);
	const newTokens = useHighlightedFile(file.newContent, file.language, theme);

	const scrollRef = useRef<HTMLDivElement | null>(null);

	// Unchanged regions are identical on both sides; read them from the
	// new content (deleted files have a single all-file hunk, no gaps).
	const contextSource = useMemo(
		() => (file.newContent ?? "").split("\n"),
		[file.newContent],
	);

	const rows = useMemo<DiffRow[]>(() => {
		const diff = file.diff;
		if (!diff) return [];

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

			for (let n = gap.newStart; n <= gap.newEnd; n += 1) {
				const offset = n - gap.newStart;
				const line: DiffLine = {
					type: "context",
					oldNumber: gap.oldStart + offset,
					newNumber: n,
					content: contextSource[n - 1] ?? "",
				};
				if (mode === "unified") {
					result.push({
						type: "line",
						key: `ctx:${gapIndex}:${n}`,
						line,
						commentable: false,
					});
				} else {
					result.push({
						type: "pair",
						key: `ctx:${gapIndex}:${n}`,
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
				for (let i = 0; i < hunk.lines.length; i += 1) {
					result.push({
						type: "line",
						key: `l:${hunkIndex}:${i}`,
						line: hunk.lines[i]!,
						commentable: true,
					});
				}
			} else {
				const pairs = pairHunkLines(hunk.lines);
				for (let i = 0; i < pairs.length; i += 1) {
					result.push({
						type: "pair",
						key: `p:${hunkIndex}:${i}`,
						left: pairs[i]!.left,
						right: pairs[i]!.right,
						commentable: true,
					});
				}
			}
		});

		pushGap(diff.hunks.length);
		return result;
	}, [file.diff, mode, collapsedHunks, expandedGaps, contextSource]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => LINE_HEIGHT,
		overscan: 20,
	});

	const toggleHunk = useCallback((hunkIndex: number) => {
		setCollapsedHunks((current) => {
			const next = new Set(current);
			if (next.has(hunkIndex)) next.delete(hunkIndex);
			else next.add(hunkIndex);
			return next;
		});
	}, []);

	const expandGap = useCallback((gapIndex: number) => {
		setExpandedGaps((current) => new Set(current).add(gapIndex));
	}, []);

	const renderRow = useCallback(
		(row: DiffRow) =>
			row.type === "hunk" ? (
				<button
					type="button"
					className="diff-hunk-header"
					aria-expanded={!row.collapsed}
					onClick={() => toggleHunk(row.hunkIndex)}
				>
					<span
						className="tree-dir__chevron"
						data-collapsed={row.collapsed || undefined}
						aria-hidden="true"
					/>
					<span className="diff-hunk-header__range">{row.header}</span>
					{row.collapsed ? (
						<span className="diff-hunk-header__hidden">
							{row.hiddenLines} hidden lines
						</span>
					) : null}
				</button>
			) : row.type === "gap" ? (
				<button
					type="button"
					className="diff-gap"
					onClick={() => expandGap(row.gapIndex)}
				>
					⋯ Expand {row.count} unchanged {row.count === 1 ? "line" : "lines"}
				</button>
			) : row.type === "line" ? (
				<UnifiedLine
					path={file.path}
					line={row.line}
					commentable={row.commentable}
					oldTokens={oldTokens}
					newTokens={newTokens}
					threads={commentThreads}
					onCreateComment={onCreateComment}
					onReplyToComment={onReplyToComment}
				/>
			) : (
				<SplitPair
					path={file.path}
					left={row.left}
					right={row.right}
					commentable={row.commentable}
					oldTokens={oldTokens}
					newTokens={newTokens}
					threads={commentThreads}
					onCreateComment={onCreateComment}
					onReplyToComment={onReplyToComment}
				/>
			),
		[
			commentThreads,
			expandGap,
			file.path,
			newTokens,
			oldTokens,
			onCreateComment,
			onReplyToComment,
			toggleHunk,
		],
	);

	if (!file.diff) {
		return (
			<section className="diff-viewer diff-viewer--empty">
				<p className="diff-viewer__note">
					Content not available for this file (binary, too large, or not
					hydrated yet).
				</p>
			</section>
		);
	}

	if (file.diff.hunks.length === 0) {
		return (
			<section className="diff-viewer diff-viewer--empty">
				<p className="diff-viewer__note">
					No line changes{file.status === "renamed" ? " — file was renamed" : ""}.
				</p>
			</section>
		);
	}

	return (
		<section className="diff-viewer" data-mode={mode}>
			<header className="diff-viewer__header">
				<div className="diff-viewer__stats">
					<span className="tree-stats__additions">
						+{file.diff.additions}
					</span>
					<span className="tree-stats__deletions">
						−{file.diff.deletions}
					</span>
				</div>
				<div
					className="diff-viewer__modes"
					role="tablist"
					aria-label="Diff view mode"
				>
					<button
						type="button"
						role="tab"
						aria-selected={mode === "unified"}
						className="tree-compare__mode"
						onClick={() => setMode("unified")}
					>
						Unified
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={mode === "split"}
						className="tree-compare__mode"
						onClick={() => setMode("split")}
					>
						Split
					</button>
				</div>
			</header>

			{continuous ? (
				<div className="diff-viewer__body diff-viewer__body--continuous">
					{rows.map((row) => (
						<div key={row.key} className="diff-viewer__row diff-viewer__row--flow">
							{renderRow(row)}
						</div>
					))}
				</div>
			) : (
				<div ref={scrollRef} className="diff-viewer__scroll">
					<div
						className="diff-viewer__body"
						style={{ height: virtualizer.getTotalSize() }}
					>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const row = rows[virtualRow.index]!;
							return (
								<div
									key={row.key}
									className="diff-viewer__row"
									style={{
										transform: `translateY(${virtualRow.start}px)`,
										height: virtualRow.size,
									}}
								>
									{renderRow(row)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</section>
	);
}

type LineTokensProps = {
	line: DiffLine;
	oldTokens: TokenLine[] | null;
	newTokens: TokenLine[] | null;
};

type CommentableLineProps = {
	path: string;
	commentable: boolean;
	threads: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
};

function threadsAtAnchors(
	threads: CommentThread[],
	anchors: CommentAnchor[],
): CommentThread[] {
	const keys = new Set(
		anchors.map((anchor) => `${anchor.path}:${anchor.side}:${anchor.line}`),
	);
	return threads.filter(
		(thread) =>
			thread.anchor &&
			keys.has(
				`${thread.anchor.path}:${thread.anchor.side}:${thread.anchor.line}`,
			),
	);
}

function tokensForLine(
	line: DiffLine,
	oldTokens: TokenLine[] | null,
	newTokens: TokenLine[] | null,
): TokenLine | null {
	if (line.newNumber !== null && newTokens) {
		return newTokens[line.newNumber - 1] ?? null;
	}
	if (line.oldNumber !== null && oldTokens) {
		return oldTokens[line.oldNumber - 1] ?? null;
	}
	return null;
}

type RenderSpan = TokenSpan & { emphasized: boolean };

/**
 * Overlay intra-line segment emphasis on top of syntax token colors by
 * splitting spans at boundary offsets of both sequences.
 */
function mergeTokensWithSegments(
	tokens: TokenLine,
	segments: DiffSegment[] | undefined,
): RenderSpan[] {
	if (!segments || segments.length === 0) {
		return tokens.map((token) => ({ ...token, emphasized: false }));
	}

	const result: RenderSpan[] = [];
	let tokenIndex = 0;
	let tokenOffset = 0;

	for (const segment of segments) {
		let remaining = segment.value.length;
		while (remaining > 0 && tokenIndex < tokens.length) {
			const token = tokens[tokenIndex]!;
			const available = token.content.length - tokenOffset;
			const take = Math.min(available, remaining);
			result.push({
				content: token.content.slice(tokenOffset, tokenOffset + take),
				color: token.color,
				emphasized: segment.changed,
			});
			remaining -= take;
			tokenOffset += take;
			if (tokenOffset >= token.content.length) {
				tokenIndex += 1;
				tokenOffset = 0;
			}
		}
		// Segment text extends past tokens (shouldn't happen; be safe).
		if (remaining > 0) {
			result.push({
				content: segment.value.slice(segment.value.length - remaining),
				emphasized: segment.changed,
			});
		}
	}

	// Trailing tokens not covered by segments.
	while (tokenIndex < tokens.length) {
		const token = tokens[tokenIndex]!;
		result.push({
			content: token.content.slice(tokenOffset),
			color: token.color,
			emphasized: false,
		});
		tokenIndex += 1;
		tokenOffset = 0;
	}

	return result;
}

function segmentsOnly(segments: DiffSegment[]): RenderSpan[] {
	return segments.map((segment) => ({
		content: segment.value,
		emphasized: segment.changed,
	}));
}

const LineContent = memo(function LineContent({
	line,
	oldTokens,
	newTokens,
}: LineTokensProps) {
	const tokens = tokensForLine(line, oldTokens, newTokens);

	let spans: RenderSpan[];
	if (tokens) {
		spans = mergeTokensWithSegments(tokens, line.segments);
	} else if (line.segments) {
		spans = segmentsOnly(line.segments);
	} else {
		spans = [{ content: line.content, emphasized: false }];
	}

	return (
		<span className="diff-line__content">
			{spans.map((span, index) =>
				span.emphasized ? (
					<mark
						key={index}
						className="diff-line__emphasis"
						style={span.color ? { color: span.color } : undefined}
					>
						{span.content}
					</mark>
				) : (
					<span
						key={index}
						style={span.color ? { color: span.color } : undefined}
					>
						{span.content}
					</span>
				),
			)}
		</span>
	);
});

const UnifiedLine = memo(function UnifiedLine({
	path,
	commentable,
	line,
	oldTokens,
	newTokens,
	threads,
	onCreateComment,
	onReplyToComment,
}: LineTokensProps & CommentableLineProps) {
	const anchors = commentable
		? anchorsForDiffLine(path, line).filter(
				(anchor) => line.type !== "context" || anchor.side === "RIGHT",
			)
		: [];
	return (
		<div className="diff-line-block">
			<div className="diff-line" data-type={line.type}>
				<span className="diff-line__gutter">{line.oldNumber ?? ""}</span>
				<span className="diff-line__gutter">{line.newNumber ?? ""}</span>
				<span className="diff-line__marker" aria-hidden="true">
					{line.type === "added" ? "+" : line.type === "removed" ? "−" : ""}
				</span>
				<LineContent line={line} oldTokens={oldTokens} newTokens={newTokens} />
			</div>
			<InlineComments
				anchors={anchors}
				threads={threadsAtAnchors(threads, anchors)}
				onCreate={onCreateComment}
				onReply={onReplyToComment}
			/>
		</div>
	);
});

const SplitPair = memo(function SplitPair({
	path,
	commentable,
	left,
	right,
	oldTokens,
	newTokens,
	threads,
	onCreateComment,
	onReplyToComment,
}: {
	path: string;
	commentable: boolean;
	left: DiffLine | null;
	right: DiffLine | null;
	oldTokens: TokenLine[] | null;
	newTokens: TokenLine[] | null;
} & Omit<CommentableLineProps, "path">) {
	const anchors = commentable
		? [
				...(left
					? anchorsForDiffLine(path, left).filter(
							(anchor) => anchor.side === "LEFT",
						)
					: []),
				...(right
					? anchorsForDiffLine(path, right).filter(
							(anchor) => anchor.side === "RIGHT",
						)
					: []),
			]
		: [];
	return (
		<div className="diff-line-block">
			<div className="diff-pair">
				<div
					className="diff-line diff-line--half"
					data-type={left ? (left.type === "context" ? "context" : "removed") : "spacer"}
				>
					{left ? (
						<>
							<span className="diff-line__gutter">{left.oldNumber ?? ""}</span>
							<span className="diff-line__marker" aria-hidden="true">
								{left.type === "removed" ? "−" : ""}
							</span>
							<LineContent
								line={left}
								oldTokens={oldTokens}
								newTokens={left.type === "context" ? newTokens : null}
							/>
						</>
					) : null}
				</div>
				<div
					className="diff-line diff-line--half"
					data-type={right ? (right.type === "context" ? "context" : "added") : "spacer"}
				>
					{right ? (
						<>
							<span className="diff-line__gutter">{right.newNumber ?? ""}</span>
							<span className="diff-line__marker" aria-hidden="true">
								{right.type === "added" ? "+" : ""}
							</span>
							<LineContent
								line={right}
								oldTokens={oldTokens}
								newTokens={newTokens}
							/>
						</>
					) : null}
				</div>
			</div>
			<InlineComments
				anchors={anchors}
				threads={threadsAtAnchors(threads, anchors)}
				onCreate={onCreateComment}
				onReply={onReplyToComment}
			/>
		</div>
	);
});

export default memo(DiffViewer);
