import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	explainEvents,
	type ChangedFile,
	type ReviewSnapshot,
} from "@goreview/core";
import FileJumper from "./FileJumper";
import FileTreeCompare from "./FileTreeCompare";
import ReviewMeta from "./ReviewMeta";
import ThemeToggle from "./ThemeToggle";
import { useViewedFiles } from "../lib/use-viewed-files";

const DiffViewer = lazy(() => import("./DiffViewer"));
const ExplanationList = lazy(() => import("./ExplanationList"));

type ReviewWorkspaceProps = {
	snapshot: ReviewSnapshot;
	ensureFile?: (path: string) => Promise<ChangedFile>;
	source?: "github" | "fixture";
};

function needsFileLoad(file: ChangedFile | undefined): boolean {
	if (!file) return false;
	return file.oldContent === null && file.newContent === null;
}

function ReviewWorkspace({
	snapshot,
	ensureFile,
	source = "fixture",
}: ReviewWorkspaceProps) {
	const [selectedPath, setSelectedPath] = useState<string | null>(
		snapshot.files[0]?.path ?? null,
	);
	const [files, setFiles] = useState(snapshot.files);
	const [loadingPath, setLoadingPath] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [jumperOpen, setJumperOpen] = useState(false);

	// Reset state during render when a new snapshot arrives (avoids an
	// extra effect-driven render pass).
	const [prevSnapshot, setPrevSnapshot] = useState(snapshot);
	if (prevSnapshot !== snapshot) {
		setPrevSnapshot(snapshot);
		setFiles(snapshot.files);
		setSelectedPath(snapshot.files[0]?.path ?? null);
		setLoadingPath(null);
		setLoadError(null);
	}

	const reviewKey = `${snapshot.repo}#${snapshot.headSha}`;
	const { viewed, toggleViewed } = useViewedFiles(reviewKey);

	const selectedFile = useMemo(
		() => files.find((file) => file.path === selectedPath) ?? null,
		[files, selectedPath],
	);

	const explanations = useMemo(
		() => (selectedFile ? explainEvents(selectedFile.events) : []),
		[selectedFile],
	);

	const loadFile = useCallback(
		async (path: string) => {
			if (!ensureFile) return;

			setLoadingPath(path);
			setLoadError(null);

			try {
				const hydrated = await ensureFile(path);
				setFiles((current) =>
					current.map((file) => (file.path === path ? hydrated : file)),
				);
			} catch (error) {
				setLoadError(
					error instanceof Error ? error.message : "Failed to load file contents",
				);
			} finally {
				setLoadingPath(null);
			}
		},
		[ensureFile],
	);

	useEffect(() => {
		if (!selectedPath || !ensureFile) return;
		const file = files.find((item) => item.path === selectedPath);
		if (!needsFileLoad(file)) return;
		// Defer so the fetch's state updates never run synchronously in
		// the effect body (they'd cascade a render).
		let cancelled = false;
		queueMicrotask(() => {
			if (!cancelled) void loadFile(selectedPath);
		});
		return () => {
			cancelled = true;
		};
	}, [selectedPath, ensureFile, files, loadFile]);

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

	const handleSelect = useCallback((path: string) => {
		setSelectedPath(path);
		setLoadError(null);
	}, []);

	const closeJumper = useCallback(() => setJumperOpen(false), []);

	const viewedCount = useMemo(
		() => files.reduce((count, file) => count + (viewed.has(file.path) ? 1 : 0), 0),
		[files, viewed],
	);

	const isLoadingFile = loadingPath !== null && loadingPath === selectedPath;

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
					<ThemeToggle />
				</div>

				<div className="review-workspace__content">
					<div className="review-scroll">
						<ReviewMeta snapshot={{ ...snapshot, files }} />

						{selectedFile ? (
							<div key={selectedPath} className="review-scroll__body">
								<div className="review-scroll__file">
									<div className="review-scroll__file-info">
										<p
											className="review-scroll__status"
											data-status={selectedFile.status}
										>
											{selectedFile.status}
											{selectedFile.oldPath
												? ` from ${selectedFile.oldPath}`
												: ""}
										</p>
										<h2 className="review-scroll__path">{selectedFile.path}</h2>
									</div>
									<label className="viewed-toggle">
										<input
											type="checkbox"
											checked={viewed.has(selectedFile.path)}
											onChange={() => toggleViewed(selectedFile.path)}
										/>
										<span>Viewed</span>
									</label>
								</div>

								{loadError ? (
									<p className="panel-fallback">{loadError}</p>
								) : isLoadingFile ? (
									<p className="panel-fallback">Loading file contents…</p>
								) : (
									<>
										<Suspense
											fallback={
												<div className="panel-fallback">Loading comparison…</div>
											}
										>
											<DiffViewer file={selectedFile} />
										</Suspense>

										<Suspense
											fallback={
												<div className="panel-fallback">Loading changes…</div>
											}
										>
											<ExplanationList explanations={explanations} />
										</Suspense>
									</>
								)}
							</div>
						) : (
							<div className="review-workspace__empty">
								<p>Select a file from the comparison tree to review changes.</p>
							</div>
						)}
					</div>
				</div>
			</main>

			<FileJumper
				open={jumperOpen}
				files={files}
				onClose={closeJumper}
				onSelect={handleSelect}
			/>
		</div>
	);
}

export default memo(ReviewWorkspace);
