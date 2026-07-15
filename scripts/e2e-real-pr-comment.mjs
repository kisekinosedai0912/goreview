/**
 * Explicitly opt-in real GitHub write test against a running GoReview server.
 *
 * Required:
 *   REAL_PR_WRITE_TEST=1
 *   GOREVIEW_TEST_PR=owner/repo#123
 *   GITHUB_TOKEN=<user token with pull-request write access in the server env>
 *
 * Optional:
 *   GOREVIEW_BASE_URL=http://localhost:3000
 *   GOREVIEW_TEST_COMMENT="GoReview real-PR validation comment"
 */

if (process.env.REAL_PR_WRITE_TEST !== "1") {
	console.log("Skipped real PR write test (set REAL_PR_WRITE_TEST=1 to opt in).");
	process.exit(0);
}

const target = process.env.GOREVIEW_TEST_PR?.match(
	/^([^/]+)\/([^#]+)#([1-9]\d*)$/,
);
if (!target) {
	throw new Error("GOREVIEW_TEST_PR must look like owner/repo#123.");
}

const [, owner, repo, numberText] = target;
const number = Number(numberText);
const base = process.env.GOREVIEW_BASE_URL ?? "http://localhost:3000";
const comment =
	process.env.GOREVIEW_TEST_COMMENT ??
	"GoReview real-PR validation: immediate line comment flow works.";

async function json(url, init) {
	const response = await fetch(url, init);
	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(`${response.status} ${url}: ${body?.error ?? "request failed"}`);
	}
	return body;
}

const reviewBase = `${base}/api/snapshot/${owner}/${repo}/${number}`;
const { snapshot } = await json(reviewBase);
let selected = null;

for (const shell of snapshot.files) {
	const { file } = await json(
		`${reviewBase}/file?path=${encodeURIComponent(shell.path)}`,
	);
	for (const hunk of file.diff?.hunks ?? []) {
		const line =
			hunk.lines.find((candidate) => candidate.type === "added") ??
			hunk.lines.find((candidate) => candidate.type === "removed");
		if (!line) continue;
		selected = {
			path: file.path,
			side: line.type === "removed" ? "LEFT" : "RIGHT",
			line: line.type === "removed" ? line.oldNumber : line.newNumber,
		};
		break;
	}
	if (selected) break;
}

if (!selected?.line) {
	throw new Error("The designated PR has no commentable text diff line.");
}

const result = await json(
	`${base}/api/reviews/${owner}/${repo}/${number}/comments`,
	{
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-goreview-action": "comment",
		},
		body: JSON.stringify({
			anchor: selected,
			body: comment,
			expectedHeadSha: snapshot.headSha,
		}),
	},
);

console.log(
	`Posted real review comment ${result.comment.id} at ${selected.path}:${selected.side}:${selected.line}`,
);
if (result.comment.htmlUrl) console.log(result.comment.htmlUrl);
