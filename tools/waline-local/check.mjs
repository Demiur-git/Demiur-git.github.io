import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { userInfo } from "node:os";

// Probe the exact driver used by Waline, without touching its real database.
userInfo();
const require = createRequire(import.meta.url);
const serverRequire = createRequire(require.resolve("@waline/vercel"));
const sqliteRequire = createRequire(serverRequire.resolve("think-model-sqlite"));
const Database = sqliteRequire("better-sqlite3");
const database = new Database(":memory:");
try {
	database.exec("CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT)");
	database.prepare("INSERT INTO probe (value) VALUES (?)").run("绫 / Ling");
	assert.equal(database.prepare("SELECT value FROM probe WHERE id = ?").get(1).value, "绫 / Ling");
	database.prepare("UPDATE probe SET value = ? WHERE id = ?").run("Node 24", 1);
	assert.equal(database.prepare("SELECT value FROM probe WHERE id = ?").get(1).value, "Node 24");
	database.prepare("DELETE FROM probe WHERE id = ?").run(1);
	assert.equal(database.prepare("SELECT COUNT(*) AS count FROM probe").get().count, 0);
	console.log(`PASS: ${process.version} / ${process.platform}-${process.arch}; Windows user info and Waline SQLite CRUD.`);
} finally {
	database.close();
}
