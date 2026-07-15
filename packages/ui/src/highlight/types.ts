export type TokenSpan = {
	content: string;
	color?: string;
};

export type TokenLine = TokenSpan[];

export type HighlightRequest = {
	id: number;
	text: string;
	lang: string;
	theme: "light" | "dark";
};

export type HighlightResponse =
	| { id: number; lines: TokenLine[] }
	| { id: number; error: string };
