import { lazy } from "react";
import { samplePr } from "./fixtures/sample-pr";
import Layout from "./layout";

const ReviewWorkspace = lazy(() => import("./components/ReviewWorkspace"));

function App() {
	return (
		<Layout>
			<ReviewWorkspace snapshot={samplePr} />
		</Layout>
	);
}

export default App;
