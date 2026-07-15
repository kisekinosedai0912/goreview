import type { ChangedFile } from "./schemas/review";
import { analyzeFile } from "./analyze/analyze-file";
import { classifyFile } from "./classify/classify-file";
import { inferLanguage } from "./github/fetch-file-content";

export function enrichChangedFile(file: ChangedFile): ChangedFile {
	const enriched: ChangedFile = {
		...file,
		language: file.language ?? inferLanguage(file.path),
		categories: classifyFile(file.path),
		events: [],
	};

	enriched.events = analyzeFile(enriched);
	return enriched;
}
