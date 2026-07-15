import { minimatch } from "minimatch";
import type { ChangeCategory } from "../schemas/review";
import { categoryRules } from "./rules";

function matchesPattern(path: string, pattern: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	return minimatch(normalized, pattern, { dot: true, nocase: true });
}

export function classifyFile(path: string): ChangeCategory[] {
	const categories = categoryRules
		.filter((rule) =>
			rule.patterns.some((pattern) => matchesPattern(path, pattern)),
		)
		.map((rule) => rule.category);

	if (categories.length === 0) return ["unknown"];
	return [...new Set(categories)];
}
