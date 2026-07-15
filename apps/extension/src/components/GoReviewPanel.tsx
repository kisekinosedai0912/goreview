import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { browser } from "#imports";
import {
	changedFileSchema,
	codeExplanationSchema,
	commentThreadSchema,
	reviewCommentSchema,
	reviewIntelligenceSchema,
	reviewSnapshotSchema,
	type CreateCommentInput,
	type ChangedFile,
	type ReplyToCommentInput,
	type ReviewDataSource,
	type ReviewSnapshot,
} from "@goreview/core";
import type { BackendResponse, ExtensionMessage } from "../lib/messages";
import { getBackendUrl } from "../lib/settings";

const ReviewWorkspace = lazy(
	() => import("@goreview/ui/components/ReviewWorkspace"),
);

type PanelProps = {
	owner: string;
	repo: string;
	number: number;
	onClose: () => void;
};

type PanelState =
	| { phase: "loading" }
	| { phase: "error"; message: string; unauthorized: boolean; backend: string }
	| { phase: "ready"; snapshot: ReviewSnapshot };

function sendMessage(message: ExtensionMessage): Promise<BackendResponse> {
	return browser.runtime.sendMessage(message) as Promise<BackendResponse>;
}

export default function GoReviewPanel({
	owner,
	repo,
	number,
	onClose,
}: PanelProps) {
	const [state, setState] = useState<PanelState>({ phase: "loading" });

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const backend = await getBackendUrl();
			const response = await sendMessage({
				type: "goreview:snapshot",
				owner,
				repo,
				number,
			});
			if (cancelled) return;

			if (!response.ok) {
				setState({
					phase: "error",
					message: response.error,
					unauthorized: response.status === 401,
					backend,
				});
				return;
			}

			try {
				const snapshot = reviewSnapshotSchema.parse(
					(response.data as { snapshot: unknown }).snapshot,
				);
				setState({ phase: "ready", snapshot });
			} catch {
				setState({
					phase: "error",
					message: "Backend returned an unexpected snapshot shape.",
					unauthorized: false,
					backend,
				});
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [owner, repo, number]);

	const ensureFile = useCallback(
		async (path: string): Promise<ChangedFile> => {
			const response = await sendMessage({
				type: "goreview:file",
				owner,
				repo,
				number,
				path,
			});
			if (!response.ok) throw new Error(response.error);
			return changedFileSchema.parse((response.data as { file: unknown }).file);
		},
		[number, owner, repo],
	);

	const dataSource = useMemo<ReviewDataSource>(
		() => ({
			ensureFile,
			async listCommentThreads() {
				const response = await sendMessage({
					type: "goreview:comments:list",
					owner,
					repo,
					number,
				});
				if (!response.ok) throw new Error(response.error);
				return (response.data as { threads: unknown[] }).threads.map((thread) =>
					commentThreadSchema.parse(thread),
				);
			},
			async createComment(input: CreateCommentInput) {
				if (state.phase !== "ready") throw new Error("Review is not loaded.");
				const response = await sendMessage({
					type: "goreview:comments:create",
					owner,
					repo,
					number,
					...input,
					expectedHeadSha: state.snapshot.headSha,
				});
				if (!response.ok) throw new Error(response.error);
				return reviewCommentSchema.parse(
					(response.data as { comment: unknown }).comment,
				);
			},
			async replyToComment(input: ReplyToCommentInput) {
				const response = await sendMessage({
					type: "goreview:comments:reply",
					owner,
					repo,
					number,
					rootId: input.rootId,
					body: input.body,
				});
				if (!response.ok) throw new Error(response.error);
				return reviewCommentSchema.parse(
					(response.data as { comment: unknown }).comment,
				);
			},
			async getIntelligence() {
				const response = await sendMessage({
					type: "goreview:intelligence",
					owner,
					repo,
					number,
					generate: false,
				});
				if (!response.ok) throw new Error(response.error);
				const body = response.data as {
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
				if (state.phase !== "ready") throw new Error("Review is not loaded.");
				const response = await sendMessage({
					type: "goreview:intelligence",
					owner,
					repo,
					number,
					generate: true,
					expectedHeadSha: state.snapshot.headSha,
				});
				if (!response.ok) throw new Error(response.error);
				const body = response.data as {
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
				if (state.phase !== "ready") throw new Error("Review is not loaded.");
				const response = await sendMessage({
					type: "goreview:explain",
					owner,
					repo,
					number,
					path: input.path,
					anchor: input.anchor,
					expectedHeadSha: state.snapshot.headSha,
				});
				if (!response.ok) throw new Error(response.error);
				return codeExplanationSchema.parse(
					(response.data as { explanation: unknown }).explanation,
				);
			},
		}),
		[ensureFile, number, owner, repo, state],
	);

	return (
		<div className="goreview-root">
			<div className="goreview-root__bar">
				<span className="goreview-root__title">GoReview</span>
				<span className="goreview-root__pr">
					{owner}/{repo}#{number}
				</span>
				<button type="button" className="goreview-root__close" onClick={onClose}>
					Close ✕
				</button>
			</div>
			<div className="goreview-root__body">
				{state.phase === "loading" ? (
					<div className="goreview-root__status">
						Loading review from the goreview backend…
					</div>
				) : state.phase === "error" ? (
					<div className="goreview-root__status">
						<div>
							<p>{state.message}</p>
							{state.unauthorized ? (
								<p>
									<a
										href={`${state.backend}/api/auth/login?return_to=/r/${owner}/${repo}/${number}`}
										target="_blank"
										rel="noreferrer"
									>
										Sign in to GoReview
									</a>{" "}
									in a new tab, then close and reopen this panel.
								</p>
							) : null}
						</div>
					</div>
				) : (
					<Suspense
						fallback={
							<div className="goreview-root__status">Loading workspace…</div>
						}
					>
						<ReviewWorkspace
							snapshot={state.snapshot}
							dataSource={dataSource}
							source="github"
						/>
					</Suspense>
				)}
			</div>
		</div>
	);
}
