import { memo } from "react";
import type { ChangedFile } from "@goreview/core";
import CodePane from "./CodePane";

type ComparisonStackProps = {
	file: ChangedFile;
};

function ComparisonStack({ file }: ComparisonStackProps) {
	const oldPath = file.oldPath ?? file.path;

	return (
		<div className="comparison-stack">
			<CodePane
				label="Before"
				path={oldPath}
				content={file.oldContent}
				variant="old"
			/>
			<CodePane
				label="After"
				path={file.path}
				content={file.newContent}
				variant="new"
			/>
		</div>
	);
}

export default memo(ComparisonStack);
