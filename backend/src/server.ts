import { createApp } from "./app.js";
import { readServerConfig } from "./config.js";
import { assertApprovedBackendRuntimeEnvironment } from "./runtime-env.js";
import { SafeRequestMetrics } from "./platform/observability.js";

assertApprovedBackendRuntimeEnvironment();

const { host, port } = readServerConfig();
// P3.11: local-only metrics collector; no public or provider exporter until approval.
const metrics = new SafeRequestMetrics();
const server = createApp({ metrics }).listen(port, host, () => {
  console.info("Synthetic-only API listening on http://" + host + ":" + port);
});

function stop(signal: string) {
  console.info(signal + " received; stopping API");
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
