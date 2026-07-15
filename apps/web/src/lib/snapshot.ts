import {
	reviewSnapshotSchema,
	withComputedDiffs,
	type ReviewSnapshot,
} from "@goreview/core";
import { fromPullRequest } from "@goreview/core/github";
import type { Octokit } from "octokit";
import { cacheGet, cacheSet, snapshotCacheKey } from "./cache";
import { installationOctokit, userOctokit } from "./github-app";
import { readSession } from "./session";

export type SnapshotAuth =
	| { kind: "user"; octokit: Octokit }
	| { kind: "installation"; octokit: Octokit };

/**
 * Resolve an authenticated client for the repo: the signed-in user's
 * token when present (respects their permissions), otherwise the App
 * installation token (lets the webhook-driven flow and public links work).
 */
export async function resolveAuth(
	owner: string,
	repo: string,
): Promise<SnapshotAuth | null> {
	const session = await readSession();
	if (session) {
		return { kind: "user", octokit: userOctokit(session.token) };
	}

	const installation = await installationOctokit(owner, repo);
	if (installation) {
		return { kind: "installation", octokit: installation };
	}

	return null;
}

export async function computeSnapshot(
	octokit: Octokit,
	owner: string,
	repo: string,
	number: number,
): Promise<ReviewSnapshot> {
	const loader = await fromPullRequest({ owner, repo, number, octokit });
	return withComputedDiffs(loader.snapshot);
}

/**
 * Cached snapshot lookup. We need the PR head SHA before we can address
 * the cache, so PR meta is always fetched fresh (1 API call), and the
 * expensive part (file list + blobs + analysis) is what gets cached.
 */
export async function getSnapshot(
	octokit: Octokit,
	owner: string,
	repo: string,
	number: number,
): Promise<ReviewSnapshot> {
	const { data: pr } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: number,
	});

	const key = snapshotCacheKey(owner, repo, number, pr.head.sha);
	const cached = await cacheGet(key);
	if (cached) {
		try {
			return reviewSnapshotSchema.parse(JSON.parse(cached));
		} catch {
			// Stale schema in cache; recompute below.
		}
	}

	const snapshot = await computeSnapshot(octokit, owner, repo, number);
	await cacheSet(key, JSON.stringify(snapshot));
	return snapshot;
}

export async function storeSnapshot(snapshot: ReviewSnapshot, number: number) {
	const [owner, repo] = snapshot.repo.split("/", 2);
	if (!owner || !repo) return;
	await cacheSet(
		snapshotCacheKey(owner, repo, number, snapshot.headSha),
		JSON.stringify(snapshot),
	);
}
