import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadLandingSchemas, validateLandingBlock, listLandingSchemas } from "./landing-schemas";
import fs from "fs/promises";
import path from "path";

// Minimal sample payloads per blockType
const samples: Record<string, any> = {
  content: {
    blockType: "content",
    blockName: "Intro",
    richText: "## Welcome\nWe help you ship faster.",
    alignment: "left",
  },
  callToAction: {
    blockType: "callToAction",
    heading: "Ready to start?",
    description: "Talk to our team today.",
    links: [{ label: "Book a demo", url: "https://example.com/demo", appearance: "default" }],
  },
  mediaBlock: {
    blockType: "mediaBlock",
    mediaUrl: "https://cdn.example.com/hero.jpg",
    caption: "Product UI",
    alt: "Screenshot",
    alignment: "center",
  },
  formBlock: {
    blockType: "formBlock",
    heading: "Subscribe",
    formId: "newsletter",
    submitLabel: "Join",
  },
  code: {
    blockType: "code",
    language: "typescript",
    code: "console.log('Hello Payload');",
  },
  carousel: {
    blockType: "carousel",
    items: [
      { title: "Fast setup", description: "Deploy in minutes" },
      { title: "Secure", description: "Best practices by default" },
    ],
  },
  archive: { blockType: "archive", relationTo: "posts", limit: 6 },
  banner: { blockType: "banner", content: "🚀 New release is live!", style: "info" },
  threeItemGrid: {
    blockType: "threeItemGrid",
    items: [
      { title: "Item A", description: "Key feature A" },
      { title: "Item B", description: "Key feature B" },
      { title: "Item C", description: "Key feature C" },
    ],
  },
};

export async function registerLandingTools(server: McpServer) {
  const validators = await loadLandingSchemas().catch(() => ({}));

  server.tool(
    "landing_generate",
    "Generate a landing block JSON that matches Payload block schema",
    {
      blockType: z.string(),
      preset: z.enum(["minimal", "full"]).optional(),
      locale: z.enum(["en", "ru"]).optional(),
    },
    async ({ blockType, preset = "full" }) => {
      const sample = samples[blockType] ?? { blockType, blockName: blockType };
      const json = preset === "minimal" ? { blockType } : sample;
      return { content: [{ type: "text", text: JSON.stringify(json, null, 2) }] };
    }
  );

  server.tool(
    "landing_validate",
    "Validate landing document (JSON with sections[] or single block) against schemas",
    {
      document: z.string(),
      mode: z.enum(["strict", "loose"]).optional(),
    },
    async ({ document, mode = "strict" }) => {
      let obj: any;
      try {
        obj = JSON.parse(document);
      } catch {
        if (mode === "loose") {
          return { content: [{ type: "text", text: "Skipped: not JSON, treated as MDX" }] };
        }
        return { content: [{ type: "text", text: "Invalid JSON" }] };
      }

      const errors: string[] = [];
      const blocks = Array.isArray(obj?.sections) ? obj.sections : [obj];
      for (const b of blocks) {
        const result = validateLandingBlock(validators, b);
        if (!result.valid) errors.push(...(result.errors || []));
      }

      if (errors.length) {
        return { content: [{ type: "text", text: JSON.stringify({ valid: false, errors }, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ valid: true }, null, 2) }] };
    }
  );

  server.tool(
    "landing_schema_list",
    "List available landing block schemas",
    {},
    async () => {
      const list = listLandingSchemas(validators);
      return { content: [{ type: "text", text: JSON.stringify({ blocks: list }, null, 2) }] };
    }
  );

  server.tool(
    "landing_schema_get",
    "Get JSON Schema for a landing block",
    { blockType: z.string() },
    async ({ blockType }) => {
      const file = path.join(process.cwd(), "schema", "landing", `${blockType}.schema.json`);
      try {
        const data = await fs.readFile(file, "utf8");
        return { content: [{ type: "text", text: data }] };
      } catch {
        return { content: [{ type: "text", text: `Schema not found for blockType=${blockType}` }] };
      }
    }
  );

  server.tool(
    "landing_documentation",
    "Documentation for landing tools",
    {
      mode: z.enum(["summary", "tool"]).optional(),
      toolName: z.string().optional(),
    },
    async ({ mode = "summary", toolName }) => {
      const summary = [
        { name: "landing_generate", desc: "Generate JSON for a landing block (matches schema)" },
        { name: "landing_validate", desc: "Validate JSON (sections[] or single block) against schemas" },
        { name: "landing_schema_list", desc: "List available block schemas" },
        { name: "landing_schema_get", desc: "Get full JSON Schema by blockType" },
        { name: "landing_documentation", desc: "This help tool" },
      ];
      if (mode === "summary") {
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }
      if (toolName) {
        const details: Record<string, any> = {
          landing_generate: {
            description: "Generate a sample payload for a landing block. Use preset=minimal to get only blockType.",
            params: { blockType: "string", preset: "minimal|full", locale: "en|ru" },
            example: { blockType: "content", preset: "full" },
          },
          landing_validate: {
            description: "Validate a document JSON (single block or sections[]) against the schemas.",
            params: { document: "JSON string", mode: "strict|loose" },
            example: { document: "{\"sections\":[{\"blockType\":\"content\",\"richText\":\"Hi\"}]}" },
          },
          landing_schema_list: { description: "List blockType names that have schemas", params: {} },
          landing_schema_get: { description: "Return full JSON Schema for blockType", params: { blockType: "string" } },
          landing_documentation: { description: "Return help for landing tools", params: { mode: "summary|tool", toolName: "string" } },
        };
        return { content: [{ type: "text", text: JSON.stringify(details[toolName] || {}, null, 2) }] };
      }
      return { content: [{ type: "text", text: "Unknown mode" }] };
    }
  );
}
