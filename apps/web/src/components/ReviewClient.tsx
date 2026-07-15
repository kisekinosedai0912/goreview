"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import {
	changedFileSchema,
	reviewSnapshotSchema,
	type ChangedFile,
	type ReviewSnapshot,
} from "@goreview/core";

const ReviewWorkspace = lazy(
	() => import("@goreview/ui/components/ReviewWorkspace"),
);

type ReviewClientProps = {
	owner: string;
	repo: string;
	number: number;
};

type LoadState =
	| { phase: "loading" }
	| { phase: "error"; message: string; unauthorized: boolean }
	| { phase: "ready"; snapshot: ReviewSnapshot };

export default function ReviewClient({ owner, repo, number }: ReviewClientProps) {
	const [state, setState] = useState<LoadState>({ phase: "loading" });

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const response = await fetch(
					`/api/snapshot/${owner}/${repo}/${number}`,
					{ credentials: "include" },
				);
				const body: unknown = await response.json();

				if (!response.ok) {
					const message =
						typeof body === "object" && body !== null && "error" in body
							? String((body as { error: unknown }).error)
							: `Request failed (${response.status})`;
					if (!cancelled) {
						setState({
							phase: "error",
							message,
							unauthorized: response.status === 401,
						});
					}
					return;
				}

				const snapshot = reviewSnapshotSchema.parse(
					(body as { snapshot: unknown }).snapshot,
				);
				if (!cancelled) setState({ phase: "ready", snapshot });
			} catch (error) {
				if (!cancelled) {
					setState({
						phase: "error",
						message:
							error instanceof Error ? error.message : "Failed to load review",
						unauthorized: false,
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [owner, repo, number]);

	if (state.phase === "loading") {
		return (
			<div className="app-shell__fallback">
				Loading {owner}/{repo}#{number}…
			</div>
		);
	}

	if (state.phase === "error") {
		return (
			<div className="review-workspace__empty">
				<div>
					<p>{state.message}</p>
					{state.unauthorized ? (
						<p className="review-load-hint">
							<a
								href={`/api/auth/login?return_to=/r/${owner}/${repo}/${number}`}
							>
								Sign in with GitHub
							</a>{" "}
							to view this pull request.
						</p>
					) : null}
				</div>
			</div>
		);
	}

	const ensureFile = async (path: string): Promise<ChangedFile> => {
		const response = await fetch(
			`/api/snapshot/${owner}/${repo}/${number}/file?path=${encodeURIComponent(path)}`,
			{ credentials: "include" },
		);
		const body: unknown = await response.json();
		if (!response.ok) {
			const message =
				typeof body === "object" && body !== null && "error" in body
					? String((body as { error: unknown }).error)
					: "Failed to load file";
			throw new Error(message);
		}
		return changedFileSchema.parse((body as { file: unknown }).file);
	};

	return (
		<Suspense
			fallback={<div className="app-shell__fallback">Loading workspace…</div>}
		>
			<ReviewWorkspace
				snapshot={state.snapshot}
				ensureFile={ensureFile}
				source="github"
			/>
		</Suspense>
	);
}
