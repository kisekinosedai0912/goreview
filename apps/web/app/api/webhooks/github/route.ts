import { NextResponse, type NextRequest } from "next/server";
import { getGitHubApp } from "@/lib/github-app";
import { runReviewBot } from "@/lib/review-bot";
import type { Octokit } from "octokit";

export const maxDuration = 120;

const HANDLED_ACTIONS = new Set([
	"opened",
	"synchronize",
	"reopened",
	"ready_for_review",
]);

type PullRequestPayload = {
	action?: string;
	installation?: { id: number };
	pull_request?: {
		number: number;
		draft: boolean;
		head: { sha: string };
	};
	repository?: {
		name: string;
		owner: { login: string };
	};
};

export async function POST(request: NextRequest) {
	const app = getGitHubApp();
	if (!app) {
		return NextResponse.json(
			{ error: "GitHub App is not configured on this deployment." },
			{ status: 501 },
		);
	}

	const body = await request.text();
	const signature = request.headers.get("x-hub-signature-256") ?? "";
	const event = request.headers.get("x-github-event") ?? "";

	if (!(await app.webhooks.verify(body, signature))) {
		return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
	}

	if (event === "ping") {
		return NextResponse.json({ ok: true });
	}

	if (event !== "pull_request") {
		return NextResponse.json({ ok: true, skipped: `event ${event}` });
	}

	const payload = JSON.parse(body) as PullRequestPayload;
	if (!payload.action || !HANDLED_ACTIONS.has(payload.action)) {
		return NextResponse.json({ ok: true, skipped: `action ${payload.action}` });
	}
	if (!payload.pull_request || !payload.repository || !payload.installation) {
		return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
	}
	if (payload.pull_request.draft) {
		return NextResponse.json({ ok: true, skipped: "draft PR" });
	}

	const octokit = (await app.getInstallationOctokit(
		payload.installation.id,
	)) as unknown as Octokit;

	try {
		await runReviewBot(octokit, {
			owner: payload.repository.owner.login,
			repo: payload.repository.name,
			number: payload.pull_request.number,
			headSha: payload.pull_request.head.sha,
		});
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Review bot run failed.",
			},
			{ status: 500 },
		);
	}
}
