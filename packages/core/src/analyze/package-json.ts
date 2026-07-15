import type { ChangeEvent, ChangedFile } from "../schemas/review";

type DependencyMap = Record<string, string>;

function parseDependencies(content: string | null): DependencyMap {
	if (!content) return {};
	try {
		const parsed = JSON.parse(content) as {
			dependencies?: DependencyMap;
			devDependencies?: DependencyMap;
		};
		return {
			...parsed.dependencies,
			...parsed.devDependencies,
		};
	} catch {
		return {};
	}
}

export function analyzePackageJson(file: ChangedFile): ChangeEvent[] {
	if (!file.path.endsWith("package.json")) return [];

	const before = parseDependencies(file.oldContent);
	const after = parseDependencies(file.newContent);
	const events: ChangeEvent[] = [];
	const names = new Set([...Object.keys(before), ...Object.keys(after)]);

	for (const name of names) {
		const oldVersion = before[name];
		const newVersion = after[name];

		if (oldVersion === undefined && newVersion !== undefined) {
			events.push({ kind: "dependency.added", name, version: newVersion });
		} else if (oldVersion !== undefined && newVersion === undefined) {
			events.push({ kind: "dependency.removed", name, version: oldVersion });
		} else if (
			oldVersion !== undefined &&
			newVersion !== undefined &&
			oldVersion !== newVersion
		) {
			events.push({
				kind: "dependency.updated",
				name,
				before: oldVersion,
				after: newVersion,
			});
		}
	}

	return events;
}
