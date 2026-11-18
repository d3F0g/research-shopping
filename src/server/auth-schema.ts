import { Pool } from "pg";
import { createAuth } from "./auth";

if (!process.env.FIELDNOTE_SCHEMA_DATABASE_URL)
  throw new Error("Set the schema generation database URL explicitly");
export const auth = createAuth(
  new Pool({ connectionString: process.env.FIELDNOTE_SCHEMA_DATABASE_URL }),
  "http://127.0.0.1:5173",
  "fixture-schema-generation-secret-32-characters-only",
);
