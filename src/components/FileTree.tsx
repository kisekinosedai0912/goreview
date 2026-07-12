import { memo } from "react";
import type { CategoryGroup } from "../schemas/review";
import CategoryBadge from "./CategoryBadge";
import FileTreeItem from "./FileTreeItem";

type FileTreeProps = {
	groups: CategoryGroup[];
	selectedPath: string | null;
	onSelect: (path: string) => void;
};

function FileTree({ groups, selectedPath, onSelect }: FileTreeProps) {
	return (
		<nav className="file-tree" aria-label="Changed files">
			{groups.map((group) => (
				<section key={group.category} className="file-tree__group">
					<header className="file-tree__group-header">
						<CategoryBadge category={group.category} />
						<span className="file-tree__count">{group.files.length}</span>
					</header>
					<ul className="file-tree__list">
						{group.files.map((file) => (
							<li key={`${group.category}-${file.path}`}>
								<FileTreeItem
									file={file}
									selected={selectedPath === file.path}
									onSelect={onSelect}
								/>
							</li>
						))}
					</ul>
				</section>
			))}
		</nav>
	);
}

export default memo(FileTree);
