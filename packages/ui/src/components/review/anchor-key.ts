import type { CommentAnchor } from "@goreview/core";

export function reviewAnchorKey(anchor: CommentAnchor): string {
	return `${anchor.path}:${anchor.side}:${anchor.line}`;
}
