import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { configFromEnvironment } from "./config";

const config = configFromEnvironment(process.env);
const app = createApp({ logger: (event) => process.stdout.write(`${JSON.stringify(event)}\n`) }, config);
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
process.stdout.write(`Research + Shopping fixture API listening on http://127.0.0.1:${config.apiPort}\n`);
