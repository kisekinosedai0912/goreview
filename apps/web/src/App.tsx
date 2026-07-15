import { lazy, Suspense } from "react";
import Layout from "./layout";

const ReviewApp = lazy(() => import("./components/ReviewApp"));

function App() {
	return (
		<Layout>
			<Suspense fallback={<div className="app-shell__fallback">Loading review…</div>}>
				<ReviewApp />
			</Suspense>
		</Layout>
	);
}

export default App;
