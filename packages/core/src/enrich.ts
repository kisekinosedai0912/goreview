import type { ChangedFile } from "./schemas/review";
import { analyzeFile } from "./analyze/analyze-file";
import { classifyFile } from "./classify/classify-file";
import { computeFileDiff } from "./diff/compute-diff";
import { inferLanguage } from "./github/fetch-file-content";

export function enrichChangedFile(file: ChangedFile): ChangedFile {
	const enriched: ChangedFile = {
		...file,
		language: file.language ?? inferLanguage(file.path),
		categories: classifyFile(file.path),
		events: [],
	};

	if (enriched.oldContent !== null || enriched.newContent !== null) {
		enriched.diff = computeFileDiff(enriched.oldContent, enriched.newContent);
		enriched.additions = enriched.diff.additions;
		enriched.deletions = enriched.diff.deletions;
	}

	enriched.events = analyzeFile(enriched);
	return enriched;
}
