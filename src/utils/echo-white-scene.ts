import { pulsePuzzle } from "../config/pulsePuzzle";
import { EasterEggScene } from "./easter-egg-scene";
import { getPuzzleProgress } from "./pulse-puzzle";
import { url } from "./url-utils";

export class EchoWhiteScene extends EasterEggScene {
	private phase: "waiting" | "dialogue" | "choice" = "waiting";
	private line = 0;
	private shown = 0;
	private startedAt = 0;
	private completedAt = 0;
	private auto = false;

	connectedCallback(): void {
		if (this.active) return;
		if (!getPuzzleProgress().echoUnlocked) {
			document.documentElement.removeAttribute("data-echo-white-pending");
			location.replace(url("/echo/"));
			return;
		}
		this.phase = "waiting";
		this.line = 0;
		this.shown = 0;
		this.auto = false;
		this.querySelector<HTMLElement>("[data-white-dialogue]")!.hidden = true;
		this.querySelector<HTMLElement>("[data-white-choice]")!.hidden = true;
		const auto = this.querySelector<HTMLButtonElement>("[data-white-auto]")!;
		auto.setAttribute("aria-pressed", "false");
		auto.setAttribute("aria-label", "自动推进：关闭");
		const signal = this.mount("/echo/");
		const checkAccess = () => {
			if (this.active && !getPuzzleProgress().echoUnlocked) this.navigate("/echo/");
		};
		window.addEventListener("pulse:progress", checkAccess, { signal });
		window.addEventListener("storage", checkAccess, { signal });
		this.querySelector<HTMLButtonElement>("[data-white-back]")!.addEventListener(
			"click",
			() => this.navigate("/echo/"),
			{ signal },
		);
		auto.addEventListener("click", () => {
			this.auto = !this.auto;
			auto.setAttribute("aria-pressed", String(this.auto));
			auto.setAttribute("aria-label", `自动推进：${this.auto ? "开启" : "关闭"}`);
			this.completedAt = this.visibleTime;
		}, { signal });
		this.dialog.addEventListener("click", (event) => {
			if (this.phase !== "dialogue") return;
			if (event.target instanceof Element && event.target.closest("button,a")) return;
			this.advance();
		}, { signal });
		this.dialog.addEventListener("keydown", (event) => {
			if (this.phase !== "dialogue" || !["Enter", " "].includes(event.key)) return;
			if (event.target instanceof Element && event.target.closest("button,a")) return;
			event.preventDefault();
			if (!event.repeat) this.advance();
		}, { signal });
	}

	protected renderFrame(): void {
		if (this.phase === "waiting") {
			if (this.reduced || this.visibleTime >= 900) this.beginDialogue();
			return;
		}
		if (this.phase !== "dialogue") return;
		const text = pulsePuzzle.echoDialogue[this.line].text;
		const chars = Array.from(text);
		const count = this.reduced ? chars.length : Math.min(chars.length, Math.floor((this.visibleTime - this.startedAt) / 45));
		if (count !== this.shown) {
			this.shown = count;
			this.querySelector<HTMLElement>("[data-white-words]")!.textContent = chars.slice(0, count).join("");
			if (count === chars.length) this.completedAt = this.visibleTime;
		}
		if (this.auto && this.shown === chars.length && this.line < pulsePuzzle.echoDialogue.length - 1 && this.visibleTime - this.completedAt >= 2500)
			this.nextLine();
	}

	private beginDialogue(): void {
		this.phase = "dialogue";
		this.querySelector<HTMLElement>("[data-white-dialogue]")!.hidden = false;
		this.showLine();
		this.dialog.focus({ preventScroll: true });
	}

	private showLine(): void {
		const item = pulsePuzzle.echoDialogue[this.line];
		this.shown = 0;
		this.startedAt = this.visibleTime;
		this.completedAt = this.visibleTime;
		this.querySelector<HTMLElement>("[data-white-speaker]")!.textContent = item.speaker;
		this.querySelector<HTMLElement>("[data-white-accessible]")!.textContent = `${item.speaker}：${item.text}`;
		this.querySelector<HTMLElement>("[data-white-words]")!.textContent = "";
		this.querySelector<HTMLElement>("[data-white-count]")!.textContent = `${this.line + 1} / ${pulsePuzzle.echoDialogue.length}`;
	}

	private nextLine(): void {
		this.line++;
		this.showLine();
	}

	private advance(): void {
		const text = pulsePuzzle.echoDialogue[this.line].text;
		if (this.shown < Array.from(text).length) {
			this.shown = Array.from(text).length;
			this.completedAt = this.visibleTime;
			this.querySelector<HTMLElement>("[data-white-words]")!.textContent = text;
		} else if (this.line < pulsePuzzle.echoDialogue.length - 1) {
			this.nextLine();
		} else {
			this.phase = "choice";
			this.querySelector<HTMLElement>("[data-white-dialogue]")!.hidden = true;
			this.querySelector<HTMLElement>("[data-white-choice]")!.hidden = false;
			this.querySelector<HTMLButtonElement>("[data-white-back]")!.focus({ preventScroll: true });
		}
	}
}
