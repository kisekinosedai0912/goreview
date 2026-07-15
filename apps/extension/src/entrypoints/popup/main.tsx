import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { backendUrl, DEFAULT_BACKEND } from "../../lib/settings";
import "./popup.css";

function Popup() {
	const [value, setValue] = useState("");
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		void backendUrl.getValue().then(setValue);
	}, []);

	const onSubmit = async (event: FormEvent) => {
		event.preventDefault();
		const next = value.trim().replace(/\/$/, "") || DEFAULT_BACKEND;
		await backendUrl.setValue(next);
		setValue(next);
		setSaved(true);
		setTimeout(() => setSaved(false), 1500);
	};

	return (
		<form className="popup" onSubmit={onSubmit}>
			<h1 className="popup__title">GoReview</h1>
			<label className="popup__label" htmlFor="backend">
				Backend URL
			</label>
			<input
				id="backend"
				className="popup__input"
				type="url"
				value={value}
				placeholder={DEFAULT_BACKEND}
				onChange={(event) => setValue(event.target.value)}
			/>
			<button type="submit" className="popup__save">
				{saved ? "Saved" : "Save"}
			</button>
			<p className="popup__hint">
				Point this at your goreview deployment. Sign in there once and the
				extension reuses the session.
			</p>
		</form>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Popup />
	</StrictMode>,
);
