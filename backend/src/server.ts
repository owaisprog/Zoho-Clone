import { createApp } from "./app.js";
import { readServerConfig } from "./config.js";

const { host, port } = readServerConfig();
const server = createApp().listen(port, host, () => {
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
