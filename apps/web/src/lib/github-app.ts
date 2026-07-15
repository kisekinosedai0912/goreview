import { App, Octokit } from "octokit";
import { githubAppConfigured, optionalEnv, requiredEnv } from "./env";

let appInstance: App | null = null;

export function getGitHubApp(): App | null {
	if (!githubAppConfigured()) return null;
	appInstance ??= new App({
		appId: requiredEnv("GITHUB_APP_ID"),
		// Vercel env vars store the PEM with literal \n.
		privateKey: requiredEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
		webhooks: {
			secret: optionalEnv("GITHUB_WEBHOOK_SECRET") ?? "unset",
		},
	});
	return appInstance;
}

/** Octokit authenticated as the App installation that covers the repo. */
export async function installationOctokit(
	owner: string,
	repo: string,
): Promise<Octokit | null> {
	const app = getGitHubApp();
	if (!app) return null;
	try {
		const { data } = await app.octokit.rest.apps.getRepoInstallation({
			owner,
			repo,
		});
		return (await app.getInstallationOctokit(data.id)) as unknown as Octokit;
	} catch {
		return null;
	}
}

export function userOctokit(token: string): Octokit {
	return new Octokit({ auth: token });
}
