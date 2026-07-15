import { useCallback, useState } from "react";

function storageKeyFor(reviewKey: string): string {
	return `goreview-viewed:${reviewKey}`;
}

function readViewed(reviewKey: string): ReadonlySet<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const raw = window.localStorage.getItem(storageKeyFor(reviewKey));
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? new Set(parsed.filter((item): item is string => typeof item === "string"))
			: new Set();
	} catch {
		return new Set();
	}
}

function persistViewed(reviewKey: string, viewed: ReadonlySet<string>): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			storageKeyFor(reviewKey),
			JSON.stringify([...viewed]),
		);
	} catch {
		// Storage full or blocked; viewed state just won't survive reloads.
	}
}

/**
 * Review-progress tracking: which files the reviewer marked as viewed,
 * persisted per PR (keyed by repo + head SHA) in localStorage.
 */
export function useViewedFiles(reviewKey: string) {
	const [viewed, setViewed] = useState<ReadonlySet<string>>(() =>
		readViewed(reviewKey),
	);

	// Re-read when the review changes (render-phase reset).
	const [prevKey, setPrevKey] = useState(reviewKey);
	if (prevKey !== reviewKey) {
		setPrevKey(reviewKey);
		setViewed(readViewed(reviewKey));
	}

	const toggleViewed = useCallback(
		(path: string) => {
			setViewed((current) => {
				const next = new Set(current);
				if (next.has(path)) next.delete(path);
				else next.add(path);
				persistViewed(reviewKey, next);
				return next;
			});
		},
		[reviewKey],
	);

	return { viewed, toggleViewed };
}
