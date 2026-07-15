export * from "./schemas/review";
export * from "./schemas/comment";
export * from "./schemas/intelligence";
export { classifyFile } from "./classify/classify-file";
export { categoryRules, type CategoryRule } from "./classify/rules";
export { explainEvent, explainEvents } from "./explain";
export { groupByCategory } from "./group-by-category";
export {
	computeFileDiff,
	withComputedDiffs,
	type ComputeDiffOptions,
} from "./diff/compute-diff";
export {
	buildFileTree,
	flattenTree,
	type FileTreeDirectory,
	type FileTreeInput,
	type FileTreeLeaf,
	type FileTreeNode,
	type TreeStats,
} from "./tree/build-tree";
export {
	buildAnnotations,
	buildReviewReport,
	renderTreeText,
	type CheckAnnotation,
	type ReviewReport,
} from "./report/markdown";
export {
	anchorsForDiffLine,
	findFirstChangedAnchor,
	getCommentableAnchors,
	isCommentableAnchor,
} from "./review/anchors";
export {
	getOrderedFiles,
	matchesReviewFilters,
	type ReviewFilters,
} from "./review/order";
export {
	buildDeterministicIntelligence,
	validateIntelligenceEvidence,
} from "./review/intelligence";
export {
	buildFileRelationships,
	buildReviewFacts,
	buildReviewPromptChunks,
	type ReviewFacts,
	type ReviewFileFact,
	type ReviewPromptChunk,
} from "./review/facts";
export {
	levelForRiskScore,
	scoreFileRisk,
} from "./review/risk";
export type {
	ExplainCodeInput,
	ReviewDataSource,
	ReviewIntelligenceResult,
} from "./review/data-source";
