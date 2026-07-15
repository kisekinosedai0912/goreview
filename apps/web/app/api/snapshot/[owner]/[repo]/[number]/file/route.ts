import { enrichChangedFile } from "@goreview/core/analyze";
import { fetchFileContent } from "@goreview/core/github";
import type { ChangedFile } from "@goreview/core";
import { NextResponse, type NextRequest } from "next/server";
import { getSnapshot, resolveAuth } from "@/lib/snapshot";

type Params = { owner: string; repo: string; number: string };

/**
 * Lazy hydration for large PRs: returns one file with contents, diff,
 * and analysis events filled in.
 */
export async function GET(
	request: NextRequest,
	context: { params: Promise<Params> },
) {
	const { owner, repo, number: numberParam } = await context.params;
	const number = Number(numberParam);
	const path = request.nextUrl.searchParams.get("path");

	if (!Number.isInteger(number) || number <= 0 || !path) {
		return NextResponse.json(
			{ error: "Invalid PR number or missing path." },
			{ status: 400 },
		);
	}

	const auth = await resolveAuth(owner, repo);
	if (!auth) {
		return NextResponse.json(
			{ error: "Sign in with GitHub to view this pull request." },
			{ status: 401 },
		);
	}

	try {
		const snapshot = await getSnapshot(auth.octokit, owner, repo, number);
		const shell = snapshot.files.find((file) => file.path === path);
		if (!shell) {
			return NextResponse.json(
				{ error: "File is not part of this pull request." },
				{ status: 404 },
			);
		}

		let file: ChangedFile = shell;
		if (shell.oldContent === null && shell.newContent === null) {
			const oldPath = shell.oldPath ?? shell.path;
			const [oldContent, newContent] = await Promise.all([
				shell.status !== "added"
					? fetchFileContent(auth.octokit, owner, repo, oldPath, snapshot.baseSha)
					: Promise.resolve(null),
				shell.status !== "deleted"
					? fetchFileContent(auth.octokit, owner, repo, shell.path, snapshot.headSha)
					: Promise.resolve(null),
			]);
			file = enrichChangedFile({ ...shell, oldContent, newContent });
		}

		return NextResponse.json(
			{ file },
			{
				headers: {
					"Cache-Control": "private, max-age=300",
					"Access-Control-Allow-Origin": "https://github.com",
					"Access-Control-Allow-Credentials": "true",
				},
			},
		);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to hydrate file.",
			},
			{ status: 502 },
		);
	}
}
