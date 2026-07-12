import type {
	CategoryGroup,
	ChangeCategory,
	ChangedFile,
} from "../schemas/review";

const categoryOrder: ChangeCategory[] = [
	"package",
	"database",
	"backend",
	"ui",
	"config",
	"test",
	"ci",
	"docs",
	"unknown",
];

export function groupByCategory(files: ChangedFile[]): CategoryGroup[] {
	const grouped = new Map<ChangeCategory, ChangedFile[]>();

	for (const file of files) {
		for (const category of file.categories) {
			const existing = grouped.get(category) ?? [];
			existing.push(file);
			grouped.set(category, existing);
		}
	}

	return categoryOrder
		.filter((category) => grouped.has(category))
		.map((category) => ({
			category,
			files: grouped.get(category)!,
		}));
}
