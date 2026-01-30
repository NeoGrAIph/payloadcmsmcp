import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadLandingSchemas, validateLandingBlock, listLandingSchemas } from "./landing-schemas";
import { getPayloadcmsToolsDocumentation } from "./tools-documentation";
import { getLandingCollections, getLandingToolNames } from "./landing-tool-names";
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

type LandingToolSummary = { name: string; desc: string };

function getLandingToolsSummary(prefix?: string): LandingToolSummary[] {
  const overview = getPayloadcmsToolsDocumentation({
    topic: "overview",
    depth: "essentials",
    format: "json",
  }) as any;
  const tools = Array.isArray(overview?.tools) ? overview.tools : [];
  return tools
    .filter((tool: any) => tool?.category === "landing")
    .filter((tool: any) => (prefix ? String(tool?.name || "").startsWith(prefix) : true))
    .map((tool: any) => ({
      name: tool?.name || "",
      desc: tool?.summary || tool?.description || "",
    }))
    .filter((item: LandingToolSummary) => item.name);
}

function getLandingToolDetails(toolName: string) {
  const doc = getPayloadcmsToolsDocumentation({
    topic: toolName,
    depth: "full",
    format: "json",
  }) as any;
  if (!doc || doc.error || doc.category !== "landing") {
    return null;
  }
  const params: Record<string, string> = {};
  if (Array.isArray(doc.parameters)) {
    doc.parameters.forEach((param: any) => {
      if (!param?.name) return;
      const parts: string[] = [];
      if (param.type) parts.push(param.type);
      if (param.required) parts.push("required");
      if (param.default !== undefined) parts.push(`default: ${param.default}`);
      params[param.name] = parts.join(", ");
    });
  }
  return {
    name: doc.name,
    summary: doc.summary,
    description: doc.description,
    params,
    example: doc.examples?.[0]?.input,
    readOnly: doc.readOnly,
    destructive: doc.destructive,
    returns: doc.returns,
  };
}

export async function registerLandingTools(server: McpServer) {
  const landingCollections = getLandingCollections();

  for (const collection of landingCollections) {
    const names = getLandingToolNames(collection);
    const schemaDir = collection.schemaDir || `schema/${collection.slug}`;
    const validators = await loadLandingSchemas(schemaDir).catch(() => ({}));
    const prefix = `payload_${collection.toolSegment}_`;

    server.tool(
      names.generate,
      "Сгенерировать JSON блока лейаута по JSON Schema",
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
      names.validate,
      "Проверить JSON документа (layout[] или один блок) по JSON Schema",
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
        const blocks = Array.isArray(obj?.layout) ? obj.layout : [obj];
        for (const b of blocks) {
          const result = validateLandingBlock(validators, b);
          if (!result.valid) errors.push(...(result.errors || []));
        }

        if (errors.length) {
          return {
            content: [{ type: "text", text: JSON.stringify({ valid: false, errors }, null, 2) }],
          };
        }
        return { content: [{ type: "text", text: JSON.stringify({ valid: true }, null, 2) }] };
      }
    );

    server.tool(
      names.schemaList,
      "Список доступных схем блоков",
      {},
      async () => {
        const list = listLandingSchemas(validators);
        return { content: [{ type: "text", text: JSON.stringify({ blocks: list }, null, 2) }] };
      }
    );

    server.tool(
      names.schemaGet,
      "Получить JSON Schema для блока",
      { blockType: z.string() },
      async ({ blockType }) => {
        const resolvedDir = path.isAbsolute(schemaDir)
          ? schemaDir
          : path.join(process.cwd(), schemaDir);
        const file = path.join(resolvedDir, `${blockType}.schema.json`);
        try {
          const data = await fs.readFile(file, "utf8");
          return { content: [{ type: "text", text: data }] };
        } catch {
          return { content: [{ type: "text", text: `Schema not found for blockType=${blockType}` }] };
        }
      }
    );

    server.tool(
      names.documentation,
      "Документация по landing‑инструментам",
      {
        mode: z.enum(["summary", "tool"]).optional(),
        toolName: z.string().optional(),
      },
      async ({ mode = "summary", toolName }) => {
        const summary = getLandingToolsSummary(prefix);
        if (mode === "summary") {
          return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
        }
        if (toolName) {
          const details = getLandingToolDetails(toolName);
          return { content: [{ type: "text", text: JSON.stringify(details || {}, null, 2) }] };
        }
        return { content: [{ type: "text", text: "Unknown mode" }] };
      }
    );
  }
}
