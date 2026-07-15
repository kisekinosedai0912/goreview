import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import {
	buildFileTree,
	flattenTree,
	groupByCategory,
	type ChangeCategory,
	type ChangedFile,
	type FileTreeDirectory,
	type FileTreeLeaf,
} from "@goreview/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import CategoryBadge from "./CategoryBadge";

type GroupMode = "directory" | "category";
type FileStatus = ChangedFile["status"];

type TreeRow =
	| { type: "dir"; key: string; depth: number; node: FileTreeDirectory }
	| { type: "file"; key: string; depth: number; node: FileTreeLeaf }
	| {
			type: "category";
			key: string;
			depth: number;
			category: ChangeCategory;
			count: number;
	  };

type FileTreeCompareProps = {
	files: ChangedFile[];
	selectedPath: string | null;
	onSelect: (path: string) => void;
};

const STATUS_GLYPHS: Record<FileStatus, string> = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
};

const STATUS_LABELS: Record<FileStatus, string> = {
	added: "Added",
	modified: "Modified",
	deleted: "Deleted",
	renamed: "Renamed",
};

const ALL_STATUSES: FileStatus[] = ["added", "modified", "deleted", "renamed"];

const ROW_HEIGHT = 30;

function fileToLeaf(file: ChangedFile): FileTreeLeaf {
	return {
		kind: "file",
		name: file.path.split("/").pop() ?? file.path,
		path: file.path,
		status: file.status,
		oldPath: file.oldPath,
		categories: file.categories,
		additions: file.additions ?? file.diff?.additions ?? 0,
		deletions: file.deletions ?? file.diff?.deletions ?? 0,
	};
}

function FileTreeCompare({ files, selectedPath, onSelect }: FileTreeCompareProps) {
	const [groupMode, setGroupMode] = useState<GroupMode>("directory");
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const [statusFilter, setStatusFilter] = useState<ReadonlySet<FileStatus>>(
		new Set(),
	);
	const [categoryFilter, setCategoryFilter] = useState<
		ReadonlySet<ChangeCategory>
	>(new Set());
	const [activeIndex, setActiveIndex] = useState(0);

	const scrollRef = useRef<HTMLDivElement | null>(null);

	const presentCategories = useMemo(() => {
		const seen = new Set<ChangeCategory>();
		for (const file of files) {
			for (const category of file.categories) seen.add(category);
		}
		return [...seen];
	}, [files]);

	const filteredFiles = useMemo(() => {
		return files.filter((file) => {
			if (statusFilter.size > 0 && !statusFilter.has(file.status)) {
				return false;
			}
			if (
				categoryFilter.size > 0 &&
				!file.categories.some((category) => categoryFilter.has(category))
			) {
				return false;
			}
			return true;
		});
	}, [files, statusFilter, categoryFilter]);

	const rows = useMemo<TreeRow[]>(() => {
		if (groupMode === "directory") {
			const tree = buildFileTree(filteredFiles);
			return flattenTree(tree, (path) => !collapsed.has(path)).map((row) =>
				row.node.kind === "directory"
					? {
							type: "dir" as const,
							key: `dir:${row.node.path}`,
							depth: row.depth,
							node: row.node,
						}
					: {
							type: "file" as const,
							key: `file:${row.node.path}`,
							depth: row.depth,
							node: row.node,
						},
			);
		}

		const groups = groupByCategory(filteredFiles);
		const result: TreeRow[] = [];
		for (const group of groups) {
			result.push({
				type: "category",
				key: `category:${group.category}`,
				depth: 0,
				category: group.category,
				count: group.files.length,
			});
			if (collapsed.has(`category:${group.category}`)) continue;
			for (const file of group.files) {
				result.push({
					type: "file",
					key: `category:${group.category}:${file.path}`,
					depth: 1,
					node: fileToLeaf(file),
				});
			}
		}
		return result;
	}, [groupMode, filteredFiles, collapsed]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 12,
	});

	const toggleCollapse = useCallback((key: string) => {
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const activateRow = useCallback(
		(row: TreeRow) => {
			if (row.type === "file") {
				onSelect(row.node.path);
			} else if (row.type === "dir") {
				toggleCollapse(row.node.path);
			} else {
				toggleCollapse(`category:${row.category}`);
			}
		},
		[onSelect, toggleCollapse],
	);

	const moveActive = useCallback(
		(index: number) => {
			const clamped = Math.max(0, Math.min(rows.length - 1, index));
			setActiveIndex(clamped);
			virtualizer.scrollToIndex(clamped);
		},
		[rows.length, virtualizer],
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const row = rows[activeIndex];
			if (!row) return;

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					moveActive(activeIndex + 1);
					break;
				case "ArrowUp":
					event.preventDefault();
					moveActive(activeIndex - 1);
					break;
				case "Home":
					event.preventDefault();
					moveActive(0);
					break;
				case "End":
					event.preventDefault();
					moveActive(rows.length - 1);
					break;
				case "ArrowRight": {
					event.preventDefault();
					const key =
						row.type === "dir"
							? row.node.path
							: row.type === "category"
								? `category:${row.category}`
								: null;
					if (key && collapsed.has(key)) toggleCollapse(key);
					else moveActive(activeIndex + 1);
					break;
				}
				case "ArrowLeft": {
					event.preventDefault();
					const key =
						row.type === "dir"
							? row.node.path
							: row.type === "category"
								? `category:${row.category}`
								: null;
					if (key && !collapsed.has(key)) {
						toggleCollapse(key);
					} else {
						// Jump to the parent row.
						for (let i = activeIndex - 1; i >= 0; i -= 1) {
							const candidate = rows[i]!;
							if (candidate.depth < row.depth) {
								moveActive(i);
								break;
							}
						}
					}
					break;
				}
				case "Enter":
				case " ":
					event.preventDefault();
					activateRow(row);
					break;
			}
		},
		[rows, activeIndex, collapsed, moveActive, toggleCollapse, activateRow],
	);

	const toggleStatus = useCallback((status: FileStatus) => {
		setStatusFilter((current) => {
			const next = new Set(current);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			return next;
		});
	}, []);

	const toggleCategory = useCallback((category: ChangeCategory) => {
		setCategoryFilter((current) => {
			const next = new Set(current);
			if (next.has(category)) next.delete(category);
			else next.add(category);
			return next;
		});
	}, []);

	return (
		<div className="tree-compare">
			<div className="tree-compare__controls">
				<div
					className="tree-compare__modes"
					role="tablist"
					aria-label="Group files by"
				>
					<button
						type="button"
						role="tab"
						aria-selected={groupMode === "directory"}
						className="tree-compare__mode"
						onClick={() => setGroupMode("directory")}
					>
						Tree
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={groupMode === "category"}
						className="tree-compare__mode"
						onClick={() => setGroupMode("category")}
					>
						Category
					</button>
				</div>

				<div className="tree-compare__filters" aria-label="Filter by status">
					{ALL_STATUSES.map((status) => (
						<button
							key={status}
							type="button"
							className="tree-compare__filter"
							data-status={status}
							aria-pressed={statusFilter.has(status)}
							title={`${STATUS_LABELS[status]} files`}
							onClick={() => toggleStatus(status)}
						>
							{STATUS_GLYPHS[status]}
						</button>
					))}
				</div>

				{presentCategories.length > 1 ? (
					<div
						className="tree-compare__filters tree-compare__filters--categories"
						aria-label="Filter by category"
					>
						{presentCategories.map((category) => (
							<button
								key={category}
								type="button"
								className="tree-compare__filter tree-compare__filter--category"
								aria-pressed={categoryFilter.has(category)}
								onClick={() => toggleCategory(category)}
							>
								{category}
							</button>
						))}
					</div>
				) : null}
			</div>

			<div
				ref={scrollRef}
				className="tree-compare__scroll"
				role="tree"
				aria-label="Changed files"
				tabIndex={0}
				onKeyDown={handleKeyDown}
			>
				{rows.length === 0 ? (
					<p className="tree-compare__empty">No files match the filters.</p>
				) : (
					<div
						className="tree-compare__list"
						style={{ height: virtualizer.getTotalSize() }}
					>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const row = rows[virtualRow.index]!;
							const isActive = virtualRow.index === activeIndex;

							return (
								<div
									key={row.key}
									className="tree-compare__row"
									style={{
										transform: `translateY(${virtualRow.start}px)`,
										height: virtualRow.size,
									}}
								>
									{row.type === "dir" ? (
										<button
											type="button"
											role="treeitem"
											aria-expanded={!collapsed.has(row.node.path)}
											className="tree-dir"
											data-active={isActive || undefined}
											style={{ paddingLeft: row.depth * 14 + 8 }}
											onClick={() => {
												setActiveIndex(virtualRow.index);
												toggleCollapse(row.node.path);
											}}
											tabIndex={-1}
										>
											<span
												className="tree-dir__chevron"
												data-collapsed={
													collapsed.has(row.node.path) || undefined
												}
												aria-hidden="true"
											/>
											<span className="tree-dir__name">{row.node.name}</span>
											<span className="tree-dir__stats">
												<span className="tree-stats__count">
													{row.node.stats.files}
												</span>
												<span className="tree-stats__additions">
													+{row.node.stats.additions}
												</span>
												<span className="tree-stats__deletions">
													−{row.node.stats.deletions}
												</span>
											</span>
										</button>
									) : row.type === "category" ? (
										<button
											type="button"
											role="treeitem"
											aria-expanded={!collapsed.has(`category:${row.category}`)}
											className="tree-category"
											data-active={isActive || undefined}
											onClick={() => {
												setActiveIndex(virtualRow.index);
												toggleCollapse(`category:${row.category}`);
											}}
											tabIndex={-1}
										>
											<span
												className="tree-dir__chevron"
												data-collapsed={
													collapsed.has(`category:${row.category}`) || undefined
												}
												aria-hidden="true"
											/>
											<CategoryBadge category={row.category} />
											<span className="tree-category__count">{row.count}</span>
										</button>
									) : (
										<button
											type="button"
											role="treeitem"
											aria-selected={selectedPath === row.node.path}
											className="tree-file"
											data-active={isActive || undefined}
											data-selected={
												selectedPath === row.node.path || undefined
											}
											style={{ paddingLeft: row.depth * 14 + 8 }}
											onClick={() => {
												setActiveIndex(virtualRow.index);
												onSelect(row.node.path);
											}}
											tabIndex={-1}
										>
											<span
												className="tree-file__status"
												data-status={row.node.status}
												title={STATUS_LABELS[row.node.status]}
											>
												{STATUS_GLYPHS[row.node.status]}
											</span>
											<span className="tree-file__name" title={row.node.path}>
												{groupMode === "category"
													? row.node.path
													: row.node.name}
											</span>
											<span className="tree-file__stats">
												{row.node.additions > 0 ? (
													<span className="tree-stats__additions">
														+{row.node.additions}
													</span>
												) : null}
												{row.node.deletions > 0 ? (
													<span className="tree-stats__deletions">
														−{row.node.deletions}
													</span>
												) : null}
											</span>
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

export default memo(FileTreeCompare);
