/**
 * Jest setupFilesAfterEnv — runs in the same process as tests.
 *
 * Starts the server ONCE before all suites and stops it ONCE after
 * all suites, so individual globalSetup/globalTeardown calls don't
 * pay the reconnect + re-seed cost 9 times.
 */
const { startServer, stopServer } = require("../server");

beforeAll(async () => {
  await startServer();
}, 60000);

afterAll(async () => {
  await stopServer();
}, 30000);
