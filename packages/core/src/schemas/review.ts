import { z } from "zod";

export const changeCategorySchema = z.enum([
	"database",
	"ui",
	"backend",
	"package",
	"config",
	"test",
	"ci",
	"docs",
	"unknown",
]);

export const changeEventSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("symbol.added"),
		symbol: z.string(),
		type: z.enum(["function", "class", "component"]),
	}),
	z.object({
		kind: z.literal("symbol.removed"),
		symbol: z.string(),
	}),
	z.object({
		kind: z.literal("signature.changed"),
		symbol: z.string(),
		before: z.string(),
		after: z.string(),
	}),
	z.object({
		kind: z.literal("dependency.added"),
		name: z.string(),
		version: z.string(),
	}),
	z.object({
		kind: z.literal("dependency.updated"),
		name: z.string(),
		before: z.string(),
		after: z.string(),
	}),
	z.object({
		kind: z.literal("dependency.removed"),
		name: z.string(),
		version: z.string(),
	}),
]);

export const diffSegmentSchema = z.object({
	value: z.string(),
	changed: z.boolean(),
});

export const diffLineSchema = z.object({
	type: z.enum(["context", "added", "removed"]),
	oldNumber: z.number().nullable(),
	newNumber: z.number().nullable(),
	content: z.string(),
	segments: z.array(diffSegmentSchema).optional(),
});

export const diffHunkSchema = z.object({
	oldStart: z.number(),
	oldLines: z.number(),
	newStart: z.number(),
	newLines: z.number(),
	lines: z.array(diffLineSchema),
});

export const fileDiffSchema = z.object({
	hunks: z.array(diffHunkSchema),
	additions: z.number(),
	deletions: z.number(),
	/** Old file line count, so viewers can expand trailing context. */
	oldLineCount: z.number(),
	newLineCount: z.number(),
});

export const changedFileSchema = z.object({
	path: z.string(),
	status: z.enum(["added", "modified", "deleted", "renamed"]),
	oldPath: z.string().optional(),
	oldContent: z.string().nullable(),
	newContent: z.string().nullable(),
	language: z.string().optional(),
	categories: z.array(changeCategorySchema).min(1),
	events: z.array(changeEventSchema),
	/** Line-level diff, precomputed once contents are hydrated. */
	diff: fileDiffSchema.optional(),
	/** Change stats; available from GitHub even before hydration. */
	additions: z.number().optional(),
	deletions: z.number().optional(),
});

export const reviewSnapshotSchema = z.object({
	baseSha: z.string(),
	headSha: z.string(),
	title: z.string(),
	repo: z.string(),
	baseBranch: z.string(),
	headBranch: z.string(),
	files: z.array(changedFileSchema),
});

export type ChangeCategory = z.infer<typeof changeCategorySchema>;
export type ChangeEvent = z.infer<typeof changeEventSchema>;
export type DiffSegment = z.infer<typeof diffSegmentSchema>;
export type DiffLine = z.infer<typeof diffLineSchema>;
export type DiffHunk = z.infer<typeof diffHunkSchema>;
export type FileDiff = z.infer<typeof fileDiffSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>;
export type CategoryGroup = {
	category: ChangeCategory;
	files: ChangedFile[];
};
export type Explanation = {
	id: string;
	text: string;
	kind: ChangeEvent["kind"];
};
