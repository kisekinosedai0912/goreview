import type { Octokit } from "octokit";
import { optionalEnv } from "./env";
import { userOctokit } from "./github-app";
import { readSession } from "./session";

export type ReviewWriteAuth =
	| { kind: "user"; octokit: Octokit; login: string }
	| { kind: "env"; octokit: Octokit; login: null };

/**
 * Reviewer comments must be attributed to the reviewer. Installation tokens
 * are deliberately excluded: otherwise a user's words would appear as the bot.
 */
export async function resolveReviewWriteAuth(): Promise<ReviewWriteAuth | null> {
	const session = await readSession();
	if (session) {
		return {
			kind: "user",
			octokit: userOctokit(session.token),
			login: session.login,
		};
	}

	const token = optionalEnv("GITHUB_TOKEN");
	if (token) {
		return { kind: "env", octokit: userOctokit(token), login: null };
	}

	return null;
}
