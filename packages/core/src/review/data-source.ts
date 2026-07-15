import type {
	CommentAnchor,
	CommentThread,
	CreateCommentInput,
	ReplyToCommentInput,
	ReviewComment,
} from "../schemas/comment";
import type {
	CodeExplanation,
	ReviewIntelligence,
} from "../schemas/intelligence";
import type { ChangedFile } from "../schemas/review";

export type ExplainCodeInput = {
	path: string;
	anchor?: CommentAnchor;
};

/**
 * Runtime boundary shared by the hosted app, browser extension, and fixture
 * demo. UI components never know whether operations are HTTP, extension
 * messages, or local fixture functions.
 */
export type ReviewDataSource = {
	ensureFile(path: string): Promise<ChangedFile>;
	listCommentThreads?(): Promise<CommentThread[]>;
	createComment?(input: CreateCommentInput): Promise<ReviewComment>;
	replyToComment?(input: ReplyToCommentInput): Promise<ReviewComment>;
	getIntelligence?(): Promise<ReviewIntelligence>;
	explainCode?(input: ExplainCodeInput): Promise<CodeExplanation>;
};
