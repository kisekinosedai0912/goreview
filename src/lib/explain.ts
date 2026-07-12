import type { ChangeEvent, Explanation } from "../schemas/review";

const templates: {
	[K in ChangeEvent["kind"]]: (event: Extract<ChangeEvent, { kind: K }>) => string;
} = {
	"symbol.added": (event) =>
		`Added ${event.type} \`${event.symbol}\``,
	"symbol.removed": (event) =>
		`Removed symbol \`${event.symbol}\``,
	"signature.changed": (event) =>
		`Changed signature of \`${event.symbol}\`: ${event.before} → ${event.after}`,
	"dependency.added": (event) =>
		`Added package ${event.name}@${event.version}`,
	"dependency.updated": (event) =>
		`Updated package ${event.name}: ${event.before} → ${event.after}`,
};

export function explainEvent(
	event: ChangeEvent,
	index: number,
): Explanation {
	return {
		id: `${event.kind}-${index}`,
		text: templates[event.kind](event as never),
		kind: event.kind,
	};
}

export function explainEvents(events: ChangeEvent[]): Explanation[] {
	return events.map(explainEvent);
}
