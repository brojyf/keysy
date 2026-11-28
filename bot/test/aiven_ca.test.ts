import { expect, test } from "bun:test";
import { aivenCa } from "../agent/lib/aiven_ca";

test("matches deploy/aiven-ca.pem", async () => {
  expect(aivenCa).toBe(await Bun.file(new URL("../../deploy/aiven-ca.pem", import.meta.url)).text());
});
