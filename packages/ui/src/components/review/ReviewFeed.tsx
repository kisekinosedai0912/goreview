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
	type ReviewSnapshot,
} from "@goreview/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import ReviewMeta from "../ReviewMeta";
import type { ViewMode } from "../DiffViewer";

const DiffViewer = lazy(() => import("../DiffViewer"));
const ExplanationList = lazy(() => import("../ExplanationList"));

export type ReviewFeedHandle = {
	scrollToPath(path: string): void;
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
		},
		ref,
	) {
		const scrollRef = useRef<HTMLDivElement | null>(null);
		const paths = useMemo(() => files.map((file) => file.path), [files]);

		const virtualizer = useVirtualizer({
			count: files.length + 1,
			getScrollElement: () => scrollRef.current,
			estimateSize: (index) => (index === 0 ? 210 : 520),
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

		useImperativeHandle(
			ref,
			() => ({
				scrollToPath(path: string) {
					const index = paths.indexOf(path);
					if (index >= 0) {
						virtualizer.scrollToIndex(index + 1, {
							align: "start",
							behavior: "smooth",
						});
					}
				},
			}),
			[paths, virtualizer],
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
								</header>

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
