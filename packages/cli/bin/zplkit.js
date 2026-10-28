#!/usr/bin/env node
import { main } from "../build/cli.js";

// Output piped into something that stops reading, like head, is fine
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

process.exitCode = await main(process.argv.slice(2));
