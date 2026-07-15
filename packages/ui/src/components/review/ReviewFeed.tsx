import {
	anchorsForDiffLine,
	explainEvents,
	type ChangedFile,
	type CodeExplanation,
	type CommentAnchor,
	type CommentThread,
	type CreateCommentInput,
	type ReplyToCommentInput,
	type ReviewComment,
	type ReviewIntelligenceResult,
	type ReviewSnapshot,
} from "@goreview/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	forwardRef,
	memo,
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAppTheme } from "../../highlight/use-highlighted";
import type { ViewMode } from "../DiffViewer";
import ExplanationList from "../ExplanationList";
import ReviewMeta from "../ReviewMeta";
import DiffRowContent from "./DiffRowContent";
import ExplanationCard from "./ExplanationCard";
import IntelligencePanel from "./IntelligencePanel";
import { buildDiffRows, type DiffRow } from "./diff-rows";

export type ReviewFeedHandle = {
	scrollToPath(path: string): void;
	scrollToAnchor(anchor: CommentAnchor): void;
};

type ReviewFeedProps = {
	snapshot: ReviewSnapshot;
	files: ChangedFile[];
	mode: ViewMode;
	viewed: ReadonlySet<string>;
	loadingPaths: ReadonlySet<string>;
	errors: ReadonlyMap<string, string>;
	onModeChange: (mode: ViewMode) => void;
	onVisiblePath: (path: string) => void;
	onNeedFile: (path: string) => void;
	onToggleViewed: (path: string) => void;
	commentThreads: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
	intelligence: ReviewIntelligenceResult;
	generatingIntelligence: boolean;
	onGenerateIntelligence?: () => void;
	onNavigateAnchor?: (anchor: CommentAnchor) => void;
	fileExplanations: ReadonlyMap<string, CodeExplanation>;
	lineExplanations: ReadonlyMap<string, CodeExplanation>;
	explainingKeys: ReadonlySet<string>;
	onExplainFile?: (path: string) => void;
	onExplainLine?: (anchor: CommentAnchor) => void;
};

type FeedRow =
	| { type: "overview"; key: "review-overview" }
	| { type: "file-header"; key: string; file: ChangedFile }
	| { type: "file-state"; key: string; file: ChangedFile }
	| { type: "diff-header"; key: string; file: ChangedFile }
	| { type: "diff"; key: string; file: ChangedFile; diffRow: DiffRow }
	| { type: "explanations"; key: string; file: ChangedFile };

type FeedModel = {
	rows: FeedRow[];
	pathIndices: Map<string, number>;
	anchorIndices: Map<string, number>;
};

function anchorKey(anchor: CommentAnchor): string {
	return `${anchor.path}:${anchor.side}:${anchor.line}`;
}

function anchorsForRow(path: string, row: DiffRow): CommentAnchor[] {
	if (row.type === "hunk" || row.type === "gap" || !row.commentable) return [];
	if (row.type === "line") {
		return anchorsForDiffLine(path, row.line).filter(
			(anchor) => row.line.type !== "context" || anchor.side === "RIGHT",
		);
	}
	if (row.type !== "pair") return [];
	return [
		...(row.left
			? anchorsForDiffLine(path, row.left).filter(
					(anchor) => anchor.side === "LEFT",
				)
			: []),
		...(row.right
			? anchorsForDiffLine(path, row.right).filter(
					(anchor) => anchor.side === "RIGHT",
				)
			: []),
	];
}

function estimateRowSize(row: FeedRow): number {
	switch (row.type) {
		case "overview":
			return 760;
		case "file-header":
			return 112;
		case "file-state":
			return 72;
		case "diff-header":
			return 44;
		case "explanations":
			return 160;
		case "diff":
			return row.diffRow.type === "hunk" || row.diffRow.type === "gap"
				? 30
				: 24;
	}
}

const ReviewFeed = forwardRef<ReviewFeedHandle, ReviewFeedProps>(
	function ReviewFeed(
		{
			snapshot,
			files,
			mode,
			viewed,
			loadingPaths,
			errors,
			onModeChange,
			onVisiblePath,
			onNeedFile,
			onToggleViewed,
			commentThreads,
			onCreateComment,
			onReplyToComment,
			intelligence,
			generatingIntelligence,
			onGenerateIntelligence,
			onNavigateAnchor,
			fileExplanations,
			lineExplanations,
			explainingKeys,
			onExplainFile,
			onExplainLine,
		},
		ref,
	) {
		const scrollRef = useRef<HTMLDivElement | null>(null);
		const [collapsedHunks, setCollapsedHunks] = useState<
			ReadonlyMap<string, ReadonlySet<number>>
		>(new Map());
		const [expandedGaps, setExpandedGaps] = useState<
			ReadonlyMap<string, ReadonlySet<number>>
		>(new Map());
		const theme = useAppTheme();

		const model = useMemo<FeedModel>(() => {
			const rows: FeedRow[] = [{ type: "overview", key: "review-overview" }];
			const pathIndices = new Map<string, number>();
			const anchorIndices = new Map<string, number>();

			for (const file of files) {
				pathIndices.set(file.path, rows.length);
				rows.push({
					type: "file-header",
					key: `file:${file.path}`,
					file,
				});
				const isHydrated =
					file.oldContent !== null || file.newContent !== null;
				if (!isHydrated || !file.diff || file.diff.hunks.length === 0) {
					rows.push({
						type: "file-state",
						key: `state:${file.path}`,
						file,
					});
					continue;
				}

				rows.push({
					type: "diff-header",
					key: `diff-header:${file.path}`,
					file,
				});
				const fileRows = buildDiffRows(
					file,
					mode,
					collapsedHunks.get(file.path) ?? new Set(),
					expandedGaps.get(file.path) ?? new Set(),
				);
				for (const diffRow of fileRows) {
					const index = rows.length;
					for (const anchor of anchorsForRow(file.path, diffRow)) {
						anchorIndices.set(anchorKey(anchor), index);
					}
					rows.push({
						type: "diff",
						key: `diff:${file.path}:${diffRow.key}`,
						file,
						diffRow,
					});
				}
				if (explainEvents(file.events).length > 0) {
					rows.push({
						type: "explanations",
						key: `explanations:${file.path}`,
						file,
					});
				}
			}
			return { rows, pathIndices, anchorIndices };
		}, [files, mode, collapsedHunks, expandedGaps]);
		const modelRef = useRef(model);
		modelRef.current = model;

		// The one global virtualizer keeps even very large lockfile diffs cheap:
		// only rows in and around the viewport exist in the DOM.
		const virtualizer = useVirtualizer({
			count: model.rows.length,
			getScrollElement: () => scrollRef.current,
			estimateSize: (index) => estimateRowSize(model.rows[index]!),
			overscan: 18,
			getItemKey: (index) => model.rows[index]!.key,
			onChange: (instance) => {
				const viewportStart = instance.scrollOffset ?? 0;
				const firstVisible = instance
					.getVirtualItems()
					.find((item) => item.end > viewportStart + 56);
				if (firstVisible) {
					const row = model.rows[firstVisible.index];
					if (row && row.type !== "overview") onVisiblePath(row.file.path);
				}
				for (const item of instance.getVirtualItems()) {
					const row = model.rows[item.index];
					if (!row || row.type === "overview") continue;
					if (
						row.file.oldContent === null &&
						row.file.newContent === null
					) {
						onNeedFile(row.file.path);
					}
				}
			},
		});

		const revealSelector = useCallback((selector: string) => {
			let attempts = 0;
			const reveal = () => {
				const element =
					scrollRef.current?.querySelector<HTMLElement>(selector) ?? null;
				if (element) {
					element.scrollIntoView({ block: "start", behavior: "smooth" });
					element.focus({ preventScroll: true });
					return;
				}
				attempts += 1;
				if (attempts < 12) window.setTimeout(reveal, 50);
			};
			window.requestAnimationFrame(reveal);
		}, []);

		const scrollToPath = useCallback(
			(path: string) => {
				const index = modelRef.current.pathIndices.get(path);
				if (index === undefined) return;
				// Smooth scrolling with dynamically measured virtual rows is inaccurate.
				// Mount the exact target first, then animate the final short adjustment.
				virtualizer.scrollToIndex(index, { align: "start" });
				revealSelector(
					`[data-review-path="${typeof CSS === "undefined" ? path : CSS.escape(path)}"]`,
				);
			},
			[revealSelector, virtualizer],
		);

		const scrollToAnchor = useCallback(
			(anchor: CommentAnchor) => {
				onNeedFile(anchor.path);
				const key = anchorKey(anchor);
				const index = modelRef.current.anchorIndices.get(key);
				if (index === undefined) {
					scrollToPath(anchor.path);
				} else {
					virtualizer.scrollToIndex(index, { align: "center" });
				}
				const escaped = typeof CSS === "undefined" ? key : CSS.escape(key);
				revealSelector(`[data-review-anchors~="${escaped}"]`);
			},
			[onNeedFile, revealSelector, scrollToPath, virtualizer],
		);

		useImperativeHandle(
			ref,
			() => ({ scrollToPath, scrollToAnchor }),
			[scrollToAnchor, scrollToPath],
		);

		const toggleHunk = useCallback((path: string, hunkIndex: number) => {
			setCollapsedHunks((current) => {
				const next = new Map(current);
				const indices = new Set(next.get(path) ?? []);
				if (indices.has(hunkIndex)) indices.delete(hunkIndex);
				else indices.add(hunkIndex);
				next.set(path, indices);
				return next;
			});
		}, []);

		const expandGap = useCallback((path: string, gapIndex: number) => {
			setExpandedGaps((current) => {
				const next = new Map(current);
				const indices = new Set(next.get(path) ?? []);
				indices.add(gapIndex);
				next.set(path, indices);
				return next;
			});
		}, []);

		if (files.length === 0) {
			return (
				<div className="review-feed__scroll">
					<ReviewMeta snapshot={{ ...snapshot, files }} />
					<div className="review-workspace__empty">
						<p>No files match the active filters.</p>
					</div>
				</div>
			);
		}

		return (
			<div ref={scrollRef} className="review-feed__scroll">
				<div
					className="review-feed__list"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualizer.getVirtualItems().map((virtualItem) => {
						const row = model.rows[virtualItem.index]!;
						const style = {
							transform: `translateY(${virtualItem.start}px)`,
						};
						const common = {
							"data-index": virtualItem.index,
							ref: virtualizer.measureElement,
							style,
						};

						if (row.type === "overview") {
							return (
								<div
									key={row.key}
									{...common}
									className="review-feed__item review-feed__item--overview"
								>
									<ReviewMeta snapshot={{ ...snapshot, files }} />
									<IntelligencePanel
										result={intelligence}
										generating={generatingIntelligence}
										onGenerate={onGenerateIntelligence}
										onNavigate={onNavigateAnchor ?? scrollToAnchor}
									/>
								</div>
							);
						}

						if (row.type === "file-header") {
							const explanation = fileExplanations.get(row.file.path);
							return (
								<section
									key={row.key}
									{...common}
									data-review-path={row.file.path}
									tabIndex={-1}
									className="review-feed__item review-feed__item--file-header"
								>
									<header className="review-scroll__file">
										<div className="review-scroll__file-info">
											<p
												className="review-scroll__status"
												data-status={row.file.status}
											>
												{row.file.status}
												{row.file.oldPath ? ` from ${row.file.oldPath}` : ""}
											</p>
											<h2 className="review-scroll__path">{row.file.path}</h2>
										</div>
										<div className="review-file__actions">
											<label className="viewed-toggle">
												<input
													type="checkbox"
													checked={viewed.has(row.file.path)}
													onChange={() => onToggleViewed(row.file.path)}
												/>
												<span>Viewed</span>
											</label>
											{onExplainFile ? (
												<button
													type="button"
													className="review-file__explain"
													onClick={() => onExplainFile(row.file.path)}
													disabled={explainingKeys.has(
														`file:${row.file.path}`,
													)}
												>
													{explainingKeys.has(`file:${row.file.path}`)
														? "Explaining…"
														: "Explain file"}
												</button>
											) : null}
										</div>
									</header>
									{explanation ? (
										<ExplanationCard explanation={explanation} />
									) : null}
								</section>
							);
						}

						if (row.type === "file-state") {
							const error = errors.get(row.file.path);
							const isLoading = loadingPaths.has(row.file.path);
							const isHydrated =
								row.file.oldContent !== null ||
								row.file.newContent !== null;
							const message = error
								? error
								: isLoading || !isHydrated
									? "Loading file contents…"
									: row.file.diff?.hunks.length === 0
										? `No line changes${row.file.status === "renamed" ? " — file was renamed" : ""}.`
										: "Content is unavailable for this file.";
							return (
								<div
									key={row.key}
									{...common}
									className="review-feed__item review-feed__item--state"
								>
									<p className="panel-fallback">{message}</p>
								</div>
							);
						}

						if (row.type === "diff-header") {
							return (
								<div
									key={row.key}
									{...common}
									className="review-feed__item review-feed__item--diff-header"
								>
									<div className="diff-viewer__header">
										<div className="diff-viewer__stats">
											<span className="tree-stats__additions">
												+{row.file.diff?.additions ?? 0}
											</span>
											<span className="tree-stats__deletions">
												−{row.file.diff?.deletions ?? 0}
											</span>
										</div>
										{mode === "split" ? (
											<div className="diff-viewer__columns" aria-hidden="true">
												<span>Old · base</span>
												<span>New · head</span>
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
												onClick={() => onModeChange("unified")}
											>
												Unified
											</button>
											<button
												type="button"
												role="tab"
												aria-selected={mode === "split"}
												className="tree-compare__mode"
												onClick={() => onModeChange("split")}
											>
												Split
											</button>
										</div>
									</div>
								</div>
							);
						}

						if (row.type === "explanations") {
							return (
								<div
									key={row.key}
									{...common}
									className="review-feed__item review-feed__item--explanations"
								>
									<ExplanationList
										explanations={explainEvents(row.file.events)}
									/>
								</div>
							);
						}

						const rowAnchors = anchorsForRow(
							row.file.path,
							row.diffRow,
						).map(anchorKey);
						return (
							<div
								key={row.key}
								{...common}
								data-review-anchors={rowAnchors.join(" ")}
								tabIndex={-1}
								className="review-feed__item review-feed__item--diff"
							>
								<DiffRowContent
									file={row.file}
									row={row.diffRow}
									theme={theme}
									threads={commentThreads}
									onCreateComment={onCreateComment}
									onReplyToComment={onReplyToComment}
									lineExplanations={lineExplanations}
									explainingAnchors={explainingKeys}
									onExplainLine={onExplainLine}
									onToggleHunk={(hunkIndex) =>
										toggleHunk(row.file.path, hunkIndex)
									}
									onExpandGap={(gapIndex) =>
										expandGap(row.file.path, gapIndex)
									}
								/>
							</div>
						);
					})}
				</div>
			</div>
		);
	},
);

export default memo(ReviewFeed);
