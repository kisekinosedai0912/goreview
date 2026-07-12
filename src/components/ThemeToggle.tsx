import { memo, useCallback, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
	const isDark = theme === "dark";
	const id = useId();

	const onCheckedChange = useCallback((checked: boolean) => {
		const next: Theme = checked ? "dark" : "light";
		applyTheme(next);
		setTheme(next);
	}, []);

	return (
		<div className="theme-toggle">
			<Label htmlFor={id} className="theme-toggle__label">
				{isDark ? "Dark" : "Light"}
			</Label>
			<Switch
				id={id}
				size="sm"
				checked={isDark}
				onCheckedChange={onCheckedChange}
				aria-label="Toggle dark mode"
				className="theme-toggle__switch"
			/>
		</div>
	);
}

export default memo(ThemeToggle);
