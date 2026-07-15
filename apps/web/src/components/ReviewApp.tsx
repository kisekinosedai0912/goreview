import { lazy, Suspense, useEffect, useState } from "react";
import {
	canLoadFromGitHub,
	loadReview,
	type LoadReviewResult,
} from "@/loaders/load-review";

const ReviewWorkspace = lazy(
	() => import("@goreview/ui/components/ReviewWorkspace"),
);

function ReviewApp() {
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
			/>
		</Suspense>
	);
}

export default ReviewApp;
