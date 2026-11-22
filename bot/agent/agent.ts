import { createDeepSeek } from "@ai-sdk/deepseek";
import { defineAgent } from "eve";

const deepseek = createDeepSeek();

export default defineAgent({
  model: deepseek("deepseek-flash"),
  reasoning: "high",
});
