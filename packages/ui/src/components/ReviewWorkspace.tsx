import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import {
	getOrderedFiles,
	buildDeterministicIntelligence,
	type ChangeCategory,
	type ChangedFile,
	type CodeExplanation,
	type CommentAnchor,
	type CommentThread,
	type CreateCommentInput,
	type ReplyToCommentInput,
	type ReviewComment,
	type ReviewDataSource,
	type ReviewIntelligenceResult,
	type ReviewSnapshot,
} from "@goreview/core";
import FileJumper from "./FileJumper";
import FileTreeCompare from "./FileTreeCompare";
import ThemeToggle from "./ThemeToggle";
import ReviewFeed, {
	type ReviewFeedHandle,
} from "./review/ReviewFeed";
import type { ViewMode } from "./DiffViewer";
import { useViewedFiles } from "../lib/use-viewed-files";

type ReviewWorkspaceProps = {
	snapshot: ReviewSnapshot;
	dataSource?: ReviewDataSource;
	source?: "github" | "fixture";
};

function storedViewMode(): ViewMode {
	if (typeof window === "undefined") return "split";
	return window.localStorage.getItem("goreview-diff-mode") === "unified"
		? "unified"
		: "split";
}

function ReviewWorkspace({
	snapshot,
	dataSource,
	source = "fixture",
}: ReviewWorkspaceProps) {
	const initialFiles = useMemo(
		() => getOrderedFiles(snapshot.files),
		[snapshot.files],
	);
	const [selectedPath, setSelectedPath] = useState<string | null>(
		initialFiles[0]?.path ?? null,
	);
	const [files, setFiles] = useState(snapshot.files);
	const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
	const [jumperOpen, setJumperOpen] = useState(false);
	const [statusFilter, setStatusFilter] = useState<
		ReadonlySet<ChangedFile["status"]>
	>(new Set());
	const [categoryFilter, setCategoryFilter] = useState<
		ReadonlySet<ChangeCategory>
	>(new Set());
	const [mode, setMode] = useState<ViewMode>(storedViewMode);
	const [, startModeTransition] = useTransition();
	const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
	const [intelligence, setIntelligence] = useState<ReviewIntelligenceResult>(
		() => ({
			intelligence: buildDeterministicIntelligence(snapshot),
			aiAvailable: false,
		}),
	);
	const [generatingIntelligence, setGeneratingIntelligence] = useState(false);
	const [fileExplanations, setFileExplanations] = useState<
		ReadonlyMap<string, CodeExplanation>
	>(new Map());
	const [lineExplanations, setLineExplanations] = useState<
		ReadonlyMap<string, CodeExplanation>
	>(new Map());
	const [explainingKeys, setExplainingKeys] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const feedRef = useRef<ReviewFeedHandle | null>(null);
	const inFlightRef = useRef(new Set<string>());
	const pendingNavigationRef = useRef<{
		path: string;
		anchor?: CommentAnchor;
	} | null>(null);

	const [prevSnapshot, setPrevSnapshot] = useState(snapshot);
	if (prevSnapshot !== snapshot) {
		setPrevSnapshot(snapshot);
		setFiles(snapshot.files);
		setSelectedPath(getOrderedFiles(snapshot.files)[0]?.path ?? null);
		setLoadingPaths(new Set());
		setErrors(new Map());
		setCommentThreads([]);
		setIntelligence({
			intelligence: buildDeterministicIntelligence(snapshot),
			aiAvailable: false,
		});
		setGeneratingIntelligence(false);
		setFileExplanations(new Map());
		setLineExplanations(new Map());
		setExplainingKeys(new Set());
		inFlightRef.current.clear();
		pendingNavigationRef.current = null;
	}

	const reviewKey = `${snapshot.repo}#${snapshot.headSha}`;
	const { viewed, toggleViewed } = useViewedFiles(reviewKey);

	const orderedFiles = useMemo(
		() =>
			getOrderedFiles(files, {
				statuses: statusFilter,
				categories: categoryFilter,
			}),
		[files, statusFilter, categoryFilter],
	);

	const loadFile = useCallback(
		async (path: string) => {
			if (!dataSource || inFlightRef.current.has(path)) return;
			const file = files.find((candidate) => candidate.path === path);
			if (!file || file.oldContent !== null || file.newContent !== null) return;
			inFlightRef.current.add(path);
			setLoadingPaths((current) => new Set(current).add(path));
			setErrors((current) => {
				const next = new Map(current);
				next.delete(path);
				return next;
			});

			try {
				const hydrated = await dataSource.ensureFile(path);
				setFiles((current) =>
					current.map((file) => (file.path === path ? hydrated : file)),
				);
			} catch (error) {
				setErrors((current) => {
					const next = new Map(current);
					next.set(
						path,
						error instanceof Error
							? error.message
							: "Failed to load file contents",
					);
					return next;
				});
			} finally {
				inFlightRef.current.delete(path);
				setLoadingPaths((current) => {
					const next = new Set(current);
					next.delete(path);
					return next;
				});
			}
		},
		[dataSource, files],
	);

	const handleSelect = useCallback(
		(path: string) => {
			setSelectedPath(path);
			if (orderedFiles.some((file) => file.path === path)) {
				feedRef.current?.scrollToPath(path);
				return;
			}
			pendingNavigationRef.current = { path };
			setStatusFilter(new Set());
			setCategoryFilter(new Set());
		},
		[orderedFiles],
	);

	const handleAnchorNavigation = useCallback(
		(anchor: CommentAnchor) => {
			setSelectedPath(anchor.path);
			if (orderedFiles.some((file) => file.path === anchor.path)) {
				feedRef.current?.scrollToAnchor(anchor);
				return;
			}
			pendingNavigationRef.current = { path: anchor.path, anchor };
			setStatusFilter(new Set());
			setCategoryFilter(new Set());
		},
		[orderedFiles],
	);

	const closeJumper = useCallback(() => setJumperOpen(false), []);
	const handleModeChange = useCallback((next: ViewMode) => {
		startModeTransition(() => setMode(next));
		try {
			window.localStorage.setItem("goreview-diff-mode", next);
		} catch {
			// Preference persistence is best-effort.
		}
	}, [startModeTransition]);

	const mergeComment = useCallback((comment: ReviewComment) => {
		setCommentThreads((current) => {
			const existing = current.find(
				(thread) => thread.rootId === comment.threadRootId,
			);
			if (!existing) {
				return [
					...current,
					{
						rootId: comment.threadRootId,
						anchor: comment.anchor,
						path: comment.anchor?.path ?? "",
						comments: [comment],
					},
				];
			}
			return current.map((thread) =>
				thread.rootId === comment.threadRootId
					? { ...thread, comments: [...thread.comments, comment] }
					: thread,
			);
		});
	}, []);

	const replaceComment = useCallback(
		(temporaryId: number, comment: ReviewComment) => {
			setCommentThreads((current) =>
				current.map((thread) => ({
					...thread,
					comments: thread.comments.map((candidate) =>
						candidate.id === temporaryId ? comment : candidate,
					),
				})),
			);
		},
		[],
	);

	const removeComment = useCallback((id: number) => {
		setCommentThreads((current) =>
			current
				.map((thread) => ({
					...thread,
					comments: thread.comments.filter((comment) => comment.id !== id),
				}))
				.filter((thread) => thread.comments.length > 0),
		);
	}, []);

	const createComment = useCallback(
		async (input: CreateCommentInput) => {
			if (!dataSource?.createComment) {
				throw new Error("Sign in with GitHub to comment.");
			}
			const temporaryId = -Date.now();
			const optimistic: ReviewComment = {
				id: temporaryId,
				threadRootId: temporaryId,
				anchor: input.anchor,
				body: input.body,
				author: "you",
				createdAt: new Date().toISOString(),
				outdated: false,
			};
			mergeComment(optimistic);
			try {
				const comment = await dataSource.createComment(input);
				setCommentThreads((current) =>
					current.map((thread) =>
						thread.rootId === temporaryId
							? {
									...thread,
									rootId: comment.threadRootId,
									anchor: comment.anchor,
									path: comment.anchor?.path ?? thread.path,
									comments: thread.comments.map((candidate) =>
										candidate.id === temporaryId ? comment : candidate,
									),
								}
							: thread,
					),
				);
				return comment;
			} catch (error) {
				removeComment(temporaryId);
				throw error;
			}
		},
		[dataSource, mergeComment, removeComment],
	);

	const replyToComment = useCallback(
		async (input: ReplyToCommentInput) => {
			if (!dataSource?.replyToComment) {
				throw new Error("Sign in with GitHub to reply.");
			}
			const temporaryId = -Date.now();
			const optimistic: ReviewComment = {
				id: temporaryId,
				threadRootId: input.rootId,
				anchor: null,
				body: input.body,
				author: "you",
				createdAt: new Date().toISOString(),
				outdated: false,
			};
			mergeComment(optimistic);
			try {
				const comment = await dataSource.replyToComment(input);
				replaceComment(temporaryId, comment);
				return comment;
			} catch (error) {
				removeComment(temporaryId);
				throw error;
			}
		},
		[dataSource, mergeComment, removeComment, replaceComment],
	);

	const viewedCount = useMemo(
		() => files.reduce((count, file) => count + (viewed.has(file.path) ? 1 : 0), 0),
		[files, viewed],
	);

	useEffect(() => {
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "k") {
				event.preventDefault();
				setJumperOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		const pending = pendingNavigationRef.current;
		if (
			!pending ||
			!orderedFiles.some((file) => file.path === pending.path)
		) {
			return;
		}
		pendingNavigationRef.current = null;
		const frame = window.requestAnimationFrame(() => {
			if (pending.anchor) feedRef.current?.scrollToAnchor(pending.anchor);
			else feedRef.current?.scrollToPath(pending.path);
		});
		return () => window.cancelAnimationFrame(frame);
	}, [orderedFiles]);

	useEffect(() => {
		if (!dataSource?.listCommentThreads) return;
		let cancelled = false;
		void dataSource
			.listCommentThreads()
			.then((threads) => {
				if (!cancelled) setCommentThreads(threads);
			})
			.catch(() => {
				// Diffs remain usable if comments cannot be loaded.
			});
		return () => {
			cancelled = true;
		};
	}, [dataSource]);

	useEffect(() => {
		if (!dataSource?.getIntelligence) return;
		let cancelled = false;
		void dataSource
			.getIntelligence()
			.then((result) => {
				if (!cancelled) setIntelligence(result);
			})
			.catch(() => {
				// The deterministic in-memory result remains visible.
			});
		return () => {
			cancelled = true;
		};
	}, [dataSource]);

	const generateIntelligence = useCallback(async () => {
		if (!dataSource?.generateIntelligence) return;
		setGeneratingIntelligence(true);
		try {
			setIntelligence(await dataSource.generateIntelligence());
		} catch (error) {
			setIntelligence((current) => ({
				...current,
				aiError:
					error instanceof Error
						? error.message
						: "AI review is temporarily unavailable.",
			}));
		} finally {
			setGeneratingIntelligence(false);
		}
	}, [dataSource]);

	const explainCode = useCallback(
		async (path: string, anchor?: CommentAnchor) => {
			if (!dataSource?.explainCode) return;
			const key = anchor
				? `${anchor.path}:${anchor.side}:${anchor.line}`
				: `file:${path}`;
			setExplainingKeys((current) => new Set(current).add(key));
			try {
				const explanation = await dataSource.explainCode({ path, anchor });
				if (anchor) {
					setLineExplanations((current) =>
						new Map(current).set(key, explanation),
					);
				} else {
					setFileExplanations((current) =>
						new Map(current).set(path, explanation),
					);
				}
			} catch (error) {
				setIntelligence((current) => ({
					...current,
					aiError:
						error instanceof Error
							? error.message
							: "Code explanation is temporarily unavailable.",
				}));
			} finally {
				setExplainingKeys((current) => {
					const next = new Set(current);
					next.delete(key);
					return next;
				});
			}
		},
		[dataSource],
	);

	return (
		<div className="review-workspace">
			<aside className="review-workspace__sidebar">
				<div className="review-brand">
					<p className="review-brand__name">Goreview</p>
					{source === "fixture" ? (
						<p className="review-brand__hint">Fixture demo</p>
					) : null}
				</div>
				<div className="review-progress" role="status">
					<div
						className="review-progress__bar"
						style={{
							width: `${files.length === 0 ? 0 : Math.round((viewedCount / files.length) * 100)}%`,
						}}
					/>
					<span className="review-progress__label">
						{viewedCount}/{files.length} viewed
					</span>
				</div>
				<FileTreeCompare
					files={files}
					selectedPath={selectedPath}
					onSelect={handleSelect}
					statusFilter={statusFilter}
					categoryFilter={categoryFilter}
					onStatusFilterChange={setStatusFilter}
					onCategoryFilterChange={setCategoryFilter}
					viewed={viewed}
				/>
			</aside>

			<main className="review-workspace__main">
				<div className="review-workspace__toolbar">
					<button
						type="button"
						className="jumper-trigger"
						onClick={() => setJumperOpen(true)}
					>
						Jump to file
						<kbd className="jumper-trigger__kbd">⌘K</kbd>
					</button>
					<span className="review-workspace__current-path">
						{selectedPath ?? "No file selected"}
					</span>
					<ThemeToggle />
				</div>

				<div className="review-workspace__content">
					<ReviewFeed
						ref={feedRef}
						snapshot={{ ...snapshot, files }}
						files={orderedFiles}
						mode={mode}
						viewed={viewed}
						loadingPaths={loadingPaths}
						errors={errors}
						onModeChange={handleModeChange}
						onVisiblePath={setSelectedPath}
						onNeedFile={(path) => void loadFile(path)}
						onToggleViewed={toggleViewed}
						commentThreads={commentThreads}
						onCreateComment={
							dataSource?.createComment ? createComment : undefined
						}
						onReplyToComment={
							dataSource?.replyToComment ? replyToComment : undefined
						}
						intelligence={intelligence}
						generatingIntelligence={generatingIntelligence}
						onGenerateIntelligence={
							dataSource?.generateIntelligence && intelligence.aiAvailable
								? () => void generateIntelligence()
								: undefined
						}
						onNavigateAnchor={handleAnchorNavigation}
						fileExplanations={fileExplanations}
						lineExplanations={lineExplanations}
						explainingKeys={explainingKeys}
						onExplainFile={
							dataSource?.explainCode
								? (path) => void explainCode(path)
								: undefined
						}
						onExplainLine={
							dataSource?.explainCode
								? (anchor) => void explainCode(anchor.path, anchor)
								: undefined
						}
					/>
				</div>
			</main>

			<FileJumper
				open={jumperOpen}
				files={files}
				onClose={closeJumper}
				onSelect={(path) => {
					handleSelect(path);
					closeJumper();
				}}
			/>
		</div>
	);
}

export default memo(ReviewWorkspace);
