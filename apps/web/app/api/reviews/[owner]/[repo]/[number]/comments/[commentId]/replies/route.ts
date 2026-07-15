import { NextResponse, type NextRequest } from "next/server";
import { toReviewComment } from "@/lib/review-comments";
import { resolveReviewWriteAuth } from "@/lib/review-auth";

type Params = {
	owner: string;
	repo: string;
	number: string;
	commentId: string;
};

export async function POST(
	request: NextRequest,
	context: { params: Promise<Params> },
) {
	if (request.headers.get("x-goreview-action") !== "comment") {
		return NextResponse.json({ error: "Missing action header." }, { status: 403 });
	}
	const { owner, repo, number: numberParam, commentId: commentIdParam } =
		await context.params;
	const number = Number(numberParam);
	const commentId = Number(commentIdParam);
	if (
		!Number.isInteger(number) ||
		number <= 0 ||
		!Number.isInteger(commentId) ||
		commentId <= 0
	) {
		return NextResponse.json({ error: "Invalid route parameters." }, { status: 400 });
	}

	const auth = await resolveReviewWriteAuth();
	if (!auth) {
		return NextResponse.json(
			{ error: "Commenting requires GitHub sign-in." },
			{ status: 401 },
		);
	}
	const raw: unknown = await request.json();
	const body =
		typeof raw === "object" &&
		raw !== null &&
		"body" in raw &&
		typeof raw.body === "string"
			? raw.body.trim()
			: "";
	if (!body || body.length > 65_536) {
		return NextResponse.json({ error: "Reply cannot be empty." }, { status: 400 });
	}

	try {
		const { data } =
			await auth.octokit.rest.pulls.createReplyForReviewComment({
				owner,
				repo,
				pull_number: number,
				comment_id: commentId,
				body,
			});
		return NextResponse.json({ comment: toReviewComment(data) }, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to post reply.",
			},
			{ status: 502 },
		);
	}
}
