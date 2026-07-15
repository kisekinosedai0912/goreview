import { memo, useState } from "react";
import type {
	CommentAnchor,
	CommentThread,
	CreateCommentInput,
	ReplyToCommentInput,
	ReviewComment,
} from "@goreview/core";

type InlineCommentsProps = {
	anchors: CommentAnchor[];
	threads: CommentThread[];
	onCreate?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReply?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
};

function CommentBody({
	comment,
}: {
	comment: CommentThread["comments"][number];
}) {
	return (
		<div className="inline-comment__comment">
			<div className="inline-comment__author">
				{comment.authorAvatarUrl ? (
					<img src={comment.authorAvatarUrl} alt="" />
				) : null}
				<strong>@{comment.author}</strong>
				<time dateTime={comment.createdAt}>
					{new Date(comment.createdAt).toLocaleString()}
				</time>
			</div>
			<p>{comment.body}</p>
		</div>
	);
}

function InlineComments({
	anchors,
	threads,
	onCreate,
	onReply,
}: InlineCommentsProps) {
	const [activeAnchor, setActiveAnchor] = useState<CommentAnchor | null>(null);
	const [body, setBody] = useState("");
	const [replyingTo, setReplyingTo] = useState<number | null>(null);
	const [replyBody, setReplyBody] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submitComment = async () => {
		if (!activeAnchor || !onCreate || !body.trim()) return;
		setPending(true);
		setError(null);
		try {
			await onCreate({ anchor: activeAnchor, body: body.trim() });
			setBody("");
			setActiveAnchor(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Failed to post comment.");
		} finally {
			setPending(false);
		}
	};

	const submitReply = async (rootId: number) => {
		if (!onReply || !replyBody.trim()) return;
		setPending(true);
		setError(null);
		try {
			await onReply({ rootId, body: replyBody.trim() });
			setReplyBody("");
			setReplyingTo(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Failed to post reply.");
		} finally {
			setPending(false);
		}
	};

	if (!onCreate && threads.length === 0) return null;

	return (
		<div className="inline-comment">
			{threads.map((thread) => (
				<div key={thread.rootId} className="inline-comment__thread">
					{thread.comments.map((comment) => (
						<CommentBody key={comment.id} comment={comment} />
					))}
					{onReply ? (
						replyingTo === thread.rootId ? (
							<div className="inline-comment__composer">
								<textarea
									value={replyBody}
									onChange={(event) => setReplyBody(event.target.value)}
									placeholder="Reply to this thread…"
									rows={3}
									autoFocus
								/>
								<div className="inline-comment__actions">
									<button
										type="button"
										onClick={() => setReplyingTo(null)}
										disabled={pending}
									>
										Cancel
									</button>
									<button
										type="button"
										className="inline-comment__submit"
										onClick={() => void submitReply(thread.rootId)}
										disabled={pending || !replyBody.trim()}
									>
										{pending ? "Posting…" : "Reply"}
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								className="inline-comment__reply"
								onClick={() => setReplyingTo(thread.rootId)}
							>
								Reply
							</button>
						)
					) : null}
				</div>
			))}

			{activeAnchor && onCreate ? (
				<div className="inline-comment__composer">
					<textarea
						value={body}
						onChange={(event) => setBody(event.target.value)}
						placeholder={`Comment on ${activeAnchor.side === "LEFT" ? "old" : "new"} line ${activeAnchor.line}…`}
						rows={4}
						autoFocus
					/>
					<div className="inline-comment__actions">
						<button
							type="button"
							onClick={() => {
								setActiveAnchor(null);
								setBody("");
							}}
							disabled={pending}
						>
							Cancel
						</button>
						<button
							type="button"
							className="inline-comment__submit"
							onClick={() => void submitComment()}
							disabled={pending || !body.trim()}
						>
							{pending ? "Posting…" : "Comment"}
						</button>
					</div>
				</div>
			) : onCreate ? (
				<div className="inline-comment__triggers">
					{anchors.map((anchor) => (
						<button
							key={`${anchor.side}:${anchor.line}`}
							type="button"
							className="inline-comment__trigger"
							onClick={() => setActiveAnchor(anchor)}
							aria-label={`Comment on ${anchor.side === "LEFT" ? "old" : "new"} line ${anchor.line}`}
						>
							+ Comment {anchor.side === "LEFT" ? "old" : "new"} line{" "}
							{anchor.line}
						</button>
					))}
				</div>
			) : null}
			{error ? <p className="inline-comment__error">{error}</p> : null}
		</div>
	);
}

export default memo(InlineComments);
