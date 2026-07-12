import { memo } from "react";

type CodePaneProps = {
	label: string;
	path: string;
	content: string | null;
	variant: "old" | "new";
};

function CodePane({ label, path, content, variant }: CodePaneProps) {
	const isEmpty = content === null;

	return (
		<section className="code-pane" data-variant={variant}>
			<header className="code-pane__header">
				<span className="code-pane__label">{label}</span>
				<span className="code-pane__path">{path}</span>
			</header>
			<div className="code-pane__body">
				{isEmpty ? (
					<p className="code-pane__empty">
						{variant === "old" ? "No previous version" : "No new version"}
					</p>
				) : (
					<pre className="code-pane__code">
						<code>{content}</code>
					</pre>
				)}
			</div>
		</section>
	);
}

export default memo(CodePane);
