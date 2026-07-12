import type { Octokit } from "octokit";
import { enrichChangedFile } from "../build-snapshot";
import { classifyFile } from "../classify/classify-file";
import { fetchFileContent } from "./fetch-file-content";
import {
	fetchPullRequestFiles,
	toChangedFileShell,
} from "./fetch-pr-files";
import { fetchPullRequestMeta } from "./fetch-pr-meta";
import { createOctokit } from "./octokit";
import {
	type ChangedFile,
	reviewSnapshotSchema,
	type ReviewSnapshot,
} from "../../schemas/review";

const LAZY_THRESHOLD = 40;

export type FromPullRequestInput = {
	owner: string;
	repo: string;
	number: number;
	token?: string;
};

export type ReviewLoader = {
	snapshot: ReviewSnapshot;
	ensureFile: (path: string) => Promise<ChangedFile>;
};

async function hydrateFile(
	octokit: Octokit,
	owner: string,
	repo: string,
	baseSha: string,
	headSha: string,
	file: ChangedFile,
): Promise<ChangedFile> {
	const oldPath = file.oldPath ?? file.path;
	let oldContent: string | null = null;
	let newContent: string | null = null;

	if (file.status !== "added") {
		oldContent = await fetchFileContent(octokit, owner, repo, oldPath, baseSha);
	}
	if (file.status !== "deleted") {
		newContent = await fetchFileContent(octokit, owner, repo, file.path, headSha);
	}

	return enrichChangedFile({
		...file,
		oldContent,
		newContent,
	});
}

function shellWithCategories(file: ChangedFile): ChangedFile {
	return {
		...file,
		categories: classifyFile(file.path),
		events: [],
	};
}

export async function fromPullRequest(
	input: FromPullRequestInput,
): Promise<ReviewLoader> {
	const octokit = createOctokit(input.token);
	const meta = await fetchPullRequestMeta(
		octokit,
		input.owner,
		input.repo,
		input.number,
	);
	const rawFiles = await fetchPullRequestFiles(
		octokit,
		input.owner,
		input.repo,
		input.number,
	);

	const shells = rawFiles
		.map(toChangedFileShell)
		.filter((file): file is ChangedFile => file !== null);

	const lazy = shells.length > LAZY_THRESHOLD;
	const fileCache = new Map<string, ChangedFile>();

	let files: ChangedFile[];

	if (lazy) {
		files = shells.map(shellWithCategories);
	} else {
		files = await Promise.all(
			shells.map((shell) =>
				hydrateFile(
					octokit,
					input.owner,
					input.repo,
					meta.baseSha,
					meta.headSha,
					shell,
				),
			),
		);
		for (const file of files) {
			fileCache.set(file.path, file);
		}
	}

	const snapshot = reviewSnapshotSchema.parse({
		baseSha: meta.baseSha,
		headSha: meta.headSha,
		title: meta.title,
		repo: meta.repo,
		baseBranch: meta.baseBranch,
		headBranch: meta.headBranch,
		files,
	});

	async function ensureFile(path: string): Promise<ChangedFile> {
		const cached = fileCache.get(path);
		if (cached) return cached;

		const shell = snapshot.files.find((file) => file.path === path);
		if (!shell) {
			throw new Error(`File not found in review snapshot: ${path}`);
		}

		const hydrated = await hydrateFile(
			octokit,
			input.owner,
			input.repo,
			meta.baseSha,
			meta.headSha,
			shell,
		);

		fileCache.set(path, hydrated);
		const index = snapshot.files.findIndex((file) => file.path === path);
		if (index >= 0) snapshot.files[index] = hydrated;

		return hydrated;
	}

	return { snapshot, ensureFile };
}
