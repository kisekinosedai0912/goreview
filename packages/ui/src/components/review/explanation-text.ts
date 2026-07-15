import type { CodeExplanation } from "@goreview/core";

export function explanationAsComment(explanation: CodeExplanation): string {
	return `${explanation.what}\n\nImpact: ${explanation.impact}\n\nVerify:\n${explanation.verify.map((item) => `- ${item}`).join("\n")}`;
}
