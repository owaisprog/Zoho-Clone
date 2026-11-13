export interface ServerConfig {
  host: string;
  port: number;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawPort = env.PORT ?? "4000";
  // Strict parsing avoids accepting partial strings such as "4000abc".
  if (!/^[0-9]+$/.test(rawPort)) {
    throw new Error("PORT must be a whole number between 1 and 65535");
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a whole number between 1 and 65535");
  }

  const host = env.HOST ?? "127.0.0.1";
  // P3.01 is deliberately local-only by default. Review network exposure before changing.
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("P3.01 binds to localhost only; external hosting is not approved");
  }

  return { port, host };
}
