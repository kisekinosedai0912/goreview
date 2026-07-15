import type { Octokit } from "octokit";

const MAX_FILE_BYTES = 500 * 1024;

function base64ToBytes(content: string): Uint8Array {
	const binary = atob(content.replace(/\n/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function decodeContent(content: string, encoding: string): string | null {
	if (encoding !== "base64") return null;
	const bytes = base64ToBytes(content);
	if (bytes.length > MAX_FILE_BYTES) return null;
	if (bytes.includes(0)) return null;
	return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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
