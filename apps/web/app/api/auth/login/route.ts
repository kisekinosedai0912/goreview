import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { oauthConfigured, requiredEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
	if (!oauthConfigured()) {
		return NextResponse.json(
			{ error: "GitHub OAuth is not configured on this deployment." },
			{ status: 501 },
		);
	}

	const state = randomBytes(16).toString("hex");
	const returnTo = request.nextUrl.searchParams.get("return_to") ?? "/";

	const store = await cookies();
	store.set("goreview_oauth_state", `${state}:${returnTo}`, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 600,
	});

	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", requiredEnv("GITHUB_CLIENT_ID"));
	authorize.searchParams.set("state", state);
	authorize.searchParams.set(
		"redirect_uri",
		new URL("/api/auth/callback", request.nextUrl.origin).toString(),
	);

	return NextResponse.redirect(authorize);
}
