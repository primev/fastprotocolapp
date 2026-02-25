#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SLACK_TOKEN = process.env.CLAWS_SLACK_TOKEN;
const CHANNEL_ID = process.env.CLAWS_CHANNEL_ID || "C0AH1KMU42H";
const AGENT_NAME = process.env.CLAWS_AGENT_NAME || "anonymous-agent";

if (!SLACK_TOKEN) {
  console.error("CLAWS_SLACK_TOKEN is required");
  process.exit(1);
}

async function slackApi(method, body) {
  const resp = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Slack API ${method}: ${data.error}`);
  return data;
}

const server = new McpServer({
  name: "claws",
  version: "1.0.0",
});

// Tool: Send a message to #claws
server.tool(
  "claws_send",
  "Post a message to the #claws Slack channel. Use this to communicate with other agents and humans on the Primev team.",
  {
    message: z.string().describe("The message to post to #claws"),
  },
  async ({ message }) => {
    const text = `*[${AGENT_NAME}]* ${message}`;
    await slackApi("chat.postMessage", { channel: CHANNEL_ID, text });
    return { content: [{ type: "text", text: `Posted to #claws: ${message}` }] };
  }
);

// Tool: Read recent messages from #claws
server.tool(
  "claws_read",
  "Read recent messages from the #claws Slack channel. Use this to see what other agents and humans have been saying.",
  {
    count: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of recent messages to fetch (default 10, max 50)"),
  },
  async ({ count }) => {
    const data = await slackApi("conversations.history", {
      channel: CHANNEL_ID,
      limit: count,
    });

    // Resolve user IDs to names
    const userIds = [
      ...new Set(
        data.messages
          .filter((m) => m.user)
          .map((m) => m.user)
      ),
    ];

    const userNames = {};
    for (const uid of userIds) {
      try {
        const u = await slackApi("users.info", { user: uid });
        userNames[uid] =
          u.user.profile.display_name || u.user.real_name || u.user.name;
      } catch {
        userNames[uid] = uid;
      }
    }

    const messages = data.messages
      .reverse()
      .map((m) => {
        const who = m.bot_id ? "bot" : userNames[m.user] || m.user || "unknown";
        const time = new Date(parseFloat(m.ts) * 1000).toISOString().slice(11, 19);
        return `[${time}] ${who}: ${m.text}`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: messages || "(no messages yet)",
        },
      ],
    };
  }
);

// Tool: Reply to a specific message thread
server.tool(
  "claws_reply",
  "Reply to a specific message thread in #claws.",
  {
    thread_ts: z.string().describe("The timestamp of the parent message to reply to"),
    message: z.string().describe("The reply message"),
  },
  async ({ thread_ts, message }) => {
    const text = `*[${AGENT_NAME}]* ${message}`;
    await slackApi("chat.postMessage", {
      channel: CHANNEL_ID,
      text,
      thread_ts,
    });
    return { content: [{ type: "text", text: `Replied in thread: ${message}` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
