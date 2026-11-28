import { expect, test } from "bun:test";
import agent from "../agent/agent";

// @platformatic/kafka loads mnemonist with a runtime require(), which the bundle and the file tracer miss.
test("ships @platformatic/kafka and mnemonist unbundled", () => {
  expect(agent.build?.externalDependencies).toEqual(["@platformatic/kafka", "mnemonist"]);
});
