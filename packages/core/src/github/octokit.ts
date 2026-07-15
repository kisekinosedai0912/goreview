import { Octokit } from "octokit";

declare const process:
	| { env?: Record<string, string | undefined> }
	| undefined;

export function resolveGitHubToken(token?: string): string | undefined {
	if (token) return token;

	if (typeof process !== "undefined" && process.env?.GITHUB_TOKEN) {
		return process.env.GITHUB_TOKEN;
	}

	return undefined;
}

export function createOctokit(token?: string): Octokit {
	const auth = resolveGitHubToken(token);
	if (!auth) {
		throw new Error(
			"GitHub token required. Pass a token or set GITHUB_TOKEN.",
		);
	}
	return new Octokit({ auth });
}
