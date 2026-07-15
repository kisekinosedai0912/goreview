import {
	buildAnnotations,
	buildReviewReport,
	type ReviewSnapshot,
} from "@goreview/core";
import type { Octokit } from "octokit";
import { optionalEnv } from "./env";
import { getSnapshot } from "./snapshot";

const STICKY_MARKER = "<!-- goreview-summary -->";
const CHECK_NAME = "GoReview";

export type PullRequestTarget = {
	owner: string;
	repo: string;
	number: number;
	headSha: string;
};

function reviewUrl(target: PullRequestTarget): string | undefined {
	const base = optionalEnv("APP_URL");
	if (!base) return undefined;
	return `${base.replace(/\/$/, "")}/r/${target.owner}/${target.repo}/${target.number}`;
}

async function upsertStickyComment(
	octokit: Octokit,
	target: PullRequestTarget,
	body: string,
): Promise<void> {
	const { owner, repo, number } = target;

	const comments = await octokit.paginate(octokit.rest.issues.listComments, {
		owner,
		repo,
		issue_number: number,
		per_page: 100,
	});
	const existing = comments.find((comment) =>
		comment.body?.includes(STICKY_MARKER),
	);

	if (existing) {
		await octokit.rest.issues.updateComment({
			owner,
			repo,
			comment_id: existing.id,
			body,
		});
	} else {
		await octokit.rest.issues.createComment({
			owner,
			repo,
			issue_number: number,
			body,
		});
	}
}

/**
 * The whole bot pass for one PR head: compute (or reuse cached) snapshot,
 * publish a check run with the tree summary + annotations, and keep a
 * single summary comment up to date.
 */
export async function runReviewBot(
	octokit: Octokit,
	target: PullRequestTarget,
): Promise<{ snapshot: ReviewSnapshot }> {
	const { owner, repo, number, headSha } = target;

	const inProgress = await octokit.rest.checks.create({
		owner,
		repo,
		name: CHECK_NAME,
		head_sha: headSha,
		status: "in_progress",
	});

	try {
		const snapshot = await getSnapshot(octokit, owner, repo, number);
		const report = buildReviewReport(snapshot, { reviewUrl: reviewUrl(target) });
		const annotations = buildAnnotations(snapshot);

		await octokit.rest.checks.update({
			owner,
			repo,
			check_run_id: inProgress.data.id,
			status: "completed",
			conclusion: "neutral",
			output: {
				title: report.title,
				summary: report.summary,
				annotations,
			},
		});

		await upsertStickyComment(
			octokit,
			target,
			`${STICKY_MARKER}\n## GoReview\n\n${report.summary}`,
		);

		return { snapshot };
	} catch (error) {
		await octokit.rest.checks
			.update({
				owner,
				repo,
				check_run_id: inProgress.data.id,
				status: "completed",
				conclusion: "failure",
				output: {
					title: "GoReview failed",
					summary:
						error instanceof Error ? error.message : "Unknown error while analyzing the PR.",
				},
			})
			.catch(() => {});
		throw error;
	}
}
