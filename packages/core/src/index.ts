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
	scoreFileRisk,
	validateIntelligenceEvidence,
} from "./review/intelligence";
export type {
	ExplainCodeInput,
	ReviewDataSource,
} from "./review/data-source";
