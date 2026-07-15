export type Theme = "light" | "dark";

const STORAGE_KEY = "goreview-theme";

export function getStoredTheme(): Theme {
	if (typeof window === "undefined") return "light";
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "dark"
			? "dark"
			: "light";
	} catch {
		return "light";
	}
}

export function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.classList.toggle("dark", theme === "dark");
	try {
		window.localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		// Persisting the preference is best-effort.
	}
}

export function initTheme() {
	applyTheme(getStoredTheme());
}
