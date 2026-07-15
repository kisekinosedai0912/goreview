export function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

export function optionalEnv(name: string): string | undefined {
	const value = process.env[name];
	return value && value.length > 0 ? value : undefined;
}

/** True when GitHub OAuth (App user-to-server) is configured. */
export function oauthConfigured(): boolean {
	return Boolean(
		optionalEnv("GITHUB_CLIENT_ID") && optionalEnv("GITHUB_CLIENT_SECRET"),
	);
}

/** True when the GitHub App (webhooks / installation tokens) is configured. */
export function githubAppConfigured(): boolean {
	return Boolean(
		optionalEnv("GITHUB_APP_ID") && optionalEnv("GITHUB_APP_PRIVATE_KEY"),
	);
}
