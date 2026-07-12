import { memo } from "react";
import type { ReviewSnapshot } from "../schemas/review";

type ReviewMetaProps = {
	snapshot: ReviewSnapshot;
};

function ReviewMeta({ snapshot }: ReviewMetaProps) {
	return (
		<header className="review-meta">
			<div className="review-meta__main">
				<p className="review-meta__eyebrow">Pull request</p>
				<h1 className="review-meta__title">{snapshot.title}</h1>
			</div>

			<div className="review-meta__details">
				<p className="review-meta__repo">{snapshot.repo}</p>
				<p className="review-meta__branches">
					<span className="review-meta__branch">{snapshot.headBranch}</span>
					<span className="review-meta__into" aria-hidden="true">
						into
					</span>
					<span className="review-meta__branch">{snapshot.baseBranch}</span>
				</p>
				<p className="review-meta__sha">
					{snapshot.baseSha.slice(0, 7)}
					<span aria-hidden="true"> → </span>
					{snapshot.headSha.slice(0, 7)}
				</p>
			</div>
		</header>
	);
}

export default memo(ReviewMeta);
