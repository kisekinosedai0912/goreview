import {
	commentThreadSchema,
	reviewCommentSchema,
	type CommentAnchor,
	type CommentThread,
	type ReviewComment,
} from "@goreview/core";
import type { Octokit } from "octokit";

type GitHubComment = Awaited<
	ReturnType<Octokit["rest"]["pulls"]["createReviewComment"]>
>["data"];

function sideOf(value: unknown): "LEFT" | "RIGHT" | null {
	return value === "LEFT" || value === "RIGHT" ? value : null;
}

export function toReviewComment(comment: GitHubComment): ReviewComment {
	const side = sideOf(comment.side);
	const line = comment.line ?? null;
	const anchor: CommentAnchor | null =
		side && line
			? {
					path: comment.path,
					side,
					line,
				}
			: null;
	const rootId = comment.in_reply_to_id ?? comment.id;

	return reviewCommentSchema.parse({
		id: comment.id,
		threadRootId: rootId,
		anchor,
		body: comment.body,
		author: comment.user?.login ?? "ghost",
		authorAvatarUrl: comment.user?.avatar_url ?? undefined,
		createdAt: comment.created_at,
		htmlUrl: comment.html_url,
		outdated: comment.position === null,
	});
}

export function groupCommentThreads(
	comments: GitHubComment[],
): CommentThread[] {
	const grouped = new Map<number, ReviewComment[]>();
	const paths = new Map<number, string>();
	for (const raw of comments) {
		const comment = toReviewComment(raw);
		const existing = grouped.get(comment.threadRootId) ?? [];
		existing.push(comment);
		grouped.set(comment.threadRootId, existing);
		paths.set(comment.threadRootId, raw.path);
	}

	return [...grouped.entries()].map(([rootId, threadComments]) => {
		const root =
			threadComments.find((comment) => comment.id === rootId) ??
			threadComments[0]!;
		return commentThreadSchema.parse({
			rootId,
			anchor: root.anchor,
			path: root.anchor?.path ?? paths.get(rootId) ?? "",
			comments: threadComments.sort((a, b) =>
				a.createdAt.localeCompare(b.createdAt),
			),
		});
	});
}

export async function listReviewCommentThreads(
	octokit: Octokit,
	owner: string,
	repo: string,
	number: number,
): Promise<CommentThread[]> {
	const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
		owner,
		repo,
		pull_number: number,
		per_page: 100,
	});
	return groupCommentThreads(comments as GitHubComment[]);
}
