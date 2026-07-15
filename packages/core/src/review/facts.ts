import type { FileRelationship } from "../schemas/intelligence";
import type { ChangedFile, ReviewSnapshot } from "../schemas/review";
import { getOrderedFiles } from "./order";
import { scoreFileRisk } from "./risk";

export type ReviewFileFact = {
	path: string;
	status: ChangedFile["status"];
	categories: ChangedFile["categories"];
	additions: number;
	deletions: number;
	riskScore: number;
	riskReasons: string[];
	hasTestsNearby: boolean;
};

export type ReviewFacts = {
	files: ReviewFileFact[];
	relationships: FileRelationship[];
	totalAdditions: number;
	totalDeletions: number;
	sensitivePaths: string[];
};

function stem(path: string): string {
	const name = path.split("/").pop() ?? path;
	return name
		.replace(/\.(test|spec|stories?)\b/gi, "")
		.replace(/\.[^.]+$/, "")
		.toLowerCase();
}

function directory(path: string): string {
	const parts = path.split("/");
	parts.pop();
	return parts.join("/");
}

function isTest(file: ChangedFile): boolean {
	return file.categories.includes("test");
}

export function buildFileRelationships(
	files: ChangedFile[],
): FileRelationship[] {
	const relationships = new Map<string, FileRelationship>();
	const add = (relationship: FileRelationship) => {
		const key = `${relationship.from}:${relationship.to}:${relationship.kind}`;
		relationships.set(key, relationship);
	};

	for (let leftIndex = 0; leftIndex < files.length; leftIndex += 1) {
		const left = files[leftIndex]!;
		for (
			let rightIndex = leftIndex + 1;
			rightIndex < files.length;
			rightIndex += 1
		) {
			const right = files[rightIndex]!;
			if (stem(left.path) === stem(right.path) && isTest(left) !== isTest(right)) {
				const test = isTest(left) ? left : right;
				const implementation = test === left ? right : left;
				add({
					from: implementation.path,
					to: test.path,
					kind: "test",
					reason: "implementation and matching test changed together",
				});
			} else if (
				directory(left.path) &&
				directory(left.path) === directory(right.path)
			) {
				add({
					from: left.path,
					to: right.path,
					kind: "directory",
					reason: "files change the same module directory",
				});
			}

			const leftText = `${left.oldContent ?? ""}\n${left.newContent ?? ""}`;
			const rightText = `${right.oldContent ?? ""}\n${right.newContent ?? ""}`;
			if (leftText.includes(stem(right.path))) {
				add({
					from: left.path,
					to: right.path,
					kind: "dependency",
					reason: "changed code references the related file name",
				});
			}
			if (rightText.includes(stem(left.path))) {
				add({
					from: right.path,
					to: left.path,
					kind: "dependency",
					reason: "changed code references the related file name",
				});
			}
		}
	}
	return [...relationships.values()].slice(0, 60);
}

export function buildReviewFacts(snapshot: ReviewSnapshot): ReviewFacts {
	const files = getOrderedFiles(snapshot.files);
	const relationships = buildFileRelationships(files);
	const testStems = new Set(files.filter(isTest).map((file) => stem(file.path)));
	const facts = files.map((file) => {
		const risk = scoreFileRisk(file);
		return {
			path: file.path,
			status: file.status,
			categories: file.categories,
			additions: file.additions ?? file.diff?.additions ?? 0,
			deletions: file.deletions ?? file.diff?.deletions ?? 0,
			riskScore: risk.score,
			riskReasons: risk.reasons,
			hasTestsNearby:
				isTest(file) ||
				testStems.has(stem(file.path)) ||
				relationships.some(
					(relationship) =>
						relationship.kind === "test" &&
						(relationship.from === file.path ||
							relationship.to === file.path),
				),
		};
	});
	return {
		files: facts,
		relationships,
		totalAdditions: facts.reduce((sum, file) => sum + file.additions, 0),
		totalDeletions: facts.reduce((sum, file) => sum + file.deletions, 0),
		sensitivePaths: facts
			.filter((file) => file.riskReasons.includes("sensitive path"))
			.map((file) => file.path),
	};
}

export type ReviewPromptChunk = {
	path: string;
	part: number;
	totalParts: number;
	text: string;
};

export function buildReviewPromptChunks(
	snapshot: ReviewSnapshot,
	maxChars = 24_000,
): ReviewPromptChunk[] {
	const chunks: ReviewPromptChunk[] = [];
	for (const file of getOrderedFiles(snapshot.files)) {
		const sections = (file.diff?.hunks ?? []).map((hunk) => {
			const lines = hunk.lines
				.map((line) => {
					const marker =
						line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
					const coordinate =
						line.type === "removed"
							? `L${line.oldNumber ?? "?"}`
							: `R${line.newNumber ?? "?"}`;
					return `${coordinate} ${marker}${line.content}`;
				})
				.join("\n");
			return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${lines}`;
		});
		if (sections.length === 0) {
			sections.push(
				`${file.status} ${file.path}\n${file.newContent ?? file.oldContent ?? "(binary or unavailable)"}`,
			);
		}

		const parts: string[] = [];
		let current = `FILE ${file.path} (${file.status})\n`;
		for (const section of sections) {
			if (current.length + section.length + 2 > maxChars && current.length > 0) {
				parts.push(current);
				current = `FILE ${file.path} (continued)\n`;
			}
			if (section.length > maxChars) {
				for (let start = 0; start < section.length; start += maxChars) {
					if (current.trim()) parts.push(current);
					current = `${section.slice(start, start + maxChars)}\n`;
				}
			} else {
				current += `${section}\n`;
			}
		}
		if (current.trim()) parts.push(current);
		for (let index = 0; index < parts.length; index += 1) {
			chunks.push({
				path: file.path,
				part: index + 1,
				totalParts: parts.length,
				text: parts[index]!,
			});
		}
	}
	return chunks;
}
