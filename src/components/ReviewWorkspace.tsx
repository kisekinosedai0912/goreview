import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { explainEvents } from "../lib/explain";
import { groupByCategory } from "../lib/group-by-category";
import type { ReviewSnapshot } from "../schemas/review";
import FileTree from "./FileTree";
import ReviewMeta from "./ReviewMeta";
import ThemeToggle from "./ThemeToggle";

const ComparisonStack = lazy(() => import("./ComparisonStack"));
const ExplanationList = lazy(() => import("./ExplanationList"));

type ReviewWorkspaceProps = {
	snapshot: ReviewSnapshot;
};

function ReviewWorkspace({ snapshot }: ReviewWorkspaceProps) {
	const [selectedPath, setSelectedPath] = useState<string | null>(
		snapshot.files[0]?.path ?? null,
	);

	const groups = useMemo(
		() => groupByCategory(snapshot.files),
		[snapshot.files],
	);

	const selectedFile = useMemo(
		() => snapshot.files.find((file) => file.path === selectedPath) ?? null,
		[snapshot.files, selectedPath],
	);

	const explanations = useMemo(
		() => (selectedFile ? explainEvents(selectedFile.events) : []),
		[selectedFile],
	);

	const handleSelect = useCallback((path: string) => {
		setSelectedPath(path);
	}, []);

	return (
		<div className="review-workspace">
			<aside className="review-workspace__sidebar">
				<div className="review-brand">
					<p className="review-brand__name">Goreview</p>
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
						<ReviewMeta snapshot={snapshot} />

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

								<Suspense
									fallback={<div className="panel-fallback">Loading comparison…</div>}
								>
									<ComparisonStack file={selectedFile} />
								</Suspense>

								<Suspense
									fallback={<div className="panel-fallback">Loading changes…</div>}
								>
									<ExplanationList explanations={explanations} />
								</Suspense>
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
