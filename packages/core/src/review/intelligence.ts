import type { CommentAnchor } from "../schemas/comment";
import type {
	ReviewIntelligence,
	RiskHotspot,
	ReviewOrderItem,
} from "../schemas/intelligence";
import type { ChangedFile, ReviewSnapshot } from "../schemas/review";
import { findFirstChangedAnchor, isCommentableAnchor } from "./anchors";
import { buildFileRelationships } from "./facts";
import { getOrderedFiles } from "./order";
import { levelForRiskScore, scoreFileRisk } from "./risk";

function riskForFile(file: ChangedFile): RiskHotspot | null {
	const { score, reasons } = scoreFileRisk(file);
	if (score < 20) return null;
	const anchor = findFirstChangedAnchor(file);
	return {
		id: `risk:${file.path}`,
		title: file.path,
		level: levelForRiskScore(score),
		score,
		reason: reasons.join("; ") || "Non-trivial code change",
		evidence: anchor ? [{ anchor, label: file.path }] : [],
	};
}

function buildReviewOrder(snapshot: ReviewSnapshot): ReviewOrderItem[] {
	return getOrderedFiles(snapshot.files)
		.map((file) => {
			const risk = scoreFileRisk(file);
			return {
				path: file.path,
				reason:
					risk.reasons[0] ??
					(file.categories[0]
						? `${file.categories[0]} change`
						: "changed file"),
				riskScore: risk.score,
				dependsOn: [],
			};
		})
		.sort((a, b) => b.riskScore - a.riskScore || a.path.localeCompare(b.path));
}

/** Fast, no-network intelligence used as the baseline and AI fallback. */
export function buildDeterministicIntelligence(
	snapshot: ReviewSnapshot,
): ReviewIntelligence {
	const ordered = getOrderedFiles(snapshot.files);
	const risks = ordered
		.map(riskForFile)
		.filter((risk): risk is RiskHotspot => risk !== null)
		.sort((a, b) => b.score - a.score);
	const testFiles = ordered.filter((file) => file.categories.includes("test"));
	const behaviorFiles = ordered.filter((file) =>
		file.categories.some((category) =>
			["backend", "ui", "database"].includes(category),
		),
	);
	const testGaps =
		behaviorFiles.length > 0 && testFiles.length === 0
			? [
					{
						id: "test-gap:no-tests",
						title: "Behavior changed without test changes",
						reason: `${behaviorFiles.length} behavior-affecting ${behaviorFiles.length === 1 ? "file changed" : "files changed"}, but no test files changed.`,
						relatedPaths: behaviorFiles.map((file) => file.path),
						severity: "warning" as const,
					},
				]
			: [];

	return {
		version: 1,
		source: "deterministic",
		summary: `${ordered.length} changed ${ordered.length === 1 ? "file" : "files"} across ${new Set(ordered.flatMap((file) => file.categories)).size} review areas. ${risks.length ? `${risks.length} risk ${risks.length === 1 ? "hotspot" : "hotspots"} need attention.` : "No elevated deterministic risks found."}`,
		changeStory: ordered.slice(0, 12).map((file, index) => {
			const anchor = findFirstChangedAnchor(file);
			return {
				id: `story:${index}:${file.path}`,
				title: file.path,
				summary: `${file.status} ${file.categories.join(", ")} file`,
				paths: [file.path],
				evidence: anchor ? [{ anchor, label: file.path }] : [],
			};
		}),
		relationships: buildFileRelationships(ordered),
		risks,
		testGaps,
		reviewOrder: buildReviewOrder(snapshot),
		questions: testGaps.length
			? ["What verifies the behavior changed by this pull request?"]
			: [],
		generatedAt: new Date().toISOString(),
	};
}

function allEvidence(intelligence: ReviewIntelligence): CommentAnchor[] {
	return [
		...intelligence.changeStory.flatMap((step) =>
			step.evidence.map((evidence) => evidence.anchor),
		),
		...intelligence.risks.flatMap((risk) =>
			risk.evidence.map((evidence) => evidence.anchor),
		),
	];
}

export function validateIntelligenceEvidence(
	snapshot: ReviewSnapshot,
	intelligence: ReviewIntelligence,
): { valid: boolean; invalid: CommentAnchor[] } {
	const files = new Map(snapshot.files.map((file) => [file.path, file]));
	const invalid = allEvidence(intelligence).filter((anchor) => {
		const file = files.get(anchor.path);
		return !file || !isCommentableAnchor(file, anchor);
	});
	return { valid: invalid.length === 0, invalid };
}
