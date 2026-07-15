import {
	memo,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import type { ChangedFile } from "@goreview/core";

type FileJumperProps = {
	open: boolean;
	files: ChangedFile[];
	onClose: () => void;
	onSelect: (path: string) => void;
};

type Match = {
	path: string;
	status: ChangedFile["status"];
	score: number;
	/** Character indices of the query hits, for highlighting. */
	hits: number[];
};

/**
 * Subsequence match with a small scorer: consecutive hits and hits right
 * after a path separator score higher, shorter paths win ties.
 */
function fuzzyMatch(query: string, path: string): Omit<Match, "path" | "status"> | null {
	if (query.length === 0) return { score: 0, hits: [] };

	const lowerPath = path.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const hits: number[] = [];
	let score = 0;
	let pathIndex = 0;

	for (let q = 0; q < lowerQuery.length; q += 1) {
		const char = lowerQuery[q]!;
		const found = lowerPath.indexOf(char, pathIndex);
		if (found === -1) return null;

		if (hits.length > 0 && found === hits[hits.length - 1]! + 1) {
			score += 5; // consecutive run
		}
		if (found === 0 || lowerPath[found - 1] === "/" || lowerPath[found - 1] === ".") {
			score += 3; // start of a segment
		}
		score += 1;
		hits.push(found);
		pathIndex = found + 1;
	}

	score -= Math.floor(path.length / 20);
	return { score, hits };
}

function highlight(path: string, hits: number[]) {
	if (hits.length === 0) return path;
	const set = new Set(hits);
	return path.split("").map((char, index) =>
		set.has(index) ? (
			<b key={index} className="file-jumper__hit">
				{char}
			</b>
		) : (
			char
		),
	);
}

const MAX_RESULTS = 50;

function FileJumper({ open, files, onClose, onSelect }: FileJumperProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);

	// Reset on open (render-phase, keyed on `open` transitions).
	const [wasOpen, setWasOpen] = useState(open);
	if (wasOpen !== open) {
		setWasOpen(open);
		setQuery("");
		setActiveIndex(0);
	}

	useEffect(() => {
		if (open) inputRef.current?.focus();
	}, [open]);

	const matches = useMemo<Match[]>(() => {
		const result: Match[] = [];
		for (const file of files) {
			const match = fuzzyMatch(query, file.path);
			if (match) {
				result.push({ path: file.path, status: file.status, ...match });
			}
		}
		result.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
		return result.slice(0, MAX_RESULTS);
	}, [files, query]);

	const clampedActive = Math.min(activeIndex, Math.max(0, matches.length - 1));

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setActiveIndex(Math.min(clampedActive + 1, matches.length - 1));
				break;
			case "ArrowUp":
				event.preventDefault();
				setActiveIndex(Math.max(clampedActive - 1, 0));
				break;
			case "Enter": {
				event.preventDefault();
				const match = matches[clampedActive];
				if (match) {
					onSelect(match.path);
					onClose();
				}
				break;
			}
			case "Escape":
				event.preventDefault();
				onClose();
				break;
		}
	};

	if (!open) return null;

	return (
		<div
			className="file-jumper__backdrop"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="file-jumper"
				role="dialog"
				aria-modal="true"
				aria-label="Jump to file"
			>
				<input
					ref={inputRef}
					className="file-jumper__input"
					type="text"
					placeholder="Jump to changed file…"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					aria-label="Search changed files"
				/>
				<ul className="file-jumper__results" role="listbox">
					{matches.length === 0 ? (
						<li className="file-jumper__empty">No matching files</li>
					) : (
						matches.map((match, index) => (
							<li key={match.path}>
								<button
									type="button"
									role="option"
									aria-selected={index === clampedActive}
									className="file-jumper__result"
									data-active={index === clampedActive || undefined}
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => {
										onSelect(match.path);
										onClose();
									}}
								>
									<span
										className="tree-file__status"
										data-status={match.status}
									>
										{match.status.charAt(0).toUpperCase()}
									</span>
									<span className="file-jumper__path">
										{highlight(match.path, match.hits)}
									</span>
								</button>
							</li>
						))
					)}
				</ul>
				<footer className="file-jumper__footer">
					<span>↑↓ navigate</span>
					<span>↵ open</span>
					<span>esc close</span>
				</footer>
			</div>
		</div>
	);
}

export default memo(FileJumper);
