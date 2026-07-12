import { lazy, Suspense } from "react";
import Layout from "./layout";

const ReviewApp = lazy(() => import("./components/ReviewApp"));
const ReviewWorkspace = lazy(() => import("./components/ReviewWorkspace"));
const ComparisonStack = lazy(() => import("./components/ComparisonStack"));
const ExplanationList = lazy(() => import("./components/ExplanationList"));

function App() {
	return (
		<Layout>
			<Suspense fallback={<div className="app-shell__fallback">Loading review…</div>}>
				<ReviewApp
					ReviewWorkspace={ReviewWorkspace}
					ComparisonStack={ComparisonStack}
					ExplanationList={ExplanationList}
				/>
			</Suspense>
		</Layout>
	);
}

export default App;
