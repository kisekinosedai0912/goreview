import type { Octokit } from "octokit";
import type { ChangedFile } from "../schemas/review";

type GitHubPullFile = {
	filename: string;
	previous_filename?: string;
	status: string;
};

function mapStatus(
	status: string,
): ChangedFile["status"] | null {
	switch (status) {
		case "added":
			return "added";
		case "removed":
			return "deleted";
		case "modified":
			return "modified";
		case "renamed":
			return "renamed";
		default:
			return null;
	}
}

export async function fetchPullRequestFiles(
	octokit: Octokit,
	owner: string,
	repo: string,
	number: number,
): Promise<GitHubPullFile[]> {
	const files: GitHubPullFile[] = [];
	let page = 1;

	while (true) {
		const { data } = await octokit.rest.pulls.listFiles({
			owner,
			repo,
			pull_number: number,
			per_page: 100,
			page,
		});

		if (data.length === 0) break;
		files.push(...data);
		if (data.length < 100) break;
		page += 1;
	}

	return files;
}

export function toChangedFileShell(file: GitHubPullFile): ChangedFile | null {
	const status = mapStatus(file.status);
	if (!status) return null;

	return {
		path: file.filename,
		status,
		oldPath: file.previous_filename,
		oldContent: null,
		newContent: null,
		categories: ["unknown"],
		events: [],
	};
}
