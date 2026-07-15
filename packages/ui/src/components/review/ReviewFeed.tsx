import {
	forwardRef,
	lazy,
	memo,
	Suspense,
	useCallback,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import {
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
import ReviewMeta from "../ReviewMeta";
import type { ViewMode } from "../DiffViewer";
import IntelligencePanel from "./IntelligencePanel";
import ExplanationCard from "./ExplanationCard";

const DiffViewer = lazy(() => import("../DiffViewer"));
const ExplanationList = lazy(() => import("../ExplanationList"));

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
	fileExplanations: ReadonlyMap<string, CodeExplanation>;
	lineExplanations: ReadonlyMap<string, CodeExplanation>;
	explainingKeys: ReadonlySet<string>;
	onExplainFile?: (path: string) => void;
	onExplainLine?: (anchor: CommentAnchor) => void;
};

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
			fileExplanations,
			lineExplanations,
			explainingKeys,
			onExplainFile,
			onExplainLine,
		},
		ref,
	) {
		const scrollRef = useRef<HTMLDivElement | null>(null);
		const paths = useMemo(() => files.map((file) => file.path), [files]);

		const virtualizer = useVirtualizer({
			count: files.length + 1,
			getScrollElement: () => scrollRef.current,
			estimateSize: (index) => (index === 0 ? 920 : 520),
			overscan: 2,
			getItemKey: (index) => (index === 0 ? "review-meta" : paths[index - 1]!),
			onChange: (instance) => {
				const visible = instance.getVirtualItems();
				const firstFile = visible.find((item) => item.index > 0);
				if (firstFile) {
					const path = paths[firstFile.index - 1];
					if (path) onVisiblePath(path);
				}
				for (const item of visible) {
					if (item.index === 0) continue;
					const file = files[item.index - 1];
					if (
						file &&
						file.oldContent === null &&
						file.newContent === null
					) {
						onNeedFile(file.path);
					}
				}
			},
		});

		const scrollToPath = useCallback(
			(path: string) => {
				const index = paths.indexOf(path);
				if (index >= 0) {
					virtualizer.scrollToIndex(index + 1, {
						align: "start",
						behavior: "smooth",
					});
				}
			},
			[paths, virtualizer],
		);

		const scrollToAnchor = useCallback(
			(anchor: CommentAnchor) => {
				scrollToPath(anchor.path);
				const key = `${anchor.path}:${anchor.side}:${anchor.line}`;
				let attempts = 0;
				const reveal = () => {
					const escaped = typeof CSS !== "undefined" ? CSS.escape(key) : key;
					const element = scrollRef.current?.querySelector<HTMLElement>(
						`[data-review-anchors~="${escaped}"]`,
					);
					if (element) {
						element.scrollIntoView({ behavior: "smooth", block: "center" });
						element.focus({ preventScroll: true });
						return;
					}
					attempts += 1;
					if (attempts < 10) window.setTimeout(reveal, 120);
				};
				window.setTimeout(reveal, 120);
			},
			[scrollToPath],
		);

		useImperativeHandle(
			ref,
			() => ({ scrollToPath, scrollToAnchor }),
			[scrollToAnchor, scrollToPath],
		);

		const measure = useCallback(
			(element: HTMLDivElement | null) => {
				if (element) virtualizer.measureElement(element);
			},
			[virtualizer],
		);

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
						if (virtualItem.index === 0) {
							return (
								<div
									key="review-meta"
									ref={measure}
									data-index={virtualItem.index}
									className="review-feed__item"
									style={{ transform: `translateY(${virtualItem.start}px)` }}
								>
									<ReviewMeta snapshot={{ ...snapshot, files }} />
									<IntelligencePanel
										result={intelligence}
										generating={generatingIntelligence}
										onGenerate={onGenerateIntelligence}
										onNavigate={scrollToAnchor}
									/>
								</div>
							);
						}

						const file = files[virtualItem.index - 1]!;
						const isLoading = loadingPaths.has(file.path);
						const error = errors.get(file.path);
						const isHydrated =
							file.oldContent !== null || file.newContent !== null;

						return (
							<section
								key={file.path}
								ref={measure}
								data-index={virtualItem.index}
								data-review-path={file.path}
								className="review-feed__item review-file"
								style={{ transform: `translateY(${virtualItem.start}px)` }}
							>
								<header className="review-scroll__file">
									<div className="review-scroll__file-info">
										<p
											className="review-scroll__status"
											data-status={file.status}
										>
											{file.status}
											{file.oldPath ? ` from ${file.oldPath}` : ""}
										</p>
										<h2 className="review-scroll__path">{file.path}</h2>
									</div>
									<label className="viewed-toggle">
										<input
											type="checkbox"
											checked={viewed.has(file.path)}
											onChange={() => onToggleViewed(file.path)}
										/>
										<span>Viewed</span>
									</label>
									{onExplainFile ? (
										<button
											type="button"
											className="review-file__explain"
											onClick={() => onExplainFile(file.path)}
											disabled={explainingKeys.has(`file:${file.path}`)}
										>
											{explainingKeys.has(`file:${file.path}`)
												? "Explaining…"
												: "Explain file"}
										</button>
									) : null}
								</header>
								{fileExplanations.get(file.path) ? (
									<ExplanationCard
										explanation={fileExplanations.get(file.path)!}
									/>
								) : null}

								{error ? (
									<p className="panel-fallback">{error}</p>
								) : isLoading || !isHydrated ? (
									<p className="panel-fallback">Loading file contents…</p>
								) : (
									<>
										<Suspense
											fallback={
												<div className="panel-fallback">
													Loading comparison…
												</div>
											}
										>
											<DiffViewer
												file={file}
												mode={mode}
												onModeChange={onModeChange}
												continuous
												commentThreads={commentThreads}
												onCreateComment={onCreateComment}
												onReplyToComment={onReplyToComment}
												lineExplanations={lineExplanations}
												explainingAnchors={explainingKeys}
												onExplainLine={onExplainLine}
											/>
										</Suspense>
										<Suspense
											fallback={
												<div className="panel-fallback">
													Loading explanations…
												</div>
											}
										>
											<ExplanationList
												explanations={explainEvents(file.events)}
											/>
										</Suspense>
									</>
								)}
							</section>
						);
					})}
				</div>
			</div>
		);
	},
);

export default memo(ReviewFeed);
