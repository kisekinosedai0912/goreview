import { NextResponse, type NextRequest } from "next/server";
import { getSnapshot, resolveAuth } from "@/lib/snapshot";

type Params = { owner: string; repo: string; number: string };

export async function GET(
	_request: NextRequest,
	context: { params: Promise<Params> },
) {
	const { owner, repo, number: numberParam } = await context.params;
	const number = Number(numberParam);
	if (!Number.isInteger(number) || number <= 0) {
		return NextResponse.json({ error: "Invalid PR number." }, { status: 400 });
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
		return NextResponse.json(
			{ snapshot },
			{
				headers: {
					"Cache-Control": "private, max-age=60",
					// The extension content script calls this from github.com.
					"Access-Control-Allow-Origin": "https://github.com",
					"Access-Control-Allow-Credentials": "true",
				},
			},
		);
	} catch (error) {
		const status =
			error instanceof Error && /Not Found/i.test(error.message) ? 404 : 502;
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to load the pull request from GitHub.",
			},
			{ status },
		);
	}
}

export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "https://github.com",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
