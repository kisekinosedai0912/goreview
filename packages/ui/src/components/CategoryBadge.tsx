import { memo } from "react";
import type { ChangeCategory } from "@goreview/core";

const labels: Record<ChangeCategory, string> = {
	database: "Database",
	ui: "UI",
	backend: "Backend",
	package: "Package",
	config: "Config",
	test: "Test",
	ci: "CI",
	docs: "Docs",
	unknown: "Unknown",
};

type CategoryBadgeProps = {
	category: ChangeCategory;
};

function CategoryBadge({ category }: CategoryBadgeProps) {
	return (
		<span className="category-badge" data-category={category}>
			{labels[category]}
		</span>
	);
}

export default memo(CategoryBadge);
