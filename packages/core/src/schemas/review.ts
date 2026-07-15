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

export const changedFileSchema = z.object({
	path: z.string(),
	status: z.enum(["added", "modified", "deleted", "renamed"]),
	oldPath: z.string().optional(),
	oldContent: z.string().nullable(),
	newContent: z.string().nullable(),
	language: z.string().optional(),
	categories: z.array(changeCategorySchema).min(1),
	events: z.array(changeEventSchema),
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
