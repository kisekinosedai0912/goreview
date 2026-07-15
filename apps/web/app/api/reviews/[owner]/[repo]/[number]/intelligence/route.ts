import { NextResponse, type NextRequest } from "next/server";
import { APICallError } from "ai";
import {
	deterministicReviewIntelligence,
	generateReviewIntelligence,
	isReviewAiAvailable,
	reviewModel,
} from "@/lib/ai/review-intelligence";
import { hydrateSnapshotForReview } from "@/lib/hydrate-review-file";
import { resolveReviewWriteAuth } from "@/lib/review-auth";
import { getSnapshot, resolveAuth } from "@/lib/snapshot";

type Params = { owner: string; repo: string; number: string };

function pullNumber(value: string): number | null {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : null;
}

export async function GET(
	_request: NextRequest,
	context: { params: Promise<Params> },
) {
	const { owner, repo, number: rawNumber } = await context.params;
	const number = pullNumber(rawNumber);
	if (!number) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
	}
	const auth = await resolveAuth(owner, repo);
	if (!auth) {
		return NextResponse.json(
			{ error: "Sign in to load review intelligence." },
			{ status: 401 },
		);
	}
	try {
		const snapshot = await getSnapshot(auth.octokit, owner, repo, number);
		return NextResponse.json({
			intelligence: deterministicReviewIntelligence(snapshot),
			aiAvailable: isReviewAiAvailable(),
			model: reviewModel(),
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to analyze pull request.",
			},
			{ status: 502 },
		);
	}
}

export async function POST(
	request: NextRequest,
	context: { params: Promise<Params> },
) {
	if (request.headers.get("x-goreview-action") !== "intelligence") {
		return NextResponse.json({ error: "Missing action header." }, { status: 403 });
	}
	const { owner, repo, number: rawNumber } = await context.params;
	const number = pullNumber(rawNumber);
	if (!number) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
	}
	const auth = await resolveReviewWriteAuth();
	if (!auth) {
		return NextResponse.json(
			{
				error:
					"AI review requires explicit GitHub sign-in so usage can be attributed and rate-limited.",
			},
			{ status: 401 },
		);
	}
	const raw: unknown = await request.json();
	const expectedHeadSha =
		typeof raw === "object" &&
		raw !== null &&
		"expectedHeadSha" in raw &&
		typeof raw.expectedHeadSha === "string"
			? raw.expectedHeadSha
			: "";
	if (!expectedHeadSha) {
		return NextResponse.json({ error: "Missing head SHA." }, { status: 400 });
	}

	const snapshot = await getSnapshot(auth.octokit, owner, repo, number);
	if (snapshot.headSha !== expectedHeadSha) {
		return NextResponse.json(
			{
				error:
					"The pull request changed since this review loaded. Refresh before generating intelligence.",
				headSha: snapshot.headSha,
			},
			{ status: 409 },
		);
	}
	const deterministic = deterministicReviewIntelligence(snapshot);
	if (!isReviewAiAvailable()) {
		return NextResponse.json({
			intelligence: deterministic,
			fallback: true,
			aiError:
				"AI Gateway is not configured. Deterministic review facts remain available.",
		});
	}

	try {
		const hydrated = await hydrateSnapshotForReview(
			auth.octokit,
			owner,
			repo,
			snapshot,
		);
		const intelligence = await generateReviewIntelligence({
			owner,
			repo,
			snapshot: hydrated,
			userId: auth.login ?? "local-developer",
		});
		return NextResponse.json({ intelligence, fallback: false });
	} catch (error) {
		let aiError = "AI review is temporarily unavailable.";
		if (APICallError.isInstance(error)) {
			if (error.statusCode === 402) {
				aiError = "The AI Gateway budget is exhausted.";
			} else if (error.statusCode === 429) {
				aiError = "The AI review rate limit was reached. Try again later.";
			} else if (error.statusCode === 503) {
				aiError = "The AI provider is temporarily unavailable.";
			}
		}
		return NextResponse.json({
			intelligence: deterministic,
			fallback: true,
			aiError,
		});
	}
}
