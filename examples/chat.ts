// Sends one message to an agent and streams its reply.
//
//   ZEROCLAW_URL=… ZEROCLAW_TOKEN=… node examples/chat.ts helper "Hello"

import { Client, FrameType, TurnError } from "zeroclaw-api-client";

const [agent, message] = process.argv.slice(2);
if (!agent || !message) throw new Error("usage: chat.ts <agent> <message>");

const client = new Client(process.env.ZEROCLAW_URL ?? "http://127.0.0.1:42617", {
  token: process.env.ZEROCLAW_TOKEN,
});

const chat = await client.chat(agent);
try {
  chat.send(message);
  for await (const frame of chat) {
    if (frame.type === FrameType.Chunk) process.stdout.write(frame.content);
    else if (frame.type === FrameType.ToolCall) console.log(`\n[tool ${frame.name}]`);
    else if (frame.type === FrameType.ApprovalRequest) {
      console.log(`\n[denying ${frame.tool}: ${frame.argumentsSummary}]`);
      chat.answerApproval(frame.requestId, "deny");
    } else if (frame.type === FrameType.Done) {
      console.log(`\n[${frame.done?.tokens_used ?? "?"} tokens]`);
      break;
    } else if (frame.type === FrameType.Error) throw new TurnError(frame.code, frame.message);
  }
} finally {
  chat.close();
}
