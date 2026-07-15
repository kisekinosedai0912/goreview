import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@goreview/ui/styles.css";

export const metadata: Metadata = {
	title: "Goreview",
	description:
		"Category-aware pull request review with tree comparison and real diffs.",
};

const themeInit = `(() => {
	const theme = localStorage.getItem("goreview-theme") === "dark" ? "dark" : "light";
	document.documentElement.dataset.theme = theme;
	document.documentElement.classList.toggle("dark", theme === "dark");
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInit }} />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&display=swap"
					rel="stylesheet"
				/>
			</head>
			<body>
				<div className="app-shell">{children}</div>
			</body>
		</html>
	);
}
