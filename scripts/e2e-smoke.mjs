/**
 * End-to-end smoke test against a running apps/web dev server.
 *
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 *
 * Expects the server to run with:
 *   SESSION_SECRET=<anything>
 *   ALLOW_ANONYMOUS_GITHUB=1        (or GITHUB_TOKEN for higher rate limits)
 *   GITHUB_APP_ID=1
 *   GITHUB_APP_PRIVATE_KEY=<any valid RSA pem>
 *   GITHUB_WEBHOOK_SECRET=<secret, also in WEBHOOK_SECRET below>
 *
 * Verifies:
 *   1. /api/snapshot serves a schema-valid snapshot for a real public PR
 *   2. /api/snapshot/.../file hydrates a single file with a computed diff
 *   3. /api/reviews/.../intelligence serves the no-AI deterministic fallback
 *   4. /api/webhooks/github accepts a correctly signed ping
 *   5. /api/webhooks/github rejects a bad signature with 401
 */

import { createHmac } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3106";
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "smoke-secret";

// Small, stable, public PR: octocat/Hello-World#1 is ancient but tiny.
const TARGET = { owner: "octocat", repo: "Hello-World", number: 1 };

let failures = 0;

function check(name, condition, detail = "") {
	const status = condition ? "ok " : "FAIL";
	console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
	if (!condition) failures += 1;
}

// 1 + 2: snapshot and file hydration
{
	const url = `${BASE}/api/snapshot/${TARGET.owner}/${TARGET.repo}/${TARGET.number}`;
	const response = await fetch(url);
	const body = await response.json();

	check("snapshot responds 200", response.status === 200, `status ${response.status}`);
	const snapshot = body?.snapshot;
	check("snapshot has repo", snapshot?.repo === `${TARGET.owner}/${TARGET.repo}`);
	check("snapshot has files", Array.isArray(snapshot?.files) && snapshot.files.length > 0,
		`${snapshot?.files?.length ?? 0} files`);
	check("files carry categories", snapshot?.files?.every((f) => f.categories?.length > 0));

	const first = snapshot?.files?.[0];
	if (first) {
		const fileUrl = `${url}/file?path=${encodeURIComponent(first.path)}`;
		const fileResponse = await fetch(fileUrl);
		const fileBody = await fileResponse.json();
		check("file hydration responds 200", fileResponse.status === 200,
			`status ${fileResponse.status}`);
		check("hydrated file has a diff", Boolean(fileBody?.file?.diff?.hunks));
	}
}

// 3: deterministic intelligence never needs Gateway credentials
{
	const response = await fetch(
		`${BASE}/api/reviews/${TARGET.owner}/${TARGET.repo}/${TARGET.number}/intelligence`,
	);
	const body = await response.json();
	check(
		"deterministic intelligence responds 200",
		response.status === 200,
		`status ${response.status}`,
	);
	check(
		"intelligence has local fallback",
		body?.intelligence?.source === "deterministic",
	);
	check("intelligence reports AI availability", typeof body?.aiAvailable === "boolean");
}

// 4: correctly signed webhook ping
{
	const payload = JSON.stringify({ zen: "Keep it logically awesome." });
	const signature = `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex")}`;
	const response = await fetch(`${BASE}/api/webhooks/github`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-github-event": "ping",
			"x-hub-signature-256": signature,
		},
		body: payload,
	});
	check("signed ping accepted", response.status === 200, `status ${response.status}`);
}

// 5: bad signature rejected
{
	const payload = JSON.stringify({ zen: "nope" });
	const response = await fetch(`${BASE}/api/webhooks/github`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-github-event": "ping",
			"x-hub-signature-256": "sha256=deadbeef",
		},
		body: payload,
	});
	check("bad signature rejected with 401", response.status === 401,
		`status ${response.status}`);
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
