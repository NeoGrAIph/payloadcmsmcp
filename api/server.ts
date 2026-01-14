import { z } from "zod";
import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { 
  validatePayloadCode, 
  queryValidationRules, 
  executeSqlQuery, 
  FileType,
  generateTemplate,
  TemplateType,
  scaffoldProject,
  validateScaffoldOptions,
  ScaffoldOptions
} from "../lib/payload";
import { registerLandingTools } from "../lib/payload/landing-tools";
import { registerApiTools } from "../lib/payload/api-tools";
import { getPayloadcmsToolsDocumentation, getPayloadcmsToolAnnotations } from "../lib/payload/tools-documentation";
import { ensureRedisConnection } from '../lib/redis-connection';

const EMPTY_OBJECT_JSON_SCHEMA = { type: "object", properties: {} } as const;

function registerToolsListOverride(server: McpServer) {
  // Override tools/list to include annotations for safety-aware clients.
  server.server.setRequestHandler(ListToolsRequestSchema, () => {
    const registry = (server as any)._registeredTools || {};
    const tools = Object.entries(registry).map(([name, tool]) => {
      const inputSchema = tool.inputSchema
        ? zodToJsonSchema(tool.inputSchema, { strictUnions: true })
        : EMPTY_OBJECT_JSON_SCHEMA;
      return {
        name,
        description: tool.description,
        inputSchema,
        annotations: getPayloadcmsToolAnnotations(name),
      };
    });
    return { tools };
  });
}

const handler = initializeMcpApiHandler(
  (server) => {
    // Echo tool for testing
    server.tool("echo", "Echo a message", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));

    // Validate Payload CMS code
    server.tool(
      "validate",
      "Validate Payload CMS code",
      {
        code: z.string(),
        fileType: z.enum(["collection", "field", "global", "config"]),
      },
      async ({ code, fileType }) => {
        const result = validatePayloadCode(code, fileType as FileType);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    // Query validation rules
    server.tool(
      "query",
      "Query validation rules for Payload CMS",
      {
        query: z.string(),
        fileType: z.enum(["collection", "field", "global", "config"]).optional(),
      },
      async ({ query, fileType }) => {
        const rules = queryValidationRules(query, fileType as FileType | undefined);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ rules }, null, 2),
            },
          ],
        };
      }
    );

    // Execute SQL-like query
    server.tool(
      "mcp_query",
      "Execute SQL-like query against validation rules",
      {
        sql: z.string(),
      },
      async ({ sql }) => {
        try {
          const results = executeSqlQuery(sql);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ results }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: (error as Error).message }, null, 2),
              },
            ],
          };
        }
      }
    );

    // Generate Payload CMS 3 code templates
    server.tool(
      "generate_template",
      "Generate Payload CMS 3 code templates",
      {
        templateType: z.enum([
          "collection", 
          "field", 
          "global", 
          "config", 
          "access-control",
          "hook",
          "endpoint",
          "plugin",
          "block",
          "migration"
        ]),
        options: z.record(z.any()),
      },
      async ({ templateType, options }) => {
        try {
          const code = generateTemplate(templateType as TemplateType, options);
          return {
            content: [
              {
                type: "text",
                text: code,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: (error as Error).message }, null, 2),
              },
            ],
          };
        }
      }
    );

    // Generate a complete Payload CMS 3 collection
    server.tool(
      "generate_collection",
      "Generate a complete Payload CMS 3 collection",
      {
        slug: z.string(),
        fields: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            required: z.boolean().optional(),
            unique: z.boolean().optional(),
          })
        ).optional(),
        auth: z.boolean().optional(),
        timestamps: z.boolean().optional(),
        admin: z.object({
          useAsTitle: z.string().optional(),
          defaultColumns: z.array(z.string()).optional(),
          group: z.string().optional(),
        }).optional(),
        hooks: z.boolean().optional(),
        access: z.boolean().optional(),
        versions: z.boolean().optional(),
      },
      async (options) => {
        try {
          const code = generateTemplate('collection', options);
          return {
            content: [
              {
                type: "text",
                text: code,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: (error as Error).message }, null, 2),
              },
            ],
          };
        }
      }
    );

    // Generate a Payload CMS 3 field
    server.tool(
      "generate_field",
      "Generate a Payload CMS 3 field",
      {
        name: z.string(),
        type: z.string(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        localized: z.boolean().optional(),
        access: z.boolean().optional(),
        admin: z.object({
          description: z.string().optional(),
          readOnly: z.boolean().optional(),
        }).optional(),
        validation: z.boolean().optional(),
        defaultValue: z.any().optional(),
      },
      async (options) => {
        try {
          const code = generateTemplate('field', options);
          return {
            content: [
              {
                type: "text",
                text: code,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: (error as Error).message }, null, 2),
              },
            ],
          };
        }
      }
    );

    // Scaffold a complete Payload CMS 3 project
    server.tool(
      "scaffold_project",
      "Scaffold a complete Payload CMS 3 project structure",
      {
        projectName: z.string(),
        description: z.string().optional(),
        serverUrl: z.string().optional(),
        database: z.enum(['mongodb', 'postgres']).optional(),
        auth: z.boolean().optional(),
        admin: z.object({
          user: z.string().optional(),
          bundler: z.enum(['webpack', 'vite']).optional(),
        }).optional(),
        collections: z.array(
          z.object({
            name: z.string(),
            fields: z.array(
              z.object({
                name: z.string(),
                type: z.string(),
                required: z.boolean().optional(),
                unique: z.boolean().optional(),
              })
            ).optional(),
            auth: z.boolean().optional(),
            timestamps: z.boolean().optional(),
            admin: z.object({
              useAsTitle: z.string().optional(),
              group: z.string().optional(),
            }).optional(),
            versions: z.boolean().optional(),
          })
        ).optional(),
        globals: z.array(
          z.object({
            name: z.string(),
            fields: z.array(
              z.object({
                name: z.string(),
                type: z.string(),
              })
            ).optional(),
            versions: z.boolean().optional(),
          })
        ).optional(),
        blocks: z.array(
          z.object({
            name: z.string(),
            fields: z.array(
              z.object({
                name: z.string(),
                type: z.string(),
              })
            ).optional(),
            imageField: z.boolean().optional(),
            contentField: z.boolean().optional(),
          })
        ).optional(),
        plugins: z.array(z.string()).optional(),
        typescript: z.boolean().optional(),
      },
      async (options) => {
        try {
          // Validate options
          const validation = validateScaffoldOptions(options);
          if (!validation.isValid) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ 
                    error: "Invalid scaffold options", 
                    details: validation.errors 
                  }, null, 2),
                },
              ],
            };
          }
          
          // Generate project scaffold
          const fileStructure = scaffoldProject(options as ScaffoldOptions);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ 
                  message: `Successfully scaffolded Payload CMS 3 project: ${options.projectName}`,
                  fileStructure
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: (error as Error).message }, null, 2),
              },
            ],
          };
        }
      }
    );

    // Documentation for payloadcmsmcp tools
    server.tool(
      "payloadcms_tools_documentation",
      "Documentation for payloadcmsmcp tools (overview or per-tool)",
      {
        topic: z.string().optional(),
        depth: z.enum(["essentials", "full"]).optional(),
        format: z.enum(["json", "markdown"]).optional(),
      },
      async ({ topic, depth, format }) => {
        const doc = getPayloadcmsToolsDocumentation({ topic, depth, format });
        return {
          content: [
            {
              type: "text",
              text: typeof doc === "string" ? doc : JSON.stringify(doc, null, 2),
            },
          ],
        };
      }
    );

    // Payload API bridge tools
    registerApiTools(server).catch((err) => {
      console.error("Failed to register payload API tools", err);
    });

    // Landing GitOps tools (schemas/generation/validation)
    registerLandingTools(server).catch((err) => {
      console.error("Failed to register landing tools", err);
    });

    // Ensure tools/list exposes readOnly/destructive hints for clients.
    registerToolsListOverride(server);
  },
  {
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
  }
);

// Ensure Redis connection is established before handling requests
ensureRedisConnection().catch(error => {
  console.error("Failed to ensure Redis connection in server.ts:", error);
});

export default handler;
