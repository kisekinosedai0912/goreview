import type { Octokit } from "octokit";

export type PullRequestMeta = {
	title: string;
	baseSha: string;
	headSha: string;
	baseBranch: string;
	headBranch: string;
	repo: string;
};

export async function fetchPullRequestMeta(
	octokit: Octokit,
	owner: string,
	repo: string,
	number: number,
): Promise<PullRequestMeta> {
	const { data } = await octokit.rest.pulls.get({
		owner,
		repo,
		pull_number: number,
	});

	return {
		title: data.title,
		baseSha: data.base.sha,
		headSha: data.head.sha,
		baseBranch: data.base.ref,
		headBranch: data.head.ref,
		repo: data.base.repo.full_name ?? `${owner}/${repo}`,
	};
}
