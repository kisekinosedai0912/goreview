import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	ChangedFile,
	CodeExplanation,
	CommentAnchor,
	CommentThread,
	CreateCommentInput,
	ReplyToCommentInput,
	ReviewComment,
} from "@goreview/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppTheme } from "../highlight/use-highlighted";
import DiffRowContent from "./review/DiffRowContent";
import { buildDiffRows } from "./review/diff-rows";

export type ViewMode = "unified" | "split";

type DiffViewerProps = {
	file: ChangedFile;
	mode?: ViewMode;
	onModeChange?: (mode: ViewMode) => void;
	/** Render into the parent's scroll flow instead of creating a nested scroller. */
	continuous?: boolean;
	commentThreads?: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
	lineExplanations?: ReadonlyMap<string, CodeExplanation>;
	explainingAnchors?: ReadonlySet<string>;
	onExplainLine?: (anchor: CommentAnchor) => void;
};

const LINE_HEIGHT = 24;

function DiffViewer({
	file,
	mode: controlledMode,
	onModeChange,
	continuous = false,
	commentThreads = [],
	onCreateComment,
	onReplyToComment,
	lineExplanations = new Map(),
	explainingAnchors = new Set(),
	onExplainLine,
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
	const scrollRef = useRef<HTMLDivElement | null>(null);

	const rows = useMemo(
		() => buildDiffRows(file, mode, collapsedHunks, expandedGaps),
		[file, mode, collapsedHunks, expandedGaps],
	);

	// TanStack Virtual intentionally returns a mutable instance; React Compiler
	// skips this component while the virtualizer handles its own memoization.
	// eslint-disable-next-line react-hooks/incompatible-library
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
		(row: (typeof rows)[number]) => (
			<DiffRowContent
				file={file}
				row={row}
				theme={theme}
				threads={commentThreads}
				onCreateComment={onCreateComment}
				onReplyToComment={onReplyToComment}
				lineExplanations={lineExplanations}
				explainingAnchors={explainingAnchors}
				onExplainLine={onExplainLine}
				onToggleHunk={toggleHunk}
				onExpandGap={expandGap}
			/>
		),
		[
			commentThreads,
			expandGap,
			file,
			onCreateComment,
			onExplainLine,
			onReplyToComment,
			explainingAnchors,
			lineExplanations,
			theme,
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
				{mode === "split" ? (
					<div
						className="diff-viewer__columns"
						data-single-side={
							file.status === "added"
								? "right"
								: file.status === "deleted"
									? "left"
									: undefined
						}
						aria-hidden="true"
					>
						{file.status !== "added" ? <span>Old · base</span> : null}
						{file.status !== "deleted" ? <span>New · head</span> : null}
					</div>
				) : null}
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

export default memo(DiffViewer);
