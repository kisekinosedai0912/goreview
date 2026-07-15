import { memo, useState } from "react";
import type { CodeExplanation } from "@goreview/core";
import { explanationAsComment } from "./explanation-text";

type ExplanationCardProps = {
	explanation: CodeExplanation;
	onUseAsComment?: () => void;
	onClose?: () => void;
};

function ExplanationCard({
	explanation,
	onUseAsComment,
	onClose,
}: ExplanationCardProps) {
	const [copied, setCopied] = useState(false);
	return (
		<aside className="code-explanation">
			<header>
				<div>
					<span>Code explanation</span>
					<small>{explanation.source}</small>
				</div>
				{onClose ? (
					<button type="button" onClick={onClose} aria-label="Close explanation">
						×
					</button>
				) : null}
			</header>
			<dl>
				<div>
					<dt>What</dt>
					<dd>{explanation.what}</dd>
				</div>
				<div>
					<dt>Why</dt>
					<dd>{explanation.why}</dd>
				</div>
				<div>
					<dt>Impact</dt>
					<dd>{explanation.impact}</dd>
				</div>
				<div>
					<dt>Verify</dt>
					<dd>
						<ul>
							{explanation.verify.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</dd>
				</div>
			</dl>
			<footer>
				<button
					type="button"
					onClick={() => {
						void navigator.clipboard
							.writeText(explanationAsComment(explanation))
							.then(() => setCopied(true));
					}}
				>
					{copied ? "Copied" : "Copy"}
				</button>
				{onUseAsComment ? (
					<button type="button" onClick={onUseAsComment}>
						Use in comment
					</button>
				) : null}
			</footer>
		</aside>
	);
}

export default memo(ExplanationCard);
