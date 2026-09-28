import { pulsePuzzle } from "../config/pulsePuzzle";
import { url } from "./url-utils";

export function pulseSceneRoute(): string {
	return `/pulse/${pulsePuzzle.holdHint.base64url}/`;
}

export function pulseScenePath(): string {
	return url(pulseSceneRoute());
}
