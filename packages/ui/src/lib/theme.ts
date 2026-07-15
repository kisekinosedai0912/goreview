export type Theme = "light" | "dark";

const STORAGE_KEY = "goreview-theme";

export function getStoredTheme(): Theme {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.classList.toggle("dark", theme === "dark");
	localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
	applyTheme(getStoredTheme());
}
