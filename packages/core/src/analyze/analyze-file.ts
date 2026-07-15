import type { ChangeEvent, ChangedFile } from "../schemas/review";
import { analyzePackageJson } from "./package-json";
import { analyzeTypeScript } from "./typescript";

export function analyzeFile(file: ChangedFile): ChangeEvent[] {
	const events: ChangeEvent[] = [];

	try {
		events.push(...analyzePackageJson(file));
	} catch {
		// skip package analyzer errors
	}

	try {
		events.push(...analyzeTypeScript(file));
	} catch {
		// skip typescript analyzer errors
	}

	return events;
}
