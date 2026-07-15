import { notFound } from "next/navigation";
import ReviewClient from "@/components/ReviewClient";

type Params = { owner: string; repo: string; number: string };

export default async function ReviewPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { owner, repo, number: numberParam } = await params;
	const number = Number(numberParam);
	if (!Number.isInteger(number) || number <= 0) notFound();

	return <ReviewClient owner={owner} repo={repo} number={number} />;
}
