import type { RiskLevel } from "../schemas/intelligence";
import type { ChangedFile } from "../schemas/review";

const SENSITIVE_SEGMENTS = [
	"auth",
	"security",
	"permission",
	"migration",
	"schema",
	"billing",
	"payment",
	"secret",
];

export function levelForRiskScore(score: number): RiskLevel {
	if (score >= 80) return "critical";
	if (score >= 55) return "high";
	if (score >= 30) return "medium";
	return "low";
}

export function scoreFileRisk(file: ChangedFile): {
	score: number;
	reasons: string[];
} {
	const churn =
		(file.additions ?? file.diff?.additions ?? 0) +
		(file.deletions ?? file.diff?.deletions ?? 0);
	let score = Math.min(35, Math.round(Math.log2(churn + 1) * 6));
	const reasons: string[] = [];

	if (churn >= 100) reasons.push(`${churn} changed lines`);
	if (file.status === "deleted") {
		score += 12;
		reasons.push("deletes existing behavior");
	}
	if (file.categories.includes("database")) {
		score += 24;
		reasons.push("database or schema change");
	}
	if (file.categories.includes("package")) {
		score += 18;
		reasons.push("dependency surface changed");
	}
	if (file.categories.includes("config") || file.categories.includes("ci")) {
		score += 12;
		reasons.push("runtime or delivery configuration changed");
	}
	if (file.events.some((event) => event.kind === "signature.changed")) {
		score += 16;
		reasons.push("public signature changed");
	}
	if (file.events.some((event) => event.kind === "dependency.updated")) {
		score += 10;
		reasons.push("dependency version changed");
	}
	if (
		SENSITIVE_SEGMENTS.some((segment) =>
			file.path.toLowerCase().includes(segment),
		)
	) {
		score += 18;
		reasons.push("sensitive path");
	}

	return { score: Math.min(100, score), reasons };
}
