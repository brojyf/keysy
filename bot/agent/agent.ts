import { createDeepSeek } from "@ai-sdk/deepseek";
import { defineAgent } from "eve";

const deepseek = createDeepSeek();

export default defineAgent({
  model: deepseek("deepseek-flash"),
  reasoning: "high",
  defaultTools: false,
  // @platformatic/kafka loads mnemonist with a runtime require(), which the file tracer misses, so ship both unbundled.
  build: { externalDependencies: ["@platformatic/kafka", "mnemonist"] },
});
