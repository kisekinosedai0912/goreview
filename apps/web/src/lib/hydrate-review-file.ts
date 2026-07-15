import { enrichChangedFile } from "@goreview/core/analyze";
import { fetchFileContent } from "@goreview/core/github";
import type { ChangedFile, ReviewSnapshot } from "@goreview/core";
import type { Octokit } from "octokit";

export async function hydrateReviewFile(
	octokit: Octokit,
	owner: string,
	repo: string,
	snapshot: ReviewSnapshot,
	path: string,
): Promise<ChangedFile | null> {
	const shell = snapshot.files.find((file) => file.path === path);
	if (!shell) return null;
	if (shell.oldContent !== null || shell.newContent !== null) return shell;

	const oldPath = shell.oldPath ?? shell.path;
	const [oldContent, newContent] = await Promise.all([
		shell.status !== "added"
			? fetchFileContent(octokit, owner, repo, oldPath, snapshot.baseSha)
			: Promise.resolve(null),
		shell.status !== "deleted"
			? fetchFileContent(octokit, owner, repo, shell.path, snapshot.headSha)
			: Promise.resolve(null),
	]);
	return enrichChangedFile({ ...shell, oldContent, newContent });
}
