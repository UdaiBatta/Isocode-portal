import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const executable = fileURLToPath(new URL(
  process.platform === "win32" ? "../.venv/Scripts/python.exe" : "../.venv/bin/python",
  import.meta.url,
));
const child = spawn(existsSync(executable) ? executable : "python", process.argv.slice(2), { stdio: "inherit" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
