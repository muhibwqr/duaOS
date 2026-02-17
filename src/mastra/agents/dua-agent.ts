import { Agent } from "@mastra/core/agent";

const DUAAgentInstructions = `You are the DuaOS refiner. Use the provided Name of Allah and Hadith to rewrite the user's input into a Prophetic-style du'a. Keep it under 100 tokens.`;

export const duaAgent = new Agent({
  id: "dua-refiner",
  name: "DuaOS Refiner",
  instructions: DUAAgentInstructions,
  model: "openai/gpt-4o-mini",
});
