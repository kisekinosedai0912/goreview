import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi, defineContentScript } from "#imports";
import type { ContentScriptContext } from "#imports";
import GoReviewPanel from "../../components/GoReviewPanel";
import "@goreview/ui/styles.css";
import "./style.css";

type PrLocation = { owner: string; repo: string; number: number };

function parsePrLocation(pathname: string): PrLocation | null {
	const match = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
	if (!match) return null;
	return { owner: match[1]!, repo: match[2]!, number: Number(match[3]) };
}

function githubTheme(): "light" | "dark" {
	const mode = document.documentElement.dataset.colorMode;
	if (mode === "dark") return "dark";
	if (mode === "auto") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	}
	return "light";
}

const TAB_ID = "goreview-tab-button";
const FLOAT_ID = "goreview-float-button";

export default defineContentScript({
	matches: ["*://github.com/*"],
	cssInjectionMode: "ui",

	async main(ctx: ContentScriptContext) {
		let panel: Awaited<ReturnType<typeof createShadowRootUi<Root>>> | null =
			null;
		let open = false;

		const closePanel = () => {
			open = false;
			panel?.remove();
			panel = null;
		};

		const openPanel = async (target: PrLocation) => {
			if (open) return;
			open = true;

			panel = await createShadowRootUi(ctx, {
				name: "goreview-panel",
				position: "overlay",
				anchor: "body",
				zIndex: 2147483000,
				onMount(container) {
					// The shared stylesheet hangs its design tokens off
					// [data-theme], so the wrapper must carry it inside the shadow.
					container.dataset.theme = githubTheme();
					const root = createRoot(container);
					root.render(
						<GoReviewPanel
							owner={target.owner}
							repo={target.repo}
							number={target.number}
							onClose={closePanel}
						/>,
					);
					return root;
				},
				onRemove(root) {
					root?.unmount();
				},
			});
			panel.mount();
		};

		const removeButtons = () => {
			document.getElementById(TAB_ID)?.remove();
			document.getElementById(FLOAT_ID)?.remove();
		};

		const injectButtons = (target: PrLocation) => {
			removeButtons();

			// Preferred: a real tab next to Conversation / Files changed.
			const tabnav = document.querySelector(".tabnav-tabs, nav.tabnav-tabs");
			if (tabnav && !document.getElementById(TAB_ID)) {
				const tab = document.createElement("button");
				tab.id = TAB_ID;
				tab.type = "button";
				tab.className = "tabnav-tab";
				tab.textContent = "GoReview";
				tab.style.cursor = "pointer";
				tab.style.background = "transparent";
				tab.style.border = "0";
				tab.addEventListener("click", () => void openPanel(target));
				tabnav.appendChild(tab);
				return;
			}

			// Fallback for markup we don't recognize: floating button.
			const float = document.createElement("button");
			float.id = FLOAT_ID;
			float.type = "button";
			float.textContent = "GoReview";
			Object.assign(float.style, {
				position: "fixed",
				right: "16px",
				bottom: "16px",
				zIndex: "2147482999",
				padding: "8px 14px",
				borderRadius: "999px",
				border: "1px solid rgba(0,0,0,0.2)",
				background: "#0f6e56",
				color: "#fff",
				fontSize: "12px",
				fontWeight: "600",
				cursor: "pointer",
				boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
			});
			float.addEventListener("click", () => void openPanel(target));
			document.body.appendChild(float);
		};

		const sync = () => {
			const target = parsePrLocation(window.location.pathname);
			closePanel();
			if (target) {
				injectButtons(target);
			} else {
				removeButtons();
			}
		};

		// GitHub is a soft-navigation SPA; re-sync on URL changes.
		ctx.addEventListener(window, "wxt:locationchange", sync);
		sync();
	},
});
