import {
	commentAnchorSchema,
	isCommentableAnchor,
} from "@goreview/core";
import { NextResponse, type NextRequest } from "next/server";
import {
	deterministicExplanation,
	generateCodeExplanation,
	isReviewAiAvailable,
} from "@/lib/ai/review-intelligence";
import { hydrateSnapshotForReview } from "@/lib/hydrate-review-file";
import { resolveReviewWriteAuth } from "@/lib/review-auth";
import { getSnapshot } from "@/lib/snapshot";

type Params = { owner: string; repo: string; number: string };

export async function POST(
	request: NextRequest,
	context: { params: Promise<Params> },
) {
	if (request.headers.get("x-goreview-action") !== "intelligence") {
		return NextResponse.json({ error: "Missing action header." }, { status: 403 });
	}
	const { owner, repo, number: rawNumber } = await context.params;
	const number = Number(rawNumber);
	if (!Number.isInteger(number) || number <= 0) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
	}
	const auth = await resolveReviewWriteAuth();
	if (!auth) {
		return NextResponse.json(
			{ error: "Code explanations require GitHub sign-in." },
			{ status: 401 },
		);
	}
	const raw: unknown = await request.json();
	const input =
		typeof raw === "object" && raw !== null
			? (raw as { path?: unknown; anchor?: unknown; expectedHeadSha?: unknown })
			: {};
	const path = typeof input.path === "string" ? input.path : "";
	const expectedHeadSha =
		typeof input.expectedHeadSha === "string" ? input.expectedHeadSha : "";
	const parsedAnchor =
		input.anchor === undefined
			? null
			: commentAnchorSchema.safeParse(input.anchor);
	if (!path || !expectedHeadSha || (parsedAnchor && !parsedAnchor.success)) {
		return NextResponse.json(
			{ error: "Invalid explanation request." },
			{ status: 400 },
		);
	}

	const snapshot = await getSnapshot(auth.octokit, owner, repo, number);
	if (snapshot.headSha !== expectedHeadSha) {
		return NextResponse.json(
			{ error: "The pull request changed. Refresh before explaining code." },
			{ status: 409 },
		);
	}
	if (!snapshot.files.some((file) => file.path === path)) {
		return NextResponse.json({ error: "Changed file not found." }, { status: 404 });
	}

	const hydrated = await hydrateSnapshotForReview(
		auth.octokit,
		owner,
		repo,
		snapshot,
	);
	const anchor = parsedAnchor?.success ? parsedAnchor.data : undefined;
	const file = hydrated.files.find((candidate) => candidate.path === path)!;
	if (anchor && !isCommentableAnchor(file, anchor)) {
		return NextResponse.json(
			{ error: "That line is not part of the current diff." },
			{ status: 422 },
		);
	}

	const fallback = deterministicExplanation(hydrated, path);
	if (!isReviewAiAvailable()) {
		return NextResponse.json({
			explanation: fallback,
			fallback: true,
			aiError: "AI Gateway is not configured.",
		});
	}
	try {
		const explanation = await generateCodeExplanation({
			snapshot: hydrated,
			path,
			anchor,
			userId: auth.login ?? "local-developer",
		});
		return NextResponse.json({ explanation, fallback: false });
	} catch {
		return NextResponse.json({
			explanation: fallback,
			fallback: true,
			aiError: "AI explanation is temporarily unavailable.",
		});
	}
}
