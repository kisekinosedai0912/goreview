import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@goreview/ui/styles.css";
import App from "./App";
import { initTheme } from "@goreview/ui/theme";

initTheme();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
