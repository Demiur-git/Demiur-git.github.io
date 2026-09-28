import { pulsePuzzle } from "../config/pulsePuzzle";

export interface PuzzleProgress {
	version: number;
	started: boolean;
	collected: string[];
	scraps: string[];
	unlocked: boolean;
	worldUnlocked: boolean;
	starfieldUnlocked: boolean;
	echoClueSeen: boolean;
	echoUnlocked: boolean;
}

export function emptyProgress(): PuzzleProgress {
	return {
		version: pulsePuzzle.version,
		started: false,
		collected: [],
		scraps: [],
		unlocked: false,
		worldUnlocked: false,
		starfieldUnlocked: false,
		echoClueSeen: false,
		echoUnlocked: false,
	};
}

export function isPuzzleReady(progress: PuzzleProgress): boolean {
	return (
		progress.started &&
		pulsePuzzle.scraps.every((scrap) => progress.scraps.includes(scrap.id)) &&
		pulsePuzzle.clues.every((clue) => progress.collected.includes(clue.id))
	);
}

export function parseProgress(raw: string | null): PuzzleProgress {
	try {
		const data = JSON.parse(raw || "null");
		if (!data || ![1, 2, 3, 4, pulsePuzzle.version].includes(data.version))
			return emptyProgress();
		const progress: PuzzleProgress = {
			version: pulsePuzzle.version,
			started: data.started === true,
			collected: Array.isArray(data.collected)
				? [
						...new Set<string>(
							data.collected.filter((id: unknown) =>
								pulsePuzzle.clues.some((clue) => clue.id === id),
							),
						),
					]
				: [],
			scraps: Array.isArray(data.scraps)
				? [
						...new Set<string>(
							data.scraps.filter((id: unknown) =>
								pulsePuzzle.scraps.some((scrap) => scrap.id === id),
							),
						),
					]
				: [],
			unlocked: false,
			worldUnlocked: false,
			starfieldUnlocked: false,
			echoClueSeen: false,
			echoUnlocked: false,
		};
		progress.echoClueSeen = data.version >= 5 && data.echoClueSeen === true;
		if (!progress.started)
			return { ...emptyProgress(), echoClueSeen: progress.echoClueSeen };
		// A completed v1 puzzle remains unlocked; its old rule sheet does not collect scraps.
		progress.unlocked =
			data.unlocked === true &&
			pulsePuzzle.clues.every((clue) => progress.collected.includes(clue.id));
		if (data.version === 4 && progress.unlocked && data.echoUnlocked === true)
			progress.echoClueSeen = true;
		progress.worldUnlocked =
			data.version >= 2 && progress.unlocked && data.worldUnlocked === true;
		progress.starfieldUnlocked =
			data.version >= 3 && progress.unlocked && data.starfieldUnlocked === true;
		progress.echoUnlocked =
			data.version >= 4 &&
			progress.unlocked &&
			progress.echoClueSeen &&
			data.echoUnlocked === true;
		return progress;
	} catch {
		return emptyProgress();
	}
}

export function encodeLetter(index: number): number {
	const size = pulsePuzzle.alphabetSize;
	return (
		(((pulsePuzzle.multiplier * index + pulsePuzzle.offset) % size) + size) %
		size
	);
}

export function decodeCipher(cipher: number): string {
	const size = pulsePuzzle.alphabetSize;
	const inverse = Array.from({ length: size }, (_, value) => value).find(
		(value) => (pulsePuzzle.multiplier * value) % size === 1,
	);
	if (inverse === undefined) throw new Error("密码步长与字母循环长度必须互质");
	return String.fromCharCode(
		65 + ((((inverse * (cipher - pulsePuzzle.offset)) % size) + size) % size),
	);
}

export function matchesPuzzleAnswer(answer: string): boolean {
	const expected = [...pulsePuzzle.clues]
		.sort((a, b) => a.order.localeCompare(b.order))
		.map((clue) => decodeCipher(Number(clue.cipher)))
		.join("");
	return answer.trim().toUpperCase() === expected;
}

let memory = emptyProgress();
let storageAvailable = true;

export function getPuzzleProgress(): PuzzleProgress {
	if (typeof window !== "undefined" && storageAvailable) {
		try {
			const current = window.localStorage.getItem(pulsePuzzle.storageKey);
			memory = parseProgress(
				current ??
					window.localStorage.getItem(pulsePuzzle.legacyStorageKey) ??
					window.localStorage.getItem(pulsePuzzle.olderStorageKey) ??
					window.localStorage.getItem(pulsePuzzle.oldestStorageKey) ??
					window.localStorage.getItem(pulsePuzzle.firstStorageKey),
			);
			if (current === null && (memory.started || memory.echoClueSeen))
				window.localStorage.setItem(
					pulsePuzzle.storageKey,
					JSON.stringify(memory),
				);
		} catch {
			storageAvailable = false;
		}
	}
	return {
		...memory,
		collected: [...memory.collected],
		scraps: [...memory.scraps],
	};
}

export function savePuzzleProgress(progress: PuzzleProgress): void {
	memory = parseProgress(JSON.stringify(progress));
	try {
		if (storageAvailable)
			window.localStorage.setItem(
				pulsePuzzle.storageKey,
				JSON.stringify(memory),
			);
	} catch {
		storageAvailable = false;
	}
	window.dispatchEvent(new Event("pulse:progress"));
}

export function collectClue(id: string): PuzzleProgress {
	const progress = getPuzzleProgress();
	if (id === "home") progress.started = true;
	if (
		progress.started &&
		pulsePuzzle.clues.some((clue) => clue.id === id) &&
		!progress.collected.includes(id)
	)
		progress.collected.push(id);
	if (
		progress.started &&
		pulsePuzzle.scraps.some((scrap) => scrap.id === id) &&
		!progress.scraps.includes(id)
	)
		progress.scraps.push(id);
	savePuzzleProgress(progress);
	return getPuzzleProgress();
}

export function tryUnlockPuzzle(answer: string): boolean {
	const progress = getPuzzleProgress();
	if (!isPuzzleReady(progress) || !matchesPuzzleAnswer(answer)) return false;
	progress.unlocked = true;
	savePuzzleProgress(progress);
	return true;
}

export function tryUnlockWorld(word: string): boolean {
	const progress = getPuzzleProgress();
	if (!progress.unlocked || word !== pulsePuzzle.worldAnswer) return false;
	progress.worldUnlocked = true;
	savePuzzleProgress(progress);
	return true;
}

export function tryUnlockStarfield(word: string): boolean {
	const progress = getPuzzleProgress();
	if (!progress.unlocked || word !== pulsePuzzle.starfieldAnswer) return false;
	progress.starfieldUnlocked = true;
	savePuzzleProgress(progress);
	return true;
}

export function collectEchoClue(): PuzzleProgress {
	const progress = getPuzzleProgress();
	if (!progress.echoClueSeen) {
		progress.echoClueSeen = true;
		savePuzzleProgress(progress);
	}
	return getPuzzleProgress();
}

export function resetEchoBranch(): PuzzleProgress {
	const progress = getPuzzleProgress();
	progress.echoClueSeen = false;
	progress.echoUnlocked = false;
	savePuzzleProgress(progress);
	return getPuzzleProgress();
}

export function unlockEcho(): boolean {
	const progress = getPuzzleProgress();
	if (!progress.unlocked || !progress.echoClueSeen) return false;
	progress.echoUnlocked = true;
	savePuzzleProgress(progress);
	return true;
}
