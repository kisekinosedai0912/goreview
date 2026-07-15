"use client";

import { lazy, Suspense, useMemo } from "react";
import { withComputedDiffs } from "@goreview/core";
import { samplePr } from "@goreview/core/fixtures";

const ReviewWorkspace = lazy(
	() => import("@goreview/ui/components/ReviewWorkspace"),
);

export default function FixtureDemo() {
	const snapshot = useMemo(() => withComputedDiffs(samplePr), []);

	return (
		<Suspense
			fallback={<div className="app-shell__fallback">Loading demo…</div>}
		>
			<ReviewWorkspace snapshot={snapshot} source="fixture" />
		</Suspense>
	);
}
