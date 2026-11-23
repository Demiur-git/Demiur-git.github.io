import { navBarConfig } from "../config/navBarConfig";

const sections = new Map<string, string>();
for (const group of navBarConfig.links) {
	for (const link of [group, ...(group.children ?? [])]) {
		if (link.url.startsWith("/") && !link.external)
			sections.set(link.url.split("/")[1], group.name);
	}
}
for (const prefix of ["posts", "series"])
	sections.set(prefix, sections.get("library")!);
sections.set("me", sections.get("about")!);

export function sectionForPath(pathname: string): string | undefined {
	const first = pathname.split("/")[1];
	if (/^\d+$/.test(first)) return sections.get("library");
	return sections.get(first);
}

export function crossesSections(from: string, to: string): boolean {
	const source = sectionForPath(from);
	const target = sectionForPath(to);
	return !!source && !!target && source !== target;
}
