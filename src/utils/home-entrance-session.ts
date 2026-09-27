export const HOME_INTRO_SEEN_KEY = "demiur-home-intro-seen-v1";

interface EntranceSession {
	__demiurHomeIntroSeen?: boolean;
	readonly sessionStorage: Pick<Storage, "getItem" | "setItem">;
}

export function hasSeenHomeEntrance(session: EntranceSession = window): boolean {
	if (session.__demiurHomeIntroSeen) return true;
	try {
		if (session.sessionStorage.getItem(HOME_INTRO_SEEN_KEY) === "1") {
			session.__demiurHomeIntroSeen = true;
			return true;
		}
	} catch {
		// A blocked storage getter must not prevent entry or in-page navigation.
	}
	return false;
}

export function markHomeEntranceSeen(session: EntranceSession = window): void {
	session.__demiurHomeIntroSeen = true;
	try {
		session.sessionStorage.setItem(HOME_INTRO_SEEN_KEY, "1");
	} catch {
		// The window flag still survives Swup navigation without storage access.
	}
}
