"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/** Accepts "owner/repo#123" or a full GitHub PR URL. */
function parseTarget(input: string): { owner: string; repo: string; number: number } | null {
	const trimmed = input.trim();

	const urlMatch = trimmed.match(
		/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/,
	);
	if (urlMatch) {
		return {
			owner: urlMatch[1]!,
			repo: urlMatch[2]!,
			number: Number(urlMatch[3]),
		};
	}

	const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)#(\d+)$/);
	if (shortMatch) {
		return {
			owner: shortMatch[1]!,
			repo: shortMatch[2]!,
			number: Number(shortMatch[3]),
		};
	}

	return null;
}

export default function OpenPrForm() {
	const [value, setValue] = useState("");
	const [invalid, setInvalid] = useState(false);
	const router = useRouter();

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();
		const target = parseTarget(value);
		if (!target) {
			setInvalid(true);
			return;
		}
		router.push(`/r/${target.owner}/${target.repo}/${target.number}`);
	};

	return (
		<form className="open-pr" onSubmit={onSubmit}>
			<input
				className="open-pr__input"
				type="text"
				placeholder="owner/repo#123 or a GitHub PR URL"
				value={value}
				onChange={(event) => {
					setValue(event.target.value);
					setInvalid(false);
				}}
				aria-label="Pull request to open"
				aria-invalid={invalid || undefined}
			/>
			<button type="submit" className="open-pr__submit">
				Review
			</button>
			{invalid ? (
				<p className="open-pr__error">
					Use owner/repo#number or paste a PR link.
				</p>
			) : null}
		</form>
	);
}
