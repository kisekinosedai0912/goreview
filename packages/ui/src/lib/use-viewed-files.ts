import { useCallback, useSyncExternalStore } from "react";

/**
 * Review-progress tracking: which files the reviewer marked as viewed,
 * persisted per PR (keyed by repo + head SHA) in localStorage. Backed by
 * a module-level store so SSR renders empty and hydration stays clean.
 */

const EMPTY: ReadonlySet<string> = new Set();

const snapshots = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

function storageKeyFor(reviewKey: string): string {
	return `goreview-viewed:${reviewKey}`;
}

function readFromStorage(reviewKey: string): ReadonlySet<string> {
	try {
		const raw = window.localStorage.getItem(storageKeyFor(reviewKey));
		if (!raw) return EMPTY;
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? new Set(parsed.filter((item): item is string => typeof item === "string"))
			: EMPTY;
	} catch {
		return EMPTY;
	}
}

function getSnapshot(reviewKey: string): ReadonlySet<string> {
	let snapshot = snapshots.get(reviewKey);
	if (!snapshot) {
		snapshot = readFromStorage(reviewKey);
		snapshots.set(reviewKey, snapshot);
	}
	return snapshot;
}

function setSnapshot(reviewKey: string, viewed: ReadonlySet<string>): void {
	snapshots.set(reviewKey, viewed);
	try {
		window.localStorage.setItem(
			storageKeyFor(reviewKey),
			JSON.stringify([...viewed]),
		);
	} catch {
		// Storage full or blocked; viewed state just won't survive reloads.
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useViewedFiles(reviewKey: string) {
	const viewed = useSyncExternalStore(
		subscribe,
		() => getSnapshot(reviewKey),
		() => EMPTY,
	);

	const toggleViewed = useCallback(
		(path: string) => {
			const current = getSnapshot(reviewKey);
			const next = new Set(current);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			setSnapshot(reviewKey, next);
		},
		[reviewKey],
	);

	return { viewed, toggleViewed };
}
