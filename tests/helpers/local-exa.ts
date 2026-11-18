import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { createExaProductResearch } from "../../src/server/exa-research";
import type { ShoppingIntent } from "../../src/domain/contracts";
import { syntheticIntent } from "../fixtures/dynamic-research";

export async function localProvider(
  handler: (incoming: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    server,
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
export async function research(
  payload: unknown,
  preferences: ShoppingIntent = syntheticIntent(),
) {
  const server = await localProvider((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  try {
    return await createExaProductResearch("fake-test-key", {
      baseUrl: server.baseUrl,
    })({ preferences }, new AbortController().signal);
  } finally {
    await server.close();
  }
}
