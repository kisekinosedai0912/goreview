import { Project, SyntaxKind } from "ts-morph";
import type { ChangeEvent, ChangedFile } from "../schemas/review";

type SymbolInfo = {
	name: string;
	signature: string;
	type: "function" | "class" | "component";
};

function isComponentName(name: string): boolean {
	return /^[A-Z]/.test(name);
}

function getSymbolType(name: string, kind: SyntaxKind): SymbolInfo["type"] {
	if (kind === SyntaxKind.ClassDeclaration) return "class";
	if (isComponentName(name)) return "component";
	return "function";
}

function extractSymbols(content: string | null, path: string): Map<string, SymbolInfo> {
	const symbols = new Map<string, SymbolInfo>();
	if (!content) return symbols;

	try {
		const project = new Project({ useInMemoryFileSystem: true });
		const source = project.createSourceFile(path, content, { overwrite: true });

		for (const fn of source.getFunctions()) {
			const name = fn.getName();
			if (!name || !fn.isExported()) continue;
			symbols.set(name, {
				name,
				signature: fn.getText().split("{")[0]?.trim() ?? name,
				type: getSymbolType(name, SyntaxKind.FunctionDeclaration),
			});
		}

		for (const cls of source.getClasses()) {
			const name = cls.getName();
			if (!name || !cls.isExported()) continue;
			symbols.set(name, {
				name,
				signature: cls.getText().split("{")[0]?.trim() ?? name,
				type: "class",
			});
		}

		for (const variable of source.getVariableDeclarations()) {
			const name = variable.getName();
			const statement = variable.getVariableStatement();
			if (!name || !statement?.isExported()) continue;
			if (!isComponentName(name)) continue;
			symbols.set(name, {
				name,
				signature: statement.getText().split("=")[0]?.trim() ?? name,
				type: "component",
			});
		}
	} catch {
		return symbols;
	}

	return symbols;
}

export function analyzeTypeScript(file: ChangedFile): ChangeEvent[] {
	if (!/\.(ts|tsx)$/.test(file.path)) return [];
	if (file.oldContent === null && file.newContent === null) return [];

	const before = extractSymbols(file.oldContent, file.oldPath ?? file.path);
	const after = extractSymbols(file.newContent, file.path);
	const events: ChangeEvent[] = [];
	const names = new Set([...before.keys(), ...after.keys()]);

	for (const name of names) {
		const oldSymbol = before.get(name);
		const newSymbol = after.get(name);

		if (!oldSymbol && newSymbol) {
			events.push({
				kind: "symbol.added",
				symbol: name,
				type: newSymbol.type,
			});
		} else if (oldSymbol && !newSymbol) {
			events.push({ kind: "symbol.removed", symbol: name });
		} else if (
			oldSymbol &&
			newSymbol &&
			oldSymbol.signature !== newSymbol.signature
		) {
			events.push({
				kind: "signature.changed",
				symbol: name,
				before: oldSymbol.signature,
				after: newSymbol.signature,
			});
		}
	}

	return events;
}
