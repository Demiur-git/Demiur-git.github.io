export const MORSE_ALPHABET: Readonly<Record<string, string>> = {
	A: ".-",
	B: "-...",
	C: "-.-.",
	D: "-..",
	E: ".",
	F: "..-.",
	G: "--.",
	H: "....",
	I: "..",
	J: ".---",
	K: "-.-",
	L: ".-..",
	M: "--",
	N: "-.",
	O: "---",
	P: ".--.",
	Q: "--.-",
	R: ".-.",
	S: "...",
	T: "-",
	U: "..-",
	V: "...-",
	W: ".--",
	X: "-..-",
	Y: "-.--",
	Z: "--..",
};
export function decodeMorse(symbols: string): string | undefined {
	return Object.keys(MORSE_ALPHABET).find(
		(letter) => MORSE_ALPHABET[letter] === symbols,
	);
}

export class MorseInput {
	symbols = "";
	letters = "";
	append(symbol: "." | "-"): boolean {
		if (this.symbols.length >= 4 || this.letters.length >= 32) return false;
		this.symbols += symbol;
		return true;
	}
	confirm(): boolean {
		const letter = decodeMorse(this.symbols);
		if (!letter) return false;
		this.letters += letter;
		this.symbols = "";
		return true;
	}
	undo(): void {
		if (this.symbols) this.symbols = this.symbols.slice(0, -1);
		else if (this.letters) {
			this.letters = this.letters.slice(0, -1);
		}
	}
	clear(): void {
		this.symbols = "";
		this.letters = "";
	}
}
