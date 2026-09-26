import { createServer } from "node:http";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadEnvFile } from "node:process";

const directory = fileURLToPath(new URL(".", import.meta.url));
const dataDirectory = join(directory, "data");
const envFile = join(directory, ".env");
await mkdir(dataDirectory, { recursive: true });
try { await access(envFile); } catch {
	await writeFile(envFile, `JWT_TOKEN=${randomBytes(48).toString("hex")}\n`, { flag: "wx", mode: 0o600 });
}
loadEnvFile(envFile);
const databaseFile = join(dataDirectory, "waline.sqlite");
const database = new DatabaseSync(databaseFile);
database.exec(await readFile(new URL("schema.sql", import.meta.url), "utf8"));
database.close();
if (process.argv.includes("--init")) {
	console.log("Local Waline database prepared. No administrator or test comments were created.");
	process.exit(0);
}

const require = createRequire(import.meta.url);
try {
	const serverRequire = createRequire(require.resolve("@waline/vercel"));
	const sqliteRequire = createRequire(serverRequire.resolve("think-model-sqlite"));
	const Driver = sqliteRequire("better-sqlite3");
	const probe = new Driver(":memory:");
	probe.close();
} catch {
	console.error("SQLite native driver is unavailable on this Node/Windows environment. Service was NOT started.");
	console.error("See README.md. No Docker, cloud resources or system compiler are installed automatically.");
	process.exit(1);
}

const port = Number(process.env.WALINE_PORT || 8360);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Invalid WALINE_PORT");
const origin = `http://127.0.0.1:${port}`;
Object.assign(process.env, {
	SQLITE_PATH: dataDirectory, SQLITE_DB: "waline", COMMENT_AUDIT: "true",
	IPQPS: "60", SITE_NAME: "Demiur", SITE_URL: "http://localhost:4321",
	SECURE_DOMAINS: "localhost,127.0.0.1", LOGIN: "disable",
	DISABLE_USERAGENT: "true", DISABLE_REGION: "true", AVATAR_PROXY: "false",
	AKISMET_KEY: "false", MARKDOWN_TEX: "false", OAUTH_URL: `${origin}/local-oauth`,
});
// No local OAuth providers are offered; the public guest form is deliberately login-free.
const handler = require("@waline/vercel")({ audit: true });
const server = createServer((request, response) => {
	if (request.url === "/local-oauth") {
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ services: [] }));
		return;
	}
	Promise.resolve(handler(request, response)).catch(() => {
		if (!response.headersSent) response.writeHead(503, { "Content-Type": "application/json" });
		response.end(JSON.stringify({ errno: 503, errmsg: "Local service unavailable" }));
	});
});
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => {
	console.log(`Waline: ${origin}; admin: ${origin}/ui; stop with Ctrl+C.`);
	console.log("All new guest comments require administrator approval. Register the first admin yourself.");
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
