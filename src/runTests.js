/**
 * runTests.js — Full lifecycle test runner
 * 1. Start the server
 * 2. Wait until it is listening on the configured port
 * 3. Run the test suite
 * 4. Kill the server (always, even on failure)
 */

"use strict";

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

// ── Load env so we can read PORT ────────────────────────────────────────────
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// server.js hardcodes 5010; keep this in sync if the server port ever changes
const PORT = 5010;
const SERVER_SCRIPT = path.join(__dirname, "server.js");
const TEST_SCRIPT = path.join(__dirname, "test.js");
const READY_TIMEOUT_MS = 30_000; // 30 s max to wait for server to be ready
const POLL_INTERVAL_MS = 300;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPortListening(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock
      .once("connect", () => { sock.destroy(); resolve(true); })
      .once("error", () => { sock.destroy(); resolve(false); })
      .once("timeout", () => { sock.destroy(); resolve(false); })
      .connect(port, "127.0.0.1");
  });
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = async () => {
      if (await isPortListening(port)) return resolve();
      if (Date.now() > deadline)
        return reject(new Error(`Server did not become ready within ${timeoutMs / 1000}s`));
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  let serverProc = null;
  let exitCode = 1;

  try {
    // 1 — Start server --------------------------------------------------------
    console.log(`\n▶  Starting server  (port ${PORT}) …`);
    serverProc = spawn(process.execPath, [SERVER_SCRIPT], {
      stdio: "inherit",
      env: { ...process.env },
    });

    serverProc.on("error", (err) => {
      console.error("Server process error:", err.message);
    });

    // 2 — Wait until ready ----------------------------------------------------
    await waitForServer(PORT, READY_TIMEOUT_MS);
    console.log(`✔  Server ready on port ${PORT}\n`);

    // 3 — Run tests -----------------------------------------------------------
    exitCode = await new Promise((resolve) => {
      const testProc = spawn(process.execPath, [TEST_SCRIPT], {
        stdio: "inherit",
        env: { ...process.env },
      });
      testProc.on("close", resolve);
      testProc.on("error", (err) => {
        console.error("Test process error:", err.message);
        resolve(1);
      });
    });
  } catch (err) {
    console.error("\n✘  Runner error:", err.message);
    exitCode = 1;
  } finally {
    // 4 — Always stop server --------------------------------------------------
    if (serverProc && !serverProc.killed) {
      console.log("\n■  Stopping server …");
      serverProc.kill("SIGTERM");
      // Give it a moment; force-kill if needed
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (!serverProc.killed) serverProc.kill("SIGKILL");
      console.log("✔  Server stopped");
    }
  }

  process.exit(exitCode);
})();
