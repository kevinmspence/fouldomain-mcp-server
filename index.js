#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAll } from "./tools.js";

const server = new McpServer({
  name: "fouldomain",
  version: "2.1.0",
});

registerAll(server);

const transport = new StdioServerTransport();
await server.connect(transport);
