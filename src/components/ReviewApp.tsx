import { Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import {
	canLoadFromGitHub,
	loadReview,
	type LoadReviewResult,
} from "@/loaders/load-review";
import type { ChangedFile, ReviewSnapshot } from "@/schemas/review";

type ReviewWorkspaceProps = {
	snapshot: ReviewSnapshot;
	ensureFile?: (path: string) => Promise<ChangedFile>;
	source?: "github" | "fixture";
	ComparisonStack: LazyExoticComponent<
		ComponentType<{ file: ChangedFile }>
	>;
	ExplanationList: LazyExoticComponent<
		ComponentType<{ explanations: import("@/schemas/review").Explanation[] }>
	>;
};

type ReviewAppProps = {
	ReviewWorkspace: LazyExoticComponent<ComponentType<ReviewWorkspaceProps>>;
	ComparisonStack: ReviewWorkspaceProps["ComparisonStack"];
	ExplanationList: ReviewWorkspaceProps["ExplanationList"];
};

function ReviewApp({
	ReviewWorkspace,
	ComparisonStack,
	ExplanationList,
}: ReviewAppProps) {
	const [result, setResult] = useState<LoadReviewResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		loadReview()
			.then((loaded: LoadReviewResult) => {
				if (!cancelled) setResult(loaded);
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load review");
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		return (
			<div className="review-workspace__empty">
				<p>{error}</p>
				{canLoadFromGitHub() ? null : (
					<p className="review-load-hint">
						Set VITE_GITHUB_TOKEN and PR coordinates, or use fixture mode.
					</p>
				)}
			</div>
		);
	}

	if (!result) {
		return <div className="app-shell__fallback">Loading review data…</div>;
	}

	return (
		<Suspense fallback={<div className="app-shell__fallback">Loading workspace…</div>}>
			<ReviewWorkspace
				snapshot={result.snapshot}
				ensureFile={result.ensureFile}
				source={result.source}
				ComparisonStack={ComparisonStack}
				ExplanationList={ExplanationList}
			/>
		</Suspense>
	);
}

export default ReviewApp;
