import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/module-react"],
	manifest: {
		name: "GoReview",
		description:
			"Tree comparison and category-aware review, injected into GitHub pull requests.",
		permissions: ["storage"],
		// Background fetches to the self-hosted backend; broad so users can
		// point the extension at their own deployment.
		host_permissions: ["https://*/*", "http://localhost/*"],
	},
	vite: () => ({
		plugins: [tailwindcss()],
		worker: { format: "es" as const },
	}),
	webExt: {
		// The content script only runs on PR pages, so land the dev browser
		// somewhere it has something to do.
		startUrls: ["https://github.com/facebook/react/pulls"],
	},
});
