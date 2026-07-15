import { memo } from "react";
import type {
	CommentAnchor,
	ReviewIntelligenceResult,
} from "@goreview/core";

type IntelligencePanelProps = {
	result: ReviewIntelligenceResult;
	generating: boolean;
	onGenerate?: () => void;
	onNavigate: (anchor: CommentAnchor) => void;
};

function IntelligencePanel({
	result,
	generating,
	onGenerate,
	onNavigate,
}: IntelligencePanelProps) {
	const intelligence = result.intelligence;
	return (
		<section className="intelligence-panel" aria-labelledby="intelligence-title">
			<header className="intelligence-panel__header">
				<div>
					<p className="intelligence-panel__eyebrow">Review Intelligence</p>
					<h2 id="intelligence-title">How this change fits together</h2>
				</div>
				<span className="intelligence-panel__source">
					{intelligence.source === "ai" ? "AI + deterministic facts" : "Local facts"}
				</span>
			</header>
			<p className="intelligence-panel__summary">{intelligence.summary}</p>

			{intelligence.changeStory.length > 0 ? (
				<div className="intelligence-panel__section">
					<h3>Change story</h3>
					<ol className="intelligence-story">
						{intelligence.changeStory.slice(0, 8).map((step) => (
							<li key={step.id}>
								<strong>{step.title}</strong>
								<p>{step.summary}</p>
								{step.evidence.map((evidence) => (
									<button
										key={`${evidence.anchor.path}:${evidence.anchor.side}:${evidence.anchor.line}`}
										type="button"
										onClick={() => onNavigate(evidence.anchor)}
									>
										{evidence.label}
									</button>
								))}
							</li>
						))}
					</ol>
				</div>
			) : null}

			{intelligence.relationships.length > 0 ? (
				<div className="intelligence-panel__section">
					<h3>Cross-file flow</h3>
					<div className="intelligence-flow">
						{intelligence.relationships.slice(0, 6).map((relationship) => (
							<div
								key={`${relationship.from}:${relationship.to}:${relationship.kind}`}
								className="intelligence-flow__item"
							>
								<code>{relationship.from}</code>
								<span aria-hidden="true">→</span>
								<code>{relationship.to}</code>
								<p>{relationship.reason}</p>
							</div>
						))}
					</div>
				</div>
			) : null}

			<div className="intelligence-panel__grid">
				<div className="intelligence-panel__section">
					<h3>Risk hotspots</h3>
					{intelligence.risks.length > 0 ? (
						<ol className="intelligence-risks">
							{intelligence.risks.slice(0, 6).map((risk) => (
								<li key={risk.id} data-level={risk.level}>
									<div>
										<strong>{risk.title}</strong>
										<span>{risk.score}/100</span>
									</div>
									<p>{risk.reason}</p>
									{risk.evidence.map((evidence) => (
										<button
											key={`${evidence.anchor.path}:${evidence.anchor.side}:${evidence.anchor.line}`}
											type="button"
											onClick={() => onNavigate(evidence.anchor)}
										>
											{evidence.label} · {evidence.anchor.side}{" "}
											{evidence.anchor.line}
										</button>
									))}
								</li>
							))}
						</ol>
					) : (
						<p className="intelligence-panel__quiet">
							No elevated deterministic risks found.
						</p>
					)}
				</div>

				<div className="intelligence-panel__section">
					<h3>Suggested review order</h3>
					<ol className="intelligence-order">
						{intelligence.reviewOrder.slice(0, 8).map((item) => (
							<li key={item.path}>
								<code>{item.path}</code>
								<span>{item.reason}</span>
							</li>
						))}
					</ol>
				</div>
			</div>

			{intelligence.testGaps.length > 0 ? (
				<div className="intelligence-panel__section">
					<h3>Likely test gaps</h3>
					{intelligence.testGaps.map((gap) => (
						<div key={gap.id} className="intelligence-gap">
							<strong>{gap.title}</strong>
							<p>{gap.reason}</p>
							<span>{gap.relatedPaths.join(", ")}</span>
						</div>
					))}
				</div>
			) : null}

			{intelligence.questions.length > 0 ? (
				<div className="intelligence-panel__section">
					<h3>Questions to resolve</h3>
					<ul className="intelligence-questions">
						{intelligence.questions.map((question) => (
							<li key={question}>{question}</li>
						))}
					</ul>
				</div>
			) : null}

			{result.aiError ? (
				<p className="intelligence-panel__error">{result.aiError}</p>
			) : null}
			{intelligence.source !== "ai" && onGenerate ? (
				<footer className="intelligence-panel__consent">
					<p>
						AI review is opt-in. It sends bounded changed-code hunks and local
						facts through Vercel AI Gateway; it never posts to GitHub.
					</p>
					<button type="button" onClick={onGenerate} disabled={generating}>
						{generating ? "Building review story…" : "Generate AI review story"}
					</button>
				</footer>
			) : null}
		</section>
	);
}

export default memo(IntelligencePanel);
