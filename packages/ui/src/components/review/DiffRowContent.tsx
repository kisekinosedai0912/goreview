import { memo } from "react";
import {
	anchorsForDiffLine,
	type ChangedFile,
	type CodeExplanation,
	type CommentAnchor,
	type CommentThread,
	type CreateCommentInput,
	type DiffLine,
	type DiffSegment,
	type ReplyToCommentInput,
	type ReviewComment,
} from "@goreview/core";
import { useHighlightedLine } from "../../highlight/use-highlighted";
import type { TokenLine, TokenSpan } from "../../highlight/types";
import InlineComments from "./InlineComments";
import { reviewAnchorKey } from "./anchor-key";
import type { DiffRow } from "./diff-rows";

type ThemeName = "light" | "dark";

type DiffRowContentProps = {
	file: ChangedFile;
	row: DiffRow;
	theme: ThemeName;
	threads: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
	lineExplanations: ReadonlyMap<string, CodeExplanation>;
	explainingAnchors: ReadonlySet<string>;
	onExplainLine?: (anchor: CommentAnchor) => void;
	onDismissLineExplanation?: (anchor: CommentAnchor) => void;
	onToggleHunk: (hunkIndex: number) => void;
	onExpandGap: (gapIndex: number) => void;
};

type CommentableLineProps = {
	path: string;
	commentable: boolean;
	threads: CommentThread[];
	onCreateComment?: (input: CreateCommentInput) => Promise<ReviewComment>;
	onReplyToComment?: (input: ReplyToCommentInput) => Promise<ReviewComment>;
	lineExplanations: ReadonlyMap<string, CodeExplanation>;
	explainingAnchors: ReadonlySet<string>;
	onExplainLine?: (anchor: CommentAnchor) => void;
	onDismissLineExplanation?: (anchor: CommentAnchor) => void;
};

function threadsAtAnchors(
	threads: CommentThread[],
	anchors: CommentAnchor[],
): CommentThread[] {
	if (anchors.length === 0 || threads.length === 0) return [];
	const keys = new Set(
		anchors.map((anchor) => `${anchor.path}:${anchor.side}:${anchor.line}`),
	);
	return threads.filter(
		(thread) =>
			thread.anchor &&
			keys.has(
				`${thread.anchor.path}:${thread.anchor.side}:${thread.anchor.line}`,
			),
	);
}

type RenderSpan = TokenSpan & { emphasized: boolean };

function mergeTokensWithSegments(
	tokens: TokenLine,
	segments: DiffSegment[] | undefined,
): RenderSpan[] {
	if (!segments || segments.length === 0) {
		return tokens.map((token) => ({ ...token, emphasized: false }));
	}

	const result: RenderSpan[] = [];
	let tokenIndex = 0;
	let tokenOffset = 0;
	for (const segment of segments) {
		let remaining = segment.value.length;
		while (remaining > 0 && tokenIndex < tokens.length) {
			const token = tokens[tokenIndex]!;
			const available = token.content.length - tokenOffset;
			const take = Math.min(available, remaining);
			result.push({
				content: token.content.slice(tokenOffset, tokenOffset + take),
				color: token.color,
				emphasized: segment.changed,
			});
			remaining -= take;
			tokenOffset += take;
			if (tokenOffset >= token.content.length) {
				tokenIndex += 1;
				tokenOffset = 0;
			}
		}
		if (remaining > 0) {
			result.push({
				content: segment.value.slice(segment.value.length - remaining),
				emphasized: segment.changed,
			});
		}
	}
	while (tokenIndex < tokens.length) {
		const token = tokens[tokenIndex]!;
		result.push({
			content: token.content.slice(tokenOffset),
			color: token.color,
			emphasized: false,
		});
		tokenIndex += 1;
		tokenOffset = 0;
	}
	return result;
}

function segmentsOnly(segments: DiffSegment[]): RenderSpan[] {
	return segments.map((segment) => ({
		content: segment.value,
		emphasized: segment.changed,
	}));
}

const LineContent = memo(function LineContent({
	line,
	tokens,
}: {
	line: DiffLine;
	tokens: TokenLine | null;
}) {
	const spans = tokens
		? mergeTokensWithSegments(tokens, line.segments)
		: line.segments
			? segmentsOnly(line.segments)
			: [{ content: line.content, emphasized: false }];

	return (
		<span className="diff-line__content">
			{spans.map((span, index) =>
				span.emphasized ? (
					<mark
						key={index}
						className="diff-line__emphasis"
						style={span.color ? { color: span.color } : undefined}
					>
						{span.content}
					</mark>
				) : (
					<span
						key={index}
						style={span.color ? { color: span.color } : undefined}
					>
						{span.content}
					</span>
				),
			)}
		</span>
	);
});

const UnifiedLine = memo(function UnifiedLine({
	file,
	line,
	theme,
	commentable,
	threads,
	onCreateComment,
	onReplyToComment,
	lineExplanations,
	explainingAnchors,
	onExplainLine,
	onDismissLineExplanation,
}: {
	file: ChangedFile;
	line: DiffLine;
	theme: ThemeName;
} & Omit<CommentableLineProps, "path">) {
	const tokens = useHighlightedLine(line.content, file.language, theme);
	const anchors = commentable
		? anchorsForDiffLine(file.path, line).filter(
				(anchor) => line.type !== "context" || anchor.side === "RIGHT",
			)
		: [];
	return (
		<div className="diff-line-block">
			<div className="diff-line" data-type={line.type}>
				<span className="diff-line__gutter">{line.oldNumber ?? ""}</span>
				<span className="diff-line__gutter">{line.newNumber ?? ""}</span>
				<span className="diff-line__marker" aria-hidden="true">
					{line.type === "added" ? "+" : line.type === "removed" ? "−" : ""}
				</span>
				<LineContent line={line} tokens={tokens} />
			</div>
			<InlineComments
				anchors={anchors}
				threads={threadsAtAnchors(threads, anchors)}
				onCreate={onCreateComment}
				onReply={onReplyToComment}
				onExplain={onExplainLine}
				explaining={anchors.some((anchor) =>
					explainingAnchors.has(reviewAnchorKey(anchor)),
				)}
				explanation={anchors
					.map((anchor) => lineExplanations.get(reviewAnchorKey(anchor)))
					.find((value) => value !== undefined)}
				explanationAnchor={anchors.find((anchor) =>
					lineExplanations.has(reviewAnchorKey(anchor)),
				)}
				onDismissExplanation={onDismissLineExplanation}
			/>
		</div>
	);
});

const SplitPair = memo(function SplitPair({
	file,
	left,
	right,
	theme,
	commentable,
	threads,
	onCreateComment,
	onReplyToComment,
	lineExplanations,
	explainingAnchors,
	onExplainLine,
	onDismissLineExplanation,
}: {
	file: ChangedFile;
	left: DiffLine | null;
	right: DiffLine | null;
	theme: ThemeName;
} & Omit<CommentableLineProps, "path">) {
	const leftTokens = useHighlightedLine(left?.content ?? "", file.language, theme);
	const rightTokens = useHighlightedLine(right?.content ?? "", file.language, theme);
	const anchors = commentable
		? [
				...(left
					? anchorsForDiffLine(file.path, left).filter(
							(anchor) => anchor.side === "LEFT",
						)
					: []),
				...(right
					? anchorsForDiffLine(file.path, right).filter(
							(anchor) => anchor.side === "RIGHT",
						)
					: []),
			]
		: [];
	return (
		<div
			className="diff-line-block"
			data-split
			data-single-side={
				file.status === "added"
					? "right"
					: file.status === "deleted"
						? "left"
						: undefined
			}
		>
			<div className="diff-pair">
				<div
					className="diff-line diff-line--half"
					data-type={
						left ? (left.type === "context" ? "context" : "removed") : "spacer"
					}
				>
					{left ? (
						<>
							<span className="diff-line__gutter">{left.oldNumber ?? ""}</span>
							<span className="diff-line__marker" aria-hidden="true">
								{left.type === "removed" ? "−" : ""}
							</span>
							<LineContent line={left} tokens={leftTokens} />
						</>
					) : null}
				</div>
				<div
					className="diff-line diff-line--half"
					data-type={
						right ? (right.type === "context" ? "context" : "added") : "spacer"
					}
				>
					{right ? (
						<>
							<span className="diff-line__gutter">{right.newNumber ?? ""}</span>
							<span className="diff-line__marker" aria-hidden="true">
								{right.type === "added" ? "+" : ""}
							</span>
							<LineContent line={right} tokens={rightTokens} />
						</>
					) : null}
				</div>
			</div>
			<InlineComments
				anchors={anchors}
				threads={threadsAtAnchors(threads, anchors)}
				onCreate={onCreateComment}
				onReply={onReplyToComment}
				onExplain={onExplainLine}
				explaining={anchors.some((anchor) =>
					explainingAnchors.has(reviewAnchorKey(anchor)),
				)}
				explanation={anchors
					.map((anchor) => lineExplanations.get(reviewAnchorKey(anchor)))
					.find((value) => value !== undefined)}
				explanationAnchor={anchors.find((anchor) =>
					lineExplanations.has(reviewAnchorKey(anchor)),
				)}
				onDismissExplanation={onDismissLineExplanation}
			/>
		</div>
	);
});

function DiffRowContent({
	file,
	row,
	theme,
	threads,
	onCreateComment,
	onReplyToComment,
	lineExplanations,
	explainingAnchors,
	onExplainLine,
	onDismissLineExplanation,
	onToggleHunk,
	onExpandGap,
}: DiffRowContentProps) {
	if (row.type === "hunk") {
		return (
			<button
				type="button"
				className="diff-hunk-header"
				aria-expanded={!row.collapsed}
				onClick={() => onToggleHunk(row.hunkIndex)}
			>
				<span
					className="tree-dir__chevron"
					data-collapsed={row.collapsed || undefined}
					aria-hidden="true"
				/>
				<span className="diff-hunk-header__range">{row.header}</span>
				{row.collapsed ? (
					<span className="diff-hunk-header__hidden">
						{row.hiddenLines} hidden lines
					</span>
				) : null}
			</button>
		);
	}
	if (row.type === "gap") {
		return (
			<button
				type="button"
				className="diff-gap"
				onClick={() => onExpandGap(row.gapIndex)}
			>
				⋯ Expand {row.count} unchanged {row.count === 1 ? "line" : "lines"}
			</button>
		);
	}
	const shared = {
		file,
		theme,
		commentable: row.commentable,
		threads,
		onCreateComment,
		onReplyToComment,
		lineExplanations,
		explainingAnchors,
		onExplainLine,
		onDismissLineExplanation,
	};
	return row.type === "line" ? (
		<UnifiedLine {...shared} line={row.line} />
	) : (
		<SplitPair {...shared} left={row.left} right={row.right} />
	);
}

export default memo(DiffRowContent);
