import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
	resolveWrite: vi.fn(),
	resolveRead: vi.fn(),
	getSnapshot: vi.fn(),
	hydrateFile: vi.fn(),
	listThreads: vi.fn(),
	toComment: vi.fn(),
}));

vi.mock("@/lib/review-auth", () => ({
	resolveReviewWriteAuth: mocks.resolveWrite,
}));
vi.mock("@/lib/snapshot", () => ({
	resolveAuth: mocks.resolveRead,
	getSnapshot: mocks.getSnapshot,
}));
vi.mock("@/lib/hydrate-review-file", () => ({
	hydrateReviewFile: mocks.hydrateFile,
}));
vi.mock("@/lib/review-comments", () => ({
	listReviewCommentThreads: mocks.listThreads,
	toReviewComment: mocks.toComment,
}));

import {
	GET,
	POST,
} from "../../app/api/reviews/[owner]/[repo]/[number]/comments/route";
import { POST as POST_REPLY } from "../../app/api/reviews/[owner]/[repo]/[number]/comments/[commentId]/replies/route";

const params = Promise.resolve({ owner: "acme", repo: "app", number: "7" });
const anchor = { path: "src/user.ts", side: "RIGHT" as const, line: 2 };
const file = {
	path: "src/user.ts",
	status: "modified" as const,
	oldContent: "old\n",
	newContent: "old\nnew\n",
	categories: ["backend" as const],
	events: [],
	diff: {
		hunks: [
			{
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 2,
				lines: [
					{
						type: "context" as const,
						oldNumber: 1,
						newNumber: 1,
						content: "old",
					},
					{
						type: "added" as const,
						oldNumber: null,
						newNumber: 2,
						content: "new",
					},
				],
			},
		],
		additions: 1,
		deletions: 0,
		oldLineCount: 1,
		newLineCount: 2,
	},
};
const snapshot = {
	baseSha: "base",
	headSha: "head",
	title: "Change user",
	repo: "acme/app",
	baseBranch: "main",
	headBranch: "feature",
	files: [file],
};

function request(body: unknown): NextRequest {
	return new NextRequest("http://localhost/api/comments", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-goreview-action": "comment",
		},
		body: JSON.stringify(body),
	});
}

describe("review comments API", () => {
	const getPull = vi.fn();
	const createReviewComment = vi.fn();
	const createReplyForReviewComment = vi.fn();
	const octokit = {
		rest: {
			pulls: {
				get: getPull,
				createReviewComment,
				createReplyForReviewComment,
			},
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolveWrite.mockResolvedValue({
			kind: "user",
			octokit,
			login: "reviewer",
		});
		mocks.resolveRead.mockResolvedValue({ kind: "user", octokit });
		mocks.getSnapshot.mockResolvedValue(snapshot);
		mocks.hydrateFile.mockResolvedValue(file);
		getPull.mockResolvedValue({ data: { head: { sha: "head" } } });
		mocks.toComment.mockReturnValue({
			id: 10,
			threadRootId: 10,
			anchor,
			body: "Looks good",
			author: "reviewer",
			createdAt: "2026-07-15T00:00:00Z",
			outdated: false,
		});
	});

	it("lists existing threads with read authentication", async () => {
		mocks.listThreads.mockResolvedValue([{ rootId: 10 }]);
		const response = await GET(
			new NextRequest("http://localhost/api/comments"),
			{ params },
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ threads: [{ rootId: 10 }] });
		expect(mocks.listThreads).toHaveBeenCalledWith(octokit, "acme", "app", 7);
	});

	it("posts the exact GitHub line-comment payload as the user", async () => {
		createReviewComment.mockResolvedValue({ data: { id: 10 } });
		const response = await POST(
			request({ anchor, body: "Looks good", expectedHeadSha: "head" }),
			{ params },
		);
		expect(response.status).toBe(201);
		expect(createReviewComment).toHaveBeenCalledWith({
			owner: "acme",
			repo: "app",
			pull_number: 7,
			commit_id: "head",
			path: "src/user.ts",
			line: 2,
			side: "RIGHT",
			body: "Looks good",
		});
	});

	it("refuses stale heads before posting", async () => {
		getPull.mockResolvedValue({ data: { head: { sha: "new-head" } } });
		const response = await POST(
			request({ anchor, body: "Comment", expectedHeadSha: "head" }),
			{ params },
		);
		expect(response.status).toBe(409);
		expect(createReviewComment).not.toHaveBeenCalled();
	});

	it("turns GitHub anchor errors into actionable 422 responses", async () => {
		createReviewComment.mockRejectedValue({ status: 422 });
		const response = await POST(
			request({ anchor, body: "Comment", expectedHeadSha: "head" }),
			{ params },
		);
		expect(response.status).toBe(422);
		expect((await response.json()).error).toMatch(/refresh/i);
	});

	it("never writes without user or local-token authentication", async () => {
		mocks.resolveWrite.mockResolvedValue(null);
		const response = await POST(
			request({ anchor, body: "Comment", expectedHeadSha: "head" }),
			{ params },
		);
		expect(response.status).toBe(401);
		expect(createReviewComment).not.toHaveBeenCalled();
	});

	it("replies to the top-level review thread", async () => {
		createReplyForReviewComment.mockResolvedValue({ data: { id: 11 } });
		const response = await POST_REPLY(request({ body: "Agreed" }), {
			params: Promise.resolve({
				owner: "acme",
				repo: "app",
				number: "7",
				commentId: "10",
			}),
		});
		expect(response.status).toBe(201);
		expect(createReplyForReviewComment).toHaveBeenCalledWith({
			owner: "acme",
			repo: "app",
			pull_number: 7,
			comment_id: 10,
			body: "Agreed",
		});
	});
});
