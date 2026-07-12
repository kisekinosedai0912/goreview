import { memo } from "react";
import type { ChangedFile } from "../schemas/review";

type FileTreeItemProps = {
	file: ChangedFile;
	selected: boolean;
	onSelect: (path: string) => void;
};

function FileTreeItem({ file, selected, onSelect }: FileTreeItemProps) {
	return (
		<button
			type="button"
			className={`file-tree-item ${selected ? "is-selected" : ""}`}
			onClick={() => onSelect(file.path)}
		>
			<span className="file-tree-item__path">{file.path}</span>
			<span className="file-tree-item__status" data-status={file.status}>
				{file.status}
			</span>
		</button>
	);
}

export default memo(FileTreeItem);
