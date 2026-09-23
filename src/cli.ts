#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { welcome } from "./welcome.js";

// Read at runtime rather than imported: `package.json` sits outside `rootDir`.
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

console.log(welcome(version));
