import { memo } from "react";
import type { Explanation } from "@goreview/core";
import ExplanationItem from "./ExplanationItem";

type ExplanationListProps = {
	explanations: Explanation[];
};

function ExplanationList({ explanations }: ExplanationListProps) {
	if (explanations.length === 0) {
		return (
			<section className="explanation-list explanation-list--empty">
				<h2 className="explanation-list__title">What changed</h2>
				<p className="explanation-list__empty">
					No structured change events for this file.
				</p>
			</section>
		);
	}

	return (
		<section className="explanation-list">
			<h2 className="explanation-list__title">What changed</h2>
			<ol className="explanation-list__items">
				{explanations.map((explanation, index) => (
					<ExplanationItem
						key={explanation.id}
						explanation={explanation}
						index={index + 1}
					/>
				))}
			</ol>
		</section>
	);
}

export default memo(ExplanationList);
