import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

export const booknavPageConfig: BooknavPageConfig = {
	favicon: {
		enabled: false,
		api: "https://a.favicon.im/{domain}",
	},
};

export const booknavConfig: BooknavGroup[] = [];
