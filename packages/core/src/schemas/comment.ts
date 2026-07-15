import { z } from "zod";

/**
 * Comment anchors use GitHub's diff coordinates: LEFT is the base (old)
 * side, RIGHT is the head (new) side. A line is only anchorable when it
 * appears in the pull request diff.
 */
export const commentSideSchema = z.enum(["LEFT", "RIGHT"]);

export const commentAnchorSchema = z.object({
	path: z.string(),
	side: commentSideSchema,
	line: z.number().int().positive(),
});

export const reviewCommentSchema = z.object({
	/** GitHub review comment id. */
	id: z.number(),
	/** Top-level comment id of the thread (equals `id` for thread roots). */
	threadRootId: z.number(),
	/** Null when the comment no longer maps to the current diff (outdated). */
	anchor: commentAnchorSchema.nullable(),
	body: z.string(),
	author: z.string(),
	authorAvatarUrl: z.string().optional(),
	createdAt: z.string(),
	htmlUrl: z.string().optional(),
	/** True when GitHub reports the comment as outdated for the current head. */
	outdated: z.boolean(),
});

export const commentThreadSchema = z.object({
	rootId: z.number(),
	anchor: commentAnchorSchema.nullable(),
	path: z.string(),
	comments: z.array(reviewCommentSchema).min(1),
});

export type CommentSide = z.infer<typeof commentSideSchema>;
export type CommentAnchor = z.infer<typeof commentAnchorSchema>;
export type ReviewComment = z.infer<typeof reviewCommentSchema>;
export type CommentThread = z.infer<typeof commentThreadSchema>;

export type CreateCommentInput = {
	anchor: CommentAnchor;
	body: string;
};

export type ReplyToCommentInput = {
	/** Id of the thread's top-level comment. */
	rootId: number;
	body: string;
};
