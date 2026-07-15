import {
	commentAnchorSchema,
	isCommentableAnchor,
} from "@goreview/core";
import { NextResponse, type NextRequest } from "next/server";
import { hydrateReviewFile } from "@/lib/hydrate-review-file";
import {
	listReviewCommentThreads,
	toReviewComment,
} from "@/lib/review-comments";
import { resolveReviewWriteAuth } from "@/lib/review-auth";
import { getSnapshot, resolveAuth } from "@/lib/snapshot";

type Params = { owner: string; repo: string; number: string };

function parseNumber(value: string): number | null {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : null;
}

export async function GET(
	_request: NextRequest,
	context: { params: Promise<Params> },
) {
	const { owner, repo, number: numberParam } = await context.params;
	const number = parseNumber(numberParam);
	if (!number) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
	}
	const auth = await resolveAuth(owner, repo);
	if (!auth) {
		return NextResponse.json(
			{ error: "Sign in with GitHub to load review comments." },
			{ status: 401 },
		);
	}

	try {
		const threads = await listReviewCommentThreads(
			auth.octokit,
			owner,
			repo,
			number,
		);
		return NextResponse.json({ threads });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to load review comments.",
			},
			{ status: 502 },
		);
	}
}

export async function POST(
	request: NextRequest,
	context: { params: Promise<Params> },
) {
	if (request.headers.get("x-goreview-action") !== "comment") {
		return NextResponse.json({ error: "Missing action header." }, { status: 403 });
	}
	const { owner, repo, number: numberParam } = await context.params;
	const number = parseNumber(numberParam);
	if (!number) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
	}
	const auth = await resolveReviewWriteAuth();
	if (!auth) {
		return NextResponse.json(
			{
				error:
					"Commenting requires GitHub sign-in (or a write-capable GITHUB_TOKEN in local development).",
			},
			{ status: 401 },
		);
	}

	const raw: unknown = await request.json();
	const input =
		typeof raw === "object" && raw !== null
			? (raw as {
					anchor?: unknown;
					body?: unknown;
					expectedHeadSha?: unknown;
				})
			: {};
	const anchor = commentAnchorSchema.safeParse(input.anchor);
	const body = typeof input.body === "string" ? input.body.trim() : "";
	const expectedHeadSha =
		typeof input.expectedHeadSha === "string" ? input.expectedHeadSha : "";
	if (!anchor.success || !body || body.length > 65_536 || !expectedHeadSha) {
		return NextResponse.json(
			{ error: "Invalid comment body or line anchor." },
			{ status: 400 },
		);
	}

	try {
		const { data: pull } = await auth.octokit.rest.pulls.get({
			owner,
			repo,
			pull_number: number,
		});
		if (pull.head.sha !== expectedHeadSha) {
			return NextResponse.json(
				{
					error:
						"The pull request changed since this diff loaded. Refresh before commenting.",
					headSha: pull.head.sha,
				},
				{ status: 409 },
			);
		}

		const snapshot = await getSnapshot(auth.octokit, owner, repo, number);
		const file = await hydrateReviewFile(
			auth.octokit,
			owner,
			repo,
			snapshot,
			anchor.data.path,
		);
		if (!file || !isCommentableAnchor(file, anchor.data)) {
			return NextResponse.json(
				{ error: "That line is not commentable in the current pull request diff." },
				{ status: 422 },
			);
		}

		const { data } = await auth.octokit.rest.pulls.createReviewComment({
			owner,
			repo,
			pull_number: number,
			commit_id: pull.head.sha,
			path: anchor.data.path,
			line: anchor.data.line,
			side: anchor.data.side,
			body,
		});
		return NextResponse.json({ comment: toReviewComment(data) }, { status: 201 });
	} catch (error) {
		const status =
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			typeof error.status === "number"
				? error.status
				: 502;
		return NextResponse.json(
			{
				error:
					status === 422
						? "GitHub rejected this line anchor. The diff may have changed; refresh and try again."
						: error instanceof Error
							? error.message
							: "Failed to post review comment.",
			},
			{ status },
		);
	}
}
