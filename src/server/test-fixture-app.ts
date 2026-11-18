import { createApp, type AppDependencies } from "./app";
import { createFixtureProviders } from "./fixtures";
import type { ServerConfig } from "./config";

export function createFixtureApp(
  dependencies: AppDependencies = {},
  configuration: Partial<ServerConfig> = {},
) {
  return createApp(
    {
      ...dependencies,
      mode: "test-fixture",
      providers: dependencies.providers ?? createFixtureProviders(),
    },
    configuration,
  );
}
