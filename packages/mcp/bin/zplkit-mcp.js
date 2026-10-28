#!/usr/bin/env node
// zplkit's MCP server on standard input and output, for AI assistants.
// --allow-print adds print_zpl, which sends labels to network printers.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../build/server.js";

const allowPrint = process.argv.includes("--allow-print");
await createServer({ allowPrint }).connect(new StdioServerTransport());
