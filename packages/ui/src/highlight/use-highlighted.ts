import { useEffect, useState } from "react";
import type { HighlightResponse, TokenLine } from "./types";

type ThemeName = "light" | "dark";

let worker: Worker | null = null;
let workerFailed = false;
let requestSeq = 0;
const pending = new Map<number, (response: HighlightResponse) => void>();

const CACHE_LIMIT = 1_000;
const cache = new Map<string, TokenLine[]>();
const inFlight = new Map<string, Promise<TokenLine[] | null>>();

function cacheKey(text: string, lang: string, theme: ThemeName): string {
	// djb2 over a sample; collisions only cost a wrong highlight color.
	let hash = 5381;
	const step = Math.max(1, Math.floor(text.length / 512));
	for (let i = 0; i < text.length; i += step) {
		hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	}
	return `${lang}:${theme}:${text.length}:${hash}`;
}

function getWorker(): Worker | null {
	if (workerFailed || typeof Worker === "undefined") return null;
	if (worker) return worker;

	try {
		worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
		});
		worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
			const resolve = pending.get(event.data.id);
			if (resolve) {
				pending.delete(event.data.id);
				resolve(event.data);
			}
		};
		worker.onerror = () => {
			// Highlighting is progressive enhancement; fall back to plain text.
			workerFailed = true;
			for (const [id, resolve] of pending) {
				resolve({ id, error: "worker crashed" });
			}
			pending.clear();
			worker?.terminate();
			worker = null;
		};
		return worker;
	} catch {
		workerFailed = true;
		return null;
	}
}

export async function highlightText(
	text: string,
	lang: string,
	theme: ThemeName,
): Promise<TokenLine[] | null> {
	const key = cacheKey(text, lang, theme);
	const cached = cache.get(key);
	if (cached) return cached;
	const existing = inFlight.get(key);
	if (existing) return existing;

	const instance = getWorker();
	if (!instance) return null;

	const request = (async () => {
		const id = ++requestSeq;
		const response = await new Promise<HighlightResponse>((resolve) => {
			pending.set(id, resolve);
			instance.postMessage({ id, text, lang, theme });
		});
		if ("error" in response) return null;

		cache.set(key, response.lines);
		if (cache.size > CACHE_LIMIT) {
			const oldest = cache.keys().next().value;
			if (oldest !== undefined) cache.delete(oldest);
		}
		return response.lines;
	})().finally(() => {
		inFlight.delete(key);
	});
	inFlight.set(key, request);
	return request;
}

type HighlightState = {
	content: string | null;
	lang: string | undefined;
	theme: ThemeName;
	tokens: TokenLine[] | null;
};

export function useHighlightedFile(
	content: string | null,
	lang: string | undefined,
	theme: ThemeName,
): TokenLine[] | null {
	const [state, setState] = useState<HighlightState>({
		content,
		lang,
		theme,
		tokens: null,
	});

	// Reset during render when inputs change; tokens arrive asynchronously.
	if (
		state.content !== content ||
		state.lang !== lang ||
		state.theme !== theme
	) {
		setState({ content, lang, theme, tokens: null });
	}

	useEffect(() => {
		if (content === null) return;

		let cancelled = false;
		void highlightText(content, lang ?? "text", theme).then((lines) => {
			if (cancelled || !lines) return;
			setState((current) =>
				current.content === content &&
				current.lang === lang &&
				current.theme === theme
					? { ...current, tokens: lines }
					: current,
			);
		});

		return () => {
			cancelled = true;
		};
	}, [content, lang, theme]);

	return state.content === content ? state.tokens : null;
}

export function useHighlightedLine(
	content: string,
	lang: string | undefined,
	theme: ThemeName,
): TokenLine | null {
	const lines = useHighlightedFile(content, lang, theme);
	return lines?.[0] ?? null;
}

export function useAppTheme(): ThemeName {
	const [theme, setTheme] = useState<ThemeName>(() =>
		typeof document !== "undefined" &&
		document.documentElement.dataset.theme === "dark"
			? "dark"
			: "light",
	);

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setTheme(
				document.documentElement.dataset.theme === "dark" ? "dark" : "light",
			);
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "class"],
		});
		return () => observer.disconnect();
	}, []);

	return theme;
}
