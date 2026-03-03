/**
 * Custom Jest reporter — replaces the default reporter entirely.
 *
 * Output:
 *   • One line per suite:  ✓ PASS  /  ✗ FAIL  + filename
 *   • Failure blocks for every failing test:
 *       MODULE   │ describe block
 *       API      │ test description
 *       EXPECTED │ expected value
 *       GOT      │ received value
 *   • Final totals banner (suites + tests)
 */

const RESET  = "\x1b[0m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

const W_LABEL = 10;

const pad  = (str, len) => String(str).padEnd(len);
const row  = (label, value, color) =>
  `  ${BOLD}${CYAN}${pad(label, W_LABEL)}${RESET}${DIM}│${RESET}  ${color}${value}${RESET}`;

function shortPath(fullPath) {
  return fullPath.replace(/\\/g, "/").replace(/^.*\/test\//, "test/");
}

function parseExpectedReceived(msg) {
  const clean = msg.replace(/\x1b\[[0-9;]*m/g, "");

  const expectedMatch = clean.match(/^\s*Expected(?:\s+\w+)?:\s*(.+)$/m);
  const receivedMatch = clean.match(/^\s*Received(?:\s+\w+)?:\s*(.+)$/m);

  let fallbackGot = "";
  if (!receivedMatch) {
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
    fallbackGot = lines.find((l) => !l.startsWith("expect(")) || lines[0] || "—";
  }

  return {
    expected: expectedMatch ? expectedMatch[1].trim() : "—",
    received: receivedMatch ? receivedMatch[1].trim() : fallbackGot || "—",
  };
}

class FailureReporter {
  constructor() {
    this._suiteLines = []; // collected suite lines, flushed in onRunComplete
    this._failureBlocks = [];
  }

  onRunStart() {}
  onTestStart() {}
  onTestResult() {}
  onTestCaseResult() {}
  getLastError() {}

  onTestFileResult(_test, fileResult) {
    const hasFailed = fileResult.testResults.some((t) => t.status === "failed");
    const suiteFailed =
      fileResult.failureMessage && !fileResult.testResults.length; // suite-level crash

    const fp = shortPath(fileResult.testFilePath);

    if (hasFailed || suiteFailed) {
      const line = `${BOLD}${RED}  ✗ FAIL${RESET}  ${DIM}${fp}${RESET}`;
      this._suiteLines.push(line);
      process.stdout.write(line + "\n");
    } else {
      const line = `${BOLD}${GREEN}  ✓ PASS${RESET}  ${DIM}${fp}${RESET}`;
      this._suiteLines.push(line);
      process.stdout.write(line + "\n");
    }

    // ── Build failure block ──────────────────────────────────────────────
    const failed = fileResult.testResults.filter((t) => t.status === "failed");

    if (suiteFailed) {
      const clean = (fileResult.failureMessage || "").replace(/\x1b\[[0-9;]*m/g, "");
      const firstLine = clean.split("\n").map((l) => l.trim()).find(Boolean) || "suite error";
      this._failureBlocks.push(
        `\n${BOLD}${RED}${"═".repeat(70)}${RESET}\n` +
        `${BOLD}${RED}  FAILURES  ${RESET}${DIM}${fp}${RESET}\n` +
        `${BOLD}${RED}${"═".repeat(70)}${RESET}\n` +
        `\n${BOLD}  SUITE ERROR${RESET}\n` +
        row("REASON", firstLine, RED) + "\n" +
        `  ${DIM}${"─".repeat(68)}${RESET}\n\n`
      );
      return;
    }

    if (!failed.length) return;

    let block =
      `\n${BOLD}${RED}${"═".repeat(70)}${RESET}\n` +
      `${BOLD}${RED}  FAILURES  ${RESET}${DIM}${fp}${RESET}\n` +
      `${BOLD}${RED}${"═".repeat(70)}${RESET}\n`;

    failed.forEach((t, idx) => {
      const module = t.ancestorTitles.length
        ? t.ancestorTitles.join(" › ")
        : "(root)";

      block += `\n${BOLD}  #${idx + 1}${RESET}\n`;
      block += row("MODULE",   module,  YELLOW) + "\n";
      block += row("API",      t.title, YELLOW) + "\n";

      const messages = t.failureMessages.length
        ? t.failureMessages
        : ["(no failure message)"];

      messages.forEach((msg, mIdx) => {
        if (messages.length > 1)
          block += `  ${DIM}  assertion ${mIdx + 1}${RESET}\n`;
        const { expected, received } = parseExpectedReceived(msg);
        block += row("EXPECTED", expected, GREEN) + "\n";
        block += row("GOT",      received, RED)   + "\n";
      });

      block += `  ${DIM}${"─".repeat(68)}${RESET}\n`;
    });

    block += "\n";
    this._failureBlocks.push(block);
  }

  onRunComplete(_contexts, results) {
    const {
      numFailedTestSuites, numPassedTestSuites,
      numFailedTests, numPassedTests,
      numPendingTests, numTotalTests,
      numTotalTestSuites,
    } = results;

    // ── Failure blocks ───────────────────────────────────────────────────
    this._failureBlocks.forEach((b) => process.stdout.write(b));

    // ── Totals ───────────────────────────────────────────────────────────
    const suitesPart =
      (numFailedTestSuites ? `${BOLD}${RED}  SUITES  ${numFailedTestSuites} failed${RESET}  ` : "") +
      `${BOLD}${GREEN}${numPassedTestSuites} passed${RESET}` +
      `${DIM}  /  ${numTotalTestSuites} total${RESET}`;

    const testsPart =
      (numFailedTests ? `${BOLD}${RED}  TESTS   ${numFailedTests} failed${RESET}  ` : `${BOLD}${GREEN}  TESTS   `) +
      `${numPassedTests} passed${RESET}` +
      (numPendingTests ? `  ${DIM}${numPendingTests} skipped${RESET}` : "") +
      `${DIM}  /  ${numTotalTests} total${RESET}`;

    process.stdout.write("\n" + suitesPart + "\n" + testsPart + "\n\n");
  }
}

module.exports = FailureReporter;
