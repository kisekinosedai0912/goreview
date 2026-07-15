import { describe, expect, it } from "vitest";
import { buildFileTree, flattenTree, type FileTreeInput } from "./build-tree";

const files: FileTreeInput[] = [
	{
		path: "src/components/Button.tsx",
		status: "modified",
		categories: ["ui"],
		additions: 5,
		deletions: 2,
	},
	{
		path: "src/components/Card.tsx",
		status: "added",
		categories: ["ui"],
		additions: 30,
		deletions: 0,
	},
	{
		path: "src/api/users.ts",
		status: "deleted",
		categories: ["backend"],
		additions: 0,
		deletions: 12,
	},
	{
		path: "package.json",
		status: "modified",
		categories: ["package"],
		additions: 1,
		deletions: 1,
	},
];

describe("buildFileTree", () => {
	it("nests files under their directories with rollup stats", () => {
		const root = buildFileTree(files);

		expect(root.stats.files).toBe(4);
		expect(root.stats.additions).toBe(36);
		expect(root.stats.deletions).toBe(15);
		expect(root.stats.added).toBe(1);
		expect(root.stats.deleted).toBe(1);
		expect(root.stats.modified).toBe(2);

		const src = root.children.find((n) => n.name === "src");
		expect(src?.kind).toBe("directory");
		if (src?.kind !== "directory") throw new Error("src should be a dir");
		expect(src.stats.files).toBe(3);

		const components = src.children.find((n) => n.name === "components");
		if (components?.kind !== "directory") throw new Error("expected dir");
		expect(components.stats.additions).toBe(35);
	});

	it("sorts directories before files, both alphabetical", () => {
		const root = buildFileTree(files);
		expect(root.children.map((n) => n.name)).toEqual(["src", "package.json"]);
	});

	it("compresses single-child directory chains", () => {
		const root = buildFileTree([
			{
				path: "deep/nested/only/file.ts",
				status: "added",
				categories: ["unknown"],
				additions: 1,
				deletions: 0,
			},
			{ path: "top.md", status: "modified", categories: ["docs"] },
		]);

		const compressed = root.children.find((n) => n.kind === "directory");
		expect(compressed?.name).toBe("deep/nested/only");
		expect(compressed?.path).toBe("deep/nested/only");
	});

	it("does not lose levels when the root has one directory child", () => {
		const root = buildFileTree([
			{
				path: "src/a.ts",
				status: "modified",
				categories: ["unknown"],
			},
			{
				path: "src/b.ts",
				status: "modified",
				categories: ["unknown"],
			},
		]);

		expect(root.name).toBe("");
		expect(root.children).toHaveLength(1);
		expect(root.children[0]!.name).toBe("src");
	});

	it("reads stats from precomputed diff when flat stats are missing", () => {
		const root = buildFileTree([
			{
				path: "x.ts",
				status: "modified",
				categories: ["unknown"],
				diff: { additions: 7, deletions: 3 },
			},
		]);
		expect(root.stats.additions).toBe(7);
		expect(root.stats.deletions).toBe(3);
	});
});

describe("flattenTree", () => {
	it("flattens depth-first and respects collapsed directories", () => {
		const root = buildFileTree(files);

		const all = flattenTree(root);
		expect(all.map((row) => row.node.path)).toEqual([
			"src",
			"src/api",
			"src/api/users.ts",
			"src/components",
			"src/components/Button.tsx",
			"src/components/Card.tsx",
			"package.json",
		]);

		const collapsed = flattenTree(root, (path) => path !== "src/components");
		expect(collapsed.map((row) => row.node.path)).toEqual([
			"src",
			"src/api",
			"src/api/users.ts",
			"src/components",
			"package.json",
		]);
	});
});
