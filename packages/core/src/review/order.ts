import type {
	ChangeCategory,
	ChangedFile,
} from "../schemas/review";
import { buildFileTree, flattenTree } from "../tree/build-tree";

export type ReviewFilters = {
	statuses?: ReadonlySet<ChangedFile["status"]>;
	categories?: ReadonlySet<ChangeCategory>;
};

export function matchesReviewFilters(
	file: ChangedFile,
	filters: ReviewFilters,
): boolean {
	if (filters.statuses?.size && !filters.statuses.has(file.status)) return false;
	if (
		filters.categories?.size &&
		!file.categories.some((category) => filters.categories?.has(category))
	) {
		return false;
	}
	return true;
}

/** Canonical directory-tree DFS order, independent of sidebar collapse state. */
export function getOrderedFiles(
	files: ChangedFile[],
	filters: ReviewFilters = {},
): ChangedFile[] {
	const filtered = files.filter((file) => matchesReviewFilters(file, filters));
	const byPath = new Map(filtered.map((file) => [file.path, file]));
	const tree = buildFileTree(filtered);

	return flattenTree(tree)
		.filter((row) => row.node.kind === "file")
		.map((row) => byPath.get(row.node.path))
		.filter((file): file is ChangedFile => file !== undefined);
}
