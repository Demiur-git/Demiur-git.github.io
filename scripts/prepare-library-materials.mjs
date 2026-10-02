/** Offline preparation only. Originals/archives live in the OS temporary directory. */
import { mkdtemp, mkdir, readdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const temporary = process.argv[2] || await mkdtemp(path.join(tmpdir(), "palib-materials-"));
const destination = path.resolve("public/assets/library-3d/materials");
await mkdir(destination, { recursive: true });
async function download(address, target) {
	// Native PowerShell follows ambientCG's download redirect on Windows.
	execFileSync("powershell.exe", ["-NoProfile", "-Command", `Invoke-WebRequest -Uri '${address}' -OutFile '${target.replaceAll("'", "''")}'`], { windowsHide: true, stdio: "inherit" });
}
for (const [name, asset] of [["wood", "Wood049"], ["plaster", "Plaster001"], ["fabric", "Fabric026"], ["floor", "wood_floor"]]) {
	const folder = path.join(temporary, name);
	await mkdir(folder, { recursive: true });
	if (name !== "floor") {
		const archive = path.join(temporary, `${asset}.zip`);
		try { await access(archive); } catch { await download(`https://ambientcg.com/get?file=${asset}_1K-PNG.zip`, archive); }
		execFileSync("tar.exe", ["-xf", archive, "-C", folder], { windowsHide: true });
	} else {
		for (const suffix of ["diff", "nor_gl", "rough"])
			await download(`https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/wood_floor/wood_floor_${suffix}_1k.png`, path.join(folder, `${suffix}.png`));
	}
	const names = await readdir(folder);
	for (const [channel, pattern] of [["color", /Color\.png$|^diff\.png$/i], ["normal", /NormalGL\.png$|^nor_gl\.png$/i], ["roughness", /Roughness\.png$|^rough\.png$/i]]) {
		const source = names.find((file) => pattern.test(file));
		if (!source) throw new Error(`${asset}: missing ${channel}`);
		for (const size of [1024, 512]) {
			let pipeline = sharp(path.join(folder, source)).resize(size, size);
			if (name === "fabric" && channel === "color") pipeline = pipeline.grayscale().tint("#a2ac9b");
			await pipeline.webp(channel === "color" ? { quality: 86 } : { lossless: true }).toFile(path.join(destination, `${name}-${channel}-${size}.webp`));
		}
	}
	console.log(`Prepared ${asset}: color, OpenGL normal, roughness (1024/512)`);
}
console.log(`Source downloads retained outside the repository: ${temporary}`);
