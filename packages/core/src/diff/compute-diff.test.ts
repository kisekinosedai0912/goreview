import { describe, expect, it } from "vitest";
import { computeFileDiff, withComputedDiffs } from "./compute-diff";
import { reviewSnapshotSchema } from "../schemas/review";

const OLD = `function greet(name) {
  return "hello " + name;
}

const unused = 1;
`;

const NEW = `function greet(name, title) {
  return "hello " + title + " " + name;
}
`;

describe("computeFileDiff", () => {
	it("produces hunks with correct line numbers", () => {
		const diff = computeFileDiff(OLD, NEW);

		expect(diff.hunks).toHaveLength(1);
		const [hunk] = diff.hunks;
		expect(hunk!.oldStart).toBe(1);
		expect(hunk!.newStart).toBe(1);

		const removed = hunk!.lines.filter((line) => line.type === "removed");
		const added = hunk!.lines.filter((line) => line.type === "added");
		expect(removed.map((line) => line.oldNumber)).toEqual([1, 2, 4, 5]);
		expect(added.map((line) => line.newNumber)).toEqual([1, 2]);
		expect(diff.additions).toBe(2);
		expect(diff.deletions).toBe(4);
	});

	it("counts file lines for context expansion", () => {
		const diff = computeFileDiff(OLD, NEW);
		expect(diff.oldLineCount).toBe(5);
		expect(diff.newLineCount).toBe(3);
	});

	it("treats added files as all-added", () => {
		const diff = computeFileDiff(null, "a\nb\n");
		expect(diff.deletions).toBe(0);
		expect(diff.additions).toBe(2);
		expect(diff.hunks[0]!.lines.every((line) => line.type === "added")).toBe(
			true,
		);
	});

	it("treats deleted files as all-removed", () => {
		const diff = computeFileDiff("a\nb\n", null);
		expect(diff.additions).toBe(0);
		expect(diff.deletions).toBe(2);
	});

	it("returns no hunks for identical content", () => {
		const diff = computeFileDiff("same\n", "same\n");
		expect(diff.hunks).toHaveLength(0);
		expect(diff.additions).toBe(0);
		expect(diff.deletions).toBe(0);
	});

	it("attaches intra-line segments on paired changed lines", () => {
		const diff = computeFileDiff(
			'const color = "red";\n',
			'const color = "blue";\n',
		);

		const removed = diff.hunks[0]!.lines.find((l) => l.type === "removed");
		const added = diff.hunks[0]!.lines.find((l) => l.type === "added");

		expect(removed?.segments?.some((s) => s.changed)).toBe(true);
		expect(added?.segments?.some((s) => s.changed)).toBe(true);
		// The unchanged prefix should be marked unchanged.
		expect(removed?.segments?.[0]).toMatchObject({ changed: false });
	});

	it("skips segments when the whole line was rewritten", () => {
		const diff = computeFileDiff(
			"completely different text here\n",
			"nothing shared at all zzz qqq\n",
		);
		const removed = diff.hunks[0]!.lines.find((l) => l.type === "removed");
		expect(removed?.segments).toBeUndefined();
	});
});

describe("withComputedDiffs", () => {
	it("fills diff and stats for hydrated files only", () => {
		const snapshot = reviewSnapshotSchema.parse({
			baseSha: "a",
			headSha: "b",
			title: "t",
			repo: "r",
			baseBranch: "main",
			headBranch: "next",
			files: [
				{
					path: "hydrated.ts",
					status: "modified",
					oldContent: "a\n",
					newContent: "b\n",
					categories: ["unknown"],
					events: [],
				},
				{
					path: "shell.ts",
					status: "modified",
					oldContent: null,
					newContent: null,
					categories: ["unknown"],
					events: [],
				},
			],
		});

		const result = withComputedDiffs(snapshot);
		expect(result.files[0]!.diff).toBeDefined();
		expect(result.files[0]!.additions).toBe(1);
		expect(result.files[0]!.deletions).toBe(1);
		expect(result.files[1]!.diff).toBeUndefined();
	});
});
