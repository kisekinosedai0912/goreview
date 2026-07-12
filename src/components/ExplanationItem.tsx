import { memo } from "react";
import type { Explanation } from "../schemas/review";

type ExplanationItemProps = {
	explanation: Explanation;
	index: number;
};

function ExplanationItem({ explanation, index }: ExplanationItemProps) {
	return (
		<li className="explanation-item" data-kind={explanation.kind}>
			<span className="explanation-item__index">{String(index).padStart(2, "0")}</span>
			<span className="explanation-item__text">{explanation.text}</span>
		</li>
	);
}

export default memo(ExplanationItem);
