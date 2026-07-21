import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the server environment automatically.
export const anthropic = new Anthropic();
