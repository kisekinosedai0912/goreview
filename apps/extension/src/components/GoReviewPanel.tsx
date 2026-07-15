import { lazy, Suspense, useEffect, useState } from "react";
import { browser } from "#imports";
import {
	changedFileSchema,
	reviewSnapshotSchema,
	type ChangedFile,
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

	const ensureFile = async (path: string): Promise<ChangedFile> => {
		const response = await sendMessage({
			type: "goreview:file",
			owner,
			repo,
			number,
			path,
		});
		if (!response.ok) throw new Error(response.error);
		return changedFileSchema.parse((response.data as { file: unknown }).file);
	};

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
							dataSource={{ ensureFile }}
							source="github"
						/>
					</Suspense>
				)}
			</div>
		</div>
	);
}
