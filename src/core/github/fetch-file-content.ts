import type { Octokit } from "octokit";

const MAX_FILE_BYTES = 500 * 1024;

function decodeBase64(content: string): string {
	return atob(content.replace(/\n/g, ""));
}

function decodeContent(content: string, encoding: string): string | null {
	if (encoding !== "base64") return null;
	const text = decodeBase64(content);
	if (text.includes("\0")) return null;
	const bytes = new TextEncoder().encode(text);
	if (bytes.length > MAX_FILE_BYTES) return null;
	return text;
}

export async function fetchFileContent(
	octokit: Octokit,
	owner: string,
	repo: string,
	path: string,
	ref: string,
): Promise<string | null> {
	try {
		const { data } = await octokit.rest.repos.getContent({
			owner,
			repo,
			path,
			ref,
		});

		if (Array.isArray(data) || data.type !== "file") return null;
		if (!("content" in data) || !data.content) return null;

		return decodeContent(data.content, data.encoding);
	} catch {
		return null;
	}
}

export function inferLanguage(path: string): string | undefined {
	const ext = path.split(".").pop()?.toLowerCase();
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		json: "json",
		md: "markdown",
		prisma: "prisma",
		yml: "yaml",
		yaml: "yaml",
		sql: "sql",
		css: "css",
	};
	return ext ? map[ext] : undefined;
}
