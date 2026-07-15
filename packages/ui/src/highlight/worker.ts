/// <reference lib="webworker" />
import {
	createHighlighterCore,
	type HighlighterCore,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { HighlightRequest, HighlightResponse, TokenLine } from "./types";

const THEMES = {
	light: "github-light-default",
	dark: "github-dark-default",
} as const;

type GrammarLoader = () => Promise<{ default: unknown }>;

/**
 * Explicit grammar map instead of the full shiki bundle: each language
 * is its own lazy chunk and unsupported ones fall back to plain text.
 */
const GRAMMARS: Record<string, GrammarLoader> = {
	typescript: () => import("@shikijs/langs/typescript"),
	tsx: () => import("@shikijs/langs/tsx"),
	javascript: () => import("@shikijs/langs/javascript"),
	jsx: () => import("@shikijs/langs/jsx"),
	json: () => import("@shikijs/langs/json"),
	markdown: () => import("@shikijs/langs/markdown"),
	prisma: () => import("@shikijs/langs/prisma"),
	yaml: () => import("@shikijs/langs/yaml"),
	sql: () => import("@shikijs/langs/sql"),
	css: () => import("@shikijs/langs/css"),
	scss: () => import("@shikijs/langs/scss"),
	html: () => import("@shikijs/langs/html"),
	shellscript: () => import("@shikijs/langs/shellscript"),
	python: () => import("@shikijs/langs/python"),
	go: () => import("@shikijs/langs/go"),
	rust: () => import("@shikijs/langs/rust"),
	toml: () => import("@shikijs/langs/toml"),
};

let corePromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
	corePromise ??= createHighlighterCore({
		themes: [
			import("@shikijs/themes/github-light-default"),
			import("@shikijs/themes/github-dark-default"),
		],
		langs: [],
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	});
	return corePromise;
}

async function resolveLanguage(
	highlighter: HighlighterCore,
	lang: string,
): Promise<string> {
	if (highlighter.getLoadedLanguages().includes(lang)) return lang;

	const loader = GRAMMARS[lang];
	if (!loader) return "text";

	try {
		await highlighter.loadLanguage(
			loader() as Parameters<HighlighterCore["loadLanguage"]>[0],
		);
		return lang;
	} catch {
		return "text";
	}
}

self.onmessage = async (event: MessageEvent<HighlightRequest>) => {
	const { id, text, lang, theme } = event.data;

	try {
		const highlighter = await getHighlighter();
		const language = await resolveLanguage(highlighter, lang);
		const tokens = highlighter.codeToTokensBase(text, {
			lang: language as Parameters<
				HighlighterCore["codeToTokensBase"]
			>[1]["lang"],
			theme: THEMES[theme],
			includeExplanation: false,
		});

		const lines: TokenLine[] = tokens.map((line) =>
			line.map((token) => ({ content: token.content, color: token.color })),
		);

		const response: HighlightResponse = { id, lines };
		self.postMessage(response);
	} catch (error) {
		const response: HighlightResponse = { id, error: String(error) };
		self.postMessage(response);
	}
};
