import { Octokit } from "octokit";

export function resolveGitHubToken(token?: string): string | undefined {
	if (token) return token;

	if (typeof import.meta !== "undefined" && import.meta.env?.VITE_GITHUB_TOKEN) {
		return import.meta.env.VITE_GITHUB_TOKEN;
	}

	return undefined;
}

export function createOctokit(token?: string): Octokit {
	const auth = resolveGitHubToken(token);
	if (!auth) {
		throw new Error(
			"GitHub token required. Pass token, set VITE_GITHUB_TOKEN, or GITHUB_TOKEN.",
		);
	}
	return new Octokit({ auth });
}
