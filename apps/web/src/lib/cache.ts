import { optionalEnv } from "./env";

/**
 * Snapshot cache: Upstash Redis REST when configured, otherwise an
 * in-memory map (fine for dev; serverless instances just recompute).
 */

type CacheEntry = { value: string; expiresAt: number };

const memory = new Map<string, CacheEntry>();
const MEMORY_LIMIT = 50;
const TTL_SECONDS = 60 * 60 * 6;

function upstash(): { url: string; token: string } | null {
	const url =
		optionalEnv("UPSTASH_REDIS_REST_URL") ?? optionalEnv("KV_REST_API_URL");
	const token =
		optionalEnv("UPSTASH_REDIS_REST_TOKEN") ?? optionalEnv("KV_REST_API_TOKEN");
	return url && token ? { url, token } : null;
}

export async function cacheGet(key: string): Promise<string | null> {
	const redis = upstash();
	if (redis) {
		try {
			const response = await fetch(
				`${redis.url}/get/${encodeURIComponent(key)}`,
				{ headers: { Authorization: `Bearer ${redis.token}` } },
			);
			if (!response.ok) return null;
			const body = (await response.json()) as { result: string | null };
			return body.result;
		} catch {
			return null;
		}
	}

	const entry = memory.get(key);
	if (!entry) return null;
	if (entry.expiresAt < Date.now()) {
		memory.delete(key);
		return null;
	}
	return entry.value;
}

export async function cacheSet(key: string, value: string): Promise<void> {
	const redis = upstash();
	if (redis) {
		try {
			await fetch(
				`${redis.url}/set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${redis.token}`,
						"Content-Type": "text/plain",
					},
					body: value,
				},
			);
		} catch {
			// Cache write failures are non-fatal.
		}
		return;
	}

	memory.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
	if (memory.size > MEMORY_LIMIT) {
		const oldest = memory.keys().next().value;
		if (oldest !== undefined) memory.delete(oldest);
	}
}

export function snapshotCacheKey(
	owner: string,
	repo: string,
	number: number,
	headSha: string,
): string {
	return `snapshot:${owner}/${repo}#${number}@${headSha}`;
}
