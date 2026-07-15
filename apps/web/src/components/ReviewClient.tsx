"use client";

import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	changedFileSchema,
	commentThreadSchema,
	codeExplanationSchema,
	reviewCommentSchema,
	reviewIntelligenceSchema,
	reviewSnapshotSchema,
	type CreateCommentInput,
	type ChangedFile,
	type ReplyToCommentInput,
	type ReviewDataSource,
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

function ReadyReview({
	owner,
	repo,
	number,
	snapshot,
}: ReviewClientProps & { snapshot: ReviewSnapshot }) {
	const ensureFile = useCallback(
		async (path: string): Promise<ChangedFile> => {
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
		},
		[owner, repo, number],
	);

	const request = useCallback(
		async (url: string, init?: RequestInit): Promise<unknown> => {
			const response = await fetch(url, {
				credentials: "include",
				...init,
				headers: {
					"Content-Type": "application/json",
					...(init?.headers ?? {}),
				},
			});
			const body: unknown = await response.json();
			if (!response.ok) {
				const message =
					typeof body === "object" && body !== null && "error" in body
						? String((body as { error: unknown }).error)
						: `Request failed (${response.status})`;
				throw new Error(message);
			}
			return body;
		},
		[],
	);

	const dataSource = useMemo<ReviewDataSource>(
		() => ({
			ensureFile,
			async listCommentThreads() {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/comments`,
				)) as { threads: unknown[] };
				return body.threads.map((thread) => commentThreadSchema.parse(thread));
			},
			async createComment(input: CreateCommentInput) {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/comments`,
					{
						method: "POST",
						headers: { "x-goreview-action": "comment" },
						body: JSON.stringify({
							...input,
							expectedHeadSha: snapshot.headSha,
						}),
					},
				)) as { comment: unknown };
				return reviewCommentSchema.parse(body.comment);
			},
			async replyToComment(input: ReplyToCommentInput) {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/comments/${input.rootId}/replies`,
					{
						method: "POST",
						headers: { "x-goreview-action": "comment" },
						body: JSON.stringify({ body: input.body }),
					},
				)) as { comment: unknown };
				return reviewCommentSchema.parse(body.comment);
			},
			async getIntelligence() {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/intelligence`,
				)) as {
					intelligence: unknown;
					aiAvailable?: unknown;
					aiError?: unknown;
				};
				return {
					intelligence: reviewIntelligenceSchema.parse(body.intelligence),
					aiAvailable: body.aiAvailable === true,
					aiError:
						typeof body.aiError === "string" ? body.aiError : undefined,
				};
			},
			async generateIntelligence() {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/intelligence`,
					{
						method: "POST",
						headers: { "x-goreview-action": "intelligence" },
						body: JSON.stringify({ expectedHeadSha: snapshot.headSha }),
					},
				)) as {
					intelligence: unknown;
					aiError?: unknown;
				};
				return {
					intelligence: reviewIntelligenceSchema.parse(body.intelligence),
					aiAvailable: true,
					aiError:
						typeof body.aiError === "string" ? body.aiError : undefined,
				};
			},
			async explainCode(input) {
				const body = (await request(
					`/api/reviews/${owner}/${repo}/${number}/intelligence/explain`,
					{
						method: "POST",
						headers: { "x-goreview-action": "intelligence" },
						body: JSON.stringify({
							...input,
							expectedHeadSha: snapshot.headSha,
						}),
					},
				)) as { explanation: unknown };
				return codeExplanationSchema.parse(body.explanation);
			},
		}),
		[ensureFile, number, owner, repo, request, snapshot.headSha],
	);

	return (
		<Suspense
			fallback={<div className="app-shell__fallback">Loading workspace…</div>}
		>
			<ReviewWorkspace
				snapshot={snapshot}
				dataSource={dataSource}
				source="github"
			/>
		</Suspense>
	);
}

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

	return (
		<ReadyReview
			owner={owner}
			repo={repo}
			number={number}
			snapshot={state.snapshot}
		/>
	);
}
