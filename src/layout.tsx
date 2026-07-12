import { Suspense, type ReactNode } from "react";

type LayoutProps = {
	children: ReactNode;
};

function Layout({ children }: LayoutProps) {
	return (
		<div className="app-shell">
			<Suspense fallback={<div className="app-shell__fallback">Loading workspace…</div>}>
				{children}
			</Suspense>
		</div>
	);
}

export default Layout;
