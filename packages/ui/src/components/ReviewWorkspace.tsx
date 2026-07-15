import { memo, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType, type LazyExoticComponent } from "react";
import {
	explainEvents,
	groupByCategory,
	type ChangedFile,
	type Explanation,
	type ReviewSnapshot,
} from "@goreview/core";
import FileTree from "./FileTree";
import ReviewMeta from "./ReviewMeta";
import ThemeToggle from "./ThemeToggle";

type ReviewWorkspaceProps = {
	snapshot: ReviewSnapshot;
	ensureFile?: (path: string) => Promise<ChangedFile>;
	source?: "github" | "fixture";
	ComparisonStack: LazyExoticComponent<ComponentType<{ file: ChangedFile }>>;
	ExplanationList: LazyExoticComponent<ComponentType<{ explanations: Explanation[] }>>;
};

function needsFileLoad(file: ChangedFile | undefined): boolean {
	if (!file) return false;
	return file.oldContent === null && file.newContent === null;
}

function ReviewWorkspace({
	snapshot,
	ensureFile,
	source = "fixture",
	ComparisonStack,
	ExplanationList,
}: ReviewWorkspaceProps) {
	const [selectedPath, setSelectedPath] = useState<string | null>(
		snapshot.files[0]?.path ?? null,
	);
	const [files, setFiles] = useState(snapshot.files);
	const [loadingPath, setLoadingPath] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

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

	const groups = useMemo(() => groupByCategory(files), [files]);

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

	const handleSelect = useCallback((path: string) => {
		setSelectedPath(path);
		setLoadError(null);
	}, []);

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
				<FileTree
					groups={groups}
					selectedPath={selectedPath}
					onSelect={handleSelect}
				/>
			</aside>

			<main className="review-workspace__main">
				<div className="review-workspace__toolbar">
					<ThemeToggle />
				</div>

				<div className="review-workspace__content">
					<div className="review-scroll">
						<ReviewMeta snapshot={{ ...snapshot, files }} />

						{selectedFile ? (
							<div key={selectedPath} className="review-scroll__body">
								<div className="review-scroll__file">
									<p
										className="review-scroll__status"
										data-status={selectedFile.status}
									>
										{selectedFile.status}
									</p>
									<h2 className="review-scroll__path">{selectedFile.path}</h2>
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
											<ComparisonStack file={selectedFile} />
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
		</div>
	);
}

export default memo(ReviewWorkspace);
