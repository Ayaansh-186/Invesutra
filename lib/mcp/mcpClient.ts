// Copyright © 2026 Ayaansh Singhal. All Rights Reserved.
//
// Thin MCP client wrapper. Talks to the mutual fund MCP server defined in
// mutualFundMcpServer.ts over a real MCP transport:
//
//  - Default: an in-memory transport, connecting to the server that runs
//    in the same Node process (no separate deployment needed to get
//    started).
//  - If MUTUAL_FUND_MCP_SERVER_URL is set, connects to a remote,
//    independently-hosted MCP server instead (Streamable HTTP transport) —
//    e.g. if you later deploy lib/mcp/mutualFundMcpServer.ts as its own
//    standalone MCP server/process.
//
// Either way, callers (lib/marketData/providers.ts, lib/ai/tools.ts) only
// ever see `callMutualFundTool(name, args)` — they don't know or care
// which transport is behind it.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMutualFundMcpServer } from "./mutualFundMcpServer";

let clientPromise: Promise<Client> | null = null;

async function createClient(): Promise<Client> {
  const client = new Client({ name: "invesutra-app", version: "1.0.0" });
  const remoteUrl = process.env.MUTUAL_FUND_MCP_SERVER_URL;

  if (remoteUrl) {
    const transport = new StreamableHTTPClientTransport(new URL(remoteUrl));
    await client.connect(transport);
    return client;
  }

  const server = createMutualFundMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient().catch((error) => {
      // Allow retry on next call instead of caching a permanently broken client.
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export interface McpToolTextResult {
  raw: string;
  json: unknown;
}

/**
 * Calls a tool on the mutual fund MCP server and parses its text content
 * as JSON (all tools in mutualFundMcpServer.ts return JSON text content).
 */
export async function callMutualFundTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<McpToolTextResult> {
  const client = await getClient();
  const result = await client.callTool({ name: toolName, arguments: args });

  if (result.isError) {
    const message =
      Array.isArray(result.content) && result.content[0] && "text" in result.content[0]
        ? (result.content[0] as { text: string }).text
        : "MCP tool call failed";
    throw new Error(message);
  }

  const content = Array.isArray(result.content) ? result.content : [];
  const textBlock = content.find((block): block is { type: "text"; text: string } => block.type === "text");

  if (!textBlock) {
    throw new Error(`MCP tool "${toolName}" returned no text content`);
  }

  try {
    return { raw: textBlock.text, json: JSON.parse(textBlock.text) };
  } catch {
    return { raw: textBlock.text, json: null };
  }
}
