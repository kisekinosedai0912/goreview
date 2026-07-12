import { samplePr } from "../fixtures/sample-pr";
import type { ReviewLoader } from "../core/github/from-pull-request";
import type { ReviewSnapshot } from "../schemas/review";

export type LoadReviewResult = {
	source: "github" | "fixture";
	snapshot: ReviewSnapshot;
	ensureFile?: ReviewLoader["ensureFile"];
};

type PullRequestCoords = {
	owner: string;
	repo: string;
	number: number;
};

function readEnv(name: string): string | undefined {
	const value = import.meta.env[name];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readQueryCoords(): PullRequestCoords | null {
	if (typeof window === "undefined") return null;

	const params = new URLSearchParams(window.location.search);
	const owner = params.get("owner") ?? undefined;
	const repo = params.get("repo") ?? undefined;
	const pr = params.get("pr") ?? undefined;

	if (!owner || !repo || !pr) return null;
	const number = Number(pr);
	if (!Number.isFinite(number)) return null;

	return { owner, repo, number };
}

function readPullRequestCoords(): PullRequestCoords | null {
	const fromQuery = readQueryCoords();
	if (fromQuery) return fromQuery;

	const owner = readEnv("VITE_GITHUB_OWNER");
	const repo = readEnv("VITE_GITHUB_REPO");
	const pr = readEnv("VITE_GITHUB_PR");

	if (!owner || !repo || !pr) return null;
	const number = Number(pr);
	if (!Number.isFinite(number)) return null;

	return { owner, repo, number };
}

function hasGitHubToken(): boolean {
	return Boolean(readEnv("VITE_GITHUB_TOKEN"));
}

export async function loadReview(): Promise<LoadReviewResult> {
	const coords = readPullRequestCoords();
	const token = readEnv("VITE_GITHUB_TOKEN");

	if (!coords || !token) {
		return { source: "fixture", snapshot: samplePr };
	}

	try {
		const { fromPullRequest } = await import("../core/github/from-pull-request");
		const loader = await fromPullRequest({
			owner: coords.owner,
			repo: coords.repo,
			number: coords.number,
			token,
		});

		return {
			source: "github",
			snapshot: loader.snapshot,
			ensureFile: loader.ensureFile,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to load pull request";
		throw new Error(message);
	}
}

export function canLoadFromGitHub(): boolean {
	return hasGitHubToken() && readPullRequestCoords() !== null;
}
