import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requiredEnv } from "@/lib/env";
import { writeSession } from "@/lib/session";

type TokenResponse = {
	access_token?: string;
	error?: string;
	error_description?: string;
};

type GitHubUser = {
	login: string;
	avatar_url?: string;
};

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code");
	const state = request.nextUrl.searchParams.get("state");

	const store = await cookies();
	const stateCookie = store.get("goreview_oauth_state")?.value;
	store.delete("goreview_oauth_state");

	const [expectedState, returnTo = "/"] = stateCookie?.split(":", 2) ?? [];
	if (!code || !state || !expectedState || state !== expectedState) {
		return NextResponse.json(
			{ error: "OAuth state mismatch; try signing in again." },
			{ status: 400 },
		);
	}

	const tokenResponse = await fetch(
		"https://github.com/login/oauth/access_token",
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				client_id: requiredEnv("GITHUB_CLIENT_ID"),
				client_secret: requiredEnv("GITHUB_CLIENT_SECRET"),
				code,
			}),
		},
	);
	const token = (await tokenResponse.json()) as TokenResponse;
	if (!token.access_token) {
		return NextResponse.json(
			{ error: token.error_description ?? "Token exchange failed." },
			{ status: 400 },
		);
	}

	const userResponse = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${token.access_token}`,
			Accept: "application/vnd.github+json",
		},
	});
	if (!userResponse.ok) {
		return NextResponse.json(
			{ error: "Could not load the GitHub user for this token." },
			{ status: 400 },
		);
	}
	const user = (await userResponse.json()) as GitHubUser;

	await writeSession({
		token: token.access_token,
		login: user.login,
		avatarUrl: user.avatar_url,
	});

	// Only allow same-origin relative redirects.
	const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
	return NextResponse.redirect(new URL(safeReturnTo, request.nextUrl.origin));
}
