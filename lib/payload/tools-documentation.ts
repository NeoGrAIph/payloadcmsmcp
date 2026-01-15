type ToolParam = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  default?: string;
};

type ToolDoc = {
  name: string;
  summary: string;
  description: string;
  category: string;
  readOnly: boolean;
  destructive: boolean;
  parameters: ToolParam[];
  returns: string;
  examples: Array<{ title: string; input: Record<string, any> }>;
  bestPractices: string[];
  pitfalls: string[];
};

type DocumentationRequest = {
  topic?: string;
  depth?: "essentials" | "full";
  format?: "json" | "markdown";
};

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

const SITE_BOUND_TOOLS = new Set([
  "payload_api_request",
  "payload_api_find",
  "payload_api_create",
  "payload_api_update",
  "payload_api_delete",
  "payload_api_upload",
  "payload_landing_list",
  "payload_landing_get",
  "payload_landing_hero_get",
  "payload_landing_blocks_list",
  "payload_landing_block_get",
  "payload_landing_create",
  "payload_landing_update",
  "payload_landing_block_add",
  "payload_landing_block_update",
  "payload_landing_block_remove",
  "payload_landing_block_move",
  "payload_landing_set_status",
]);

const MCP_META_NOTE = "Response always includes `_mcp` with resolved { env, site }.";

function getReturnsWithMeta(doc: ToolDoc) {
  if (!SITE_BOUND_TOOLS.has(doc.name)) return doc.returns;
  if (doc.returns.includes("_mcp")) return doc.returns;
  return `${doc.returns} ${MCP_META_NOTE}`;
}

const TOOL_DOCS: Record<string, ToolDoc> = {
  payload_echo: {
    name: "payload_echo",
    summary: "Echo a message for connectivity checks.",
    description: "Returns the provided message. Useful for verifying MCP connectivity and latency.",
    category: "core",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "message", type: "string", required: true, description: "Message to echo." },
    ],
    returns: "Text response with the message.",
    examples: [{ title: "Connectivity test", input: { message: "ping" } }],
    bestPractices: ["Use for smoke checks before API calls."],
    pitfalls: ["None; this tool is side-effect free."],
  },
  payload_validation_validate: {
    name: "payload_validation_validate",
    summary: "Validate Payload CMS code snippets.",
    description:
      "Validates a code snippet against Payload CMS rules for collections/fields/globals/config. Uses an internal rule set.",
    category: "validation",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "code", type: "string", required: true, description: "Source code to validate." },
      {
        name: "fileType",
        type: "enum(collection|field|global|config)",
        required: true,
        description: "Type of Payload file to validate.",
      },
    ],
    returns: "JSON with validation result, errors, and warnings.",
    examples: [{ title: "Validate collection", input: { code: "export default {}", fileType: "collection" } }],
    bestPractices: ["Validate snippets before merging into codebase."],
    pitfalls: ["Validation relies on internal rules; not a full compiler.", "Avoid untrusted input."],
  },
  payload_validation_query: {
    name: "payload_validation_query",
    summary: "Query validation rules for Payload CMS.",
    description: "Searches internal validation rules by query string and optional file type.",
    category: "validation",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "query", type: "string", required: true, description: "Search query." },
      {
        name: "fileType",
        type: "enum(collection|field|global|config)",
        description: "Optional filter by file type.",
      },
    ],
    returns: "JSON array of matching rules.",
    examples: [{ title: "Find hooks rule", input: { query: "hooks", fileType: "collection" } }],
    bestPractices: ["Use to quickly answer schema questions."],
    pitfalls: ["Rule base is limited; empty results are possible."],
  },
  payload_validation_mcp_query: {
    name: "payload_validation_mcp_query",
    summary: "Run SQL-like queries against validation rules.",
    description: "Executes a restricted SQL-like query against internal validation rules.",
    category: "validation",
    readOnly: true,
    destructive: false,
    parameters: [{ name: "sql", type: "string", required: true, description: "SQL-like query." }],
    returns: "JSON results of the query.",
    examples: [{ title: "List rules", input: { sql: "select * from validation_rules" } }],
    bestPractices: ["Use for advanced filtering of rules."],
    pitfalls: ["Only validation_rules table is supported."],
  },
  payload_template_generate: {
    name: "payload_template_generate",
    summary: "Generate Payload CMS 3 templates.",
    description: "Generates code templates for Payload CMS 3 (collection/field/global/config/etc.).",
    category: "generation",
    readOnly: true,
    destructive: false,
    parameters: [
      {
        name: "templateType",
        type:
          "enum(collection|field|global|config|access-control|hook|endpoint|plugin|block|migration)",
        required: true,
        description: "Template type to generate.",
      },
      { name: "options", type: "object", required: true, description: "Template options." },
    ],
    returns: "Generated code as text.",
    examples: [
      { title: "Generate collection template", input: { templateType: "collection", options: { slug: "posts" } } },
    ],
    bestPractices: ["Review and adapt generated code before use.", "Keep templates in repo for review."],
    pitfalls: ["Generated code may need manual edits for project conventions."],
  },
  payload_collection_generate: {
    name: "payload_collection_generate",
    summary: "Generate a complete collection template.",
    description: "Convenience wrapper for a full collection template using a structured schema.",
    category: "generation",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "slug", type: "string", required: true, description: "Collection slug." },
      { name: "fields", type: "array", description: "Array of fields with name/type/required." },
      { name: "auth", type: "boolean", description: "Enable auth collection." },
      { name: "timestamps", type: "boolean", description: "Include timestamps." },
      { name: "admin", type: "object", description: "Admin settings (useAsTitle, defaultColumns, group)." },
      { name: "hooks", type: "boolean", description: "Include hooks skeleton." },
      { name: "access", type: "boolean", description: "Include access control skeleton." },
      { name: "versions", type: "boolean", description: "Include versions config." },
    ],
    returns: "Generated collection code as text.",
    examples: [{ title: "Generate posts collection", input: { slug: "posts", fields: [{ name: "title", type: "text" }] } }],
    bestPractices: ["Validate generated code in your codebase."],
    pitfalls: ["Does not write files; output is a template string."],
  },
  payload_field_generate: {
    name: "payload_field_generate",
    summary: "Generate a field template.",
    description: "Generates a Payload field template using provided options.",
    category: "generation",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "name", type: "string", required: true, description: "Field name." },
      { name: "type", type: "string", required: true, description: "Field type (e.g., text, number)." },
      { name: "required", type: "boolean", description: "Mark field required." },
      { name: "unique", type: "boolean", description: "Mark field unique." },
      { name: "localized", type: "boolean", description: "Enable localization." },
      { name: "access", type: "boolean", description: "Include access control skeleton." },
      { name: "admin", type: "object", description: "Admin settings (description, readOnly)." },
      { name: "validation", type: "boolean", description: "Include validation skeleton." },
      { name: "defaultValue", type: "any", description: "Default value." },
    ],
    returns: "Generated field code as text.",
    examples: [{ title: "Generate title field", input: { name: "title", type: "text", required: true } }],
    bestPractices: ["Prefer explicit validation rules in your project."],
    pitfalls: ["Generated code may not match project conventions."],
  },
  payload_scaffold_project_generate: {
    name: "payload_scaffold_project_generate",
    summary: "Scaffold a Payload CMS 3 project structure.",
    description:
      "Generates a JSON representation of a full project scaffold. Does not write files to disk.",
    category: "generation",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "projectName", type: "string", required: true, description: "Project name." },
      { name: "description", type: "string", description: "Project description." },
      { name: "serverUrl", type: "string", description: "Server URL." },
      { name: "database", type: "enum(mongodb|postgres)", description: "Database type." },
      { name: "auth", type: "boolean", description: "Enable auth." },
      { name: "admin", type: "object", description: "Admin options (user, bundler)." },
      { name: "collections", type: "array", description: "Collections definitions." },
      { name: "globals", type: "array", description: "Globals definitions." },
      { name: "blocks", type: "array", description: "Blocks definitions." },
      { name: "plugins", type: "array", description: "Plugins list." },
      { name: "typescript", type: "boolean", description: "Enable TypeScript." },
    ],
    returns: "JSON structure of generated files.",
    examples: [{ title: "Scaffold blog", input: { projectName: "blog", database: "postgres" } }],
    bestPractices: ["Use as a starting point; review output before use."],
    pitfalls: ["Returns JSON description, not files."],
  },
  payload_api_request: {
    name: "payload_api_request",
    summary: "Raw HTTP call to Payload API (method-dependent).",
    description:
      "Performs an HTTP request to Payload API. Supports prod/dev routing via site+env and allowlist gating.",
    category: "payload_api",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "method", type: "enum(GET|POST|PUT|PATCH|DELETE)", required: true, description: "HTTP method." },
      { name: "path", type: "string", required: true, description: "Path starting with /, e.g. /api/landing" },
      { name: "body", type: "any", description: "Request body (JSON)." },
      { name: "headers", type: "object", description: "Extra headers (merged with auth)." },
      {
        name: "site",
        type: "enum(dev.synestra.io|synestra.io)",
        description: "Site selector; prod requires synestra.io.",
      },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector; prod requires env=prod." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [
      { title: "List landing docs (dev)", input: { method: "GET", path: "/api/landing" } },
      {
        title: "List landing docs (prod)",
        input: { method: "GET", path: "/api/landing", site: "synestra.io", env: "prod" },
      },
    ],
    bestPractices: [
      "Prefer payload_api_find/create/update/delete for common CRUD.",
      "Use prod only with explicit site+env parameters.",
      "Treat non-GET methods as destructive; prefer GET for read-only checks.",
      "Limit payload_api_request_* in prod via allowlist unless in controlled dev mode.",
    ],
    pitfalls: [
      "POST/PUT/PATCH/DELETE can modify data; use with caution.",
      "Prod requires BOTH site=synestra.io and env=prod.",
      "Allowlist may block prod calls unless PAYLOAD_PROD_ACCESS_MODE=unrestricted.",
    ],
  },
  payload_api_find: {
    name: "payload_api_find",
    summary: "Find documents in a collection.",
    description: "Convenience read-only query against a collection with optional where/limit/page/locale.",
    category: "payload_api",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "collection", type: "string", required: true, description: "Collection slug." },
      { name: "where", type: "object", description: "Payload where filter object." },
      { name: "limit", type: "number", description: "Max results (1-100)." },
      { name: "page", type: "number", description: "Pagination page." },
      { name: "locale", type: "string", description: "Locale (e.g., ru)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Find published landing", input: { collection: "landing", limit: 1 } }],
    bestPractices: ["Use for read-only access; keep limit small."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_api_create: {
    name: "payload_api_create",
    summary: "Create a document.",
    description: "Creates a document in a collection with optional locale.",
    category: "payload_api",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "collection", type: "string", required: true, description: "Collection slug." },
      { name: "data", type: "object", required: true, description: "Document payload." },
      { name: "locale", type: "string", description: "Locale (e.g., ru)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Create landing", input: { collection: "landing", data: { slug: "demo" } } }],
    bestPractices: ["Use in dev by default; be explicit when targeting prod."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_api_update: {
    name: "payload_api_update",
    summary: "Update a document by ID.",
    description: "Updates a document by ID with partial data.",
    category: "payload_api",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "collection", type: "string", required: true, description: "Collection slug." },
      { name: "id", type: "string", required: true, description: "Document ID." },
      { name: "data", type: "object", required: true, description: "Partial update payload." },
      { name: "locale", type: "string", description: "Locale (e.g., ru)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Update landing title", input: { collection: "landing", id: "123", data: { heroH1: "New" } } }],
    bestPractices: ["Patch only changed fields; keep payloads small."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_api_delete: {
    name: "payload_api_delete",
    summary: "Delete a document by ID.",
    description: "Deletes a document by ID from a collection.",
    category: "payload_api",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "collection", type: "string", required: true, description: "Collection slug." },
      { name: "id", type: "string", required: true, description: "Document ID." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Delete landing", input: { collection: "landing", id: "123" } }],
    bestPractices: ["Confirm ID before delete; prefer soft-delete if available."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_api_upload: {
    name: "payload_api_upload",
    summary: "Upload a small file via multipart.",
    description: "Uploads a base64-encoded file to a collection (default media).",
    category: "payload_api",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "filename", type: "string", required: true, description: "File name." },
      { name: "mime", type: "string", required: true, description: "MIME type." },
      { name: "base64", type: "string", required: true, description: "Base64-encoded file contents." },
      { name: "relationTo", type: "string", description: "Collection for upload (default media).", default: "media" },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Upload image", input: { filename: "hero.png", mime: "image/png", base64: "..." } }],
    bestPractices: ["Keep files small (<=1.5MB).", "Prefer CDN or direct upload for large files."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_api_docs: {
    name: "payload_api_docs",
    summary: "Cheat-sheet for common Payload API endpoints.",
    description: "Returns a quick reference for common Payload API endpoints and tips.",
    category: "payload_api",
    readOnly: true,
    destructive: false,
    parameters: [],
    returns: "JSON with endpoints and tips.",
    examples: [{ title: "Get cheat-sheet", input: {} }],
    bestPractices: ["Use for quick lookup of endpoints and patterns."],
    pitfalls: ["May not include project-specific endpoints."],
  },
  payload_landing_list: {
    name: "payload_landing_list",
    summary: "List landing documents with optional filters.",
    description:
      "Lists landing documents from the landing collection with optional filters for status, locale, pagination, and where clauses.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "where", type: "object", description: "Payload where filter object." },
      { name: "limit", type: "number", description: "Max results (1-100)." },
      { name: "page", type: "number", description: "Pagination page." },
      { name: "sort", type: "string", description: "Sort string (e.g. -updatedAt)." },
      { name: "status", type: "enum(draft|published)", description: "Status filter." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Include drafts (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "List published landings", input: { status: "published", limit: 5 } }],
    bestPractices: ["Use small limits.", "Use status filter for published-only lists."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_get: {
    name: "payload_landing_get",
    summary: "Get a landing by id or slug.",
    description: "Fetches a landing document by id or slug (landing collection).",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Include drafts (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "Landing document JSON.",
    examples: [{ title: "Get landing by slug", input: { slug: "main" } }],
    bestPractices: ["Use slug for editor-friendly fetches."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_hero_get: {
    name: "payload_landing_hero_get",
    summary: "Get hero fields and optional hero block.",
    description:
      "Returns top-level hero fields (heroH1, heroTitle, etc.) and optionally the first hero-like block.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Include drafts (Payload versions)." },
      { name: "blockType", type: "string", description: "Optional hero blockType to match." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with hero fields and optional hero block.",
    examples: [{ title: "Get hero by slug", input: { slug: "main" } }],
    bestPractices: ["Use with block list to pinpoint hero blocks."],
    pitfalls: ["Hero block detection is heuristic unless blockType is provided."],
  },
  payload_landing_blocks_list: {
    name: "payload_landing_blocks_list",
    summary: "List landing blocks with indexes and summaries.",
    description: "Returns an indexed list of blocks for fast targeting by editors.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Include drafts (Payload versions)." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON list of blocks with index, blockType, and summary.",
    examples: [{ title: "List blocks", input: { slug: "main" } }],
    bestPractices: ["Use before block updates to pick the correct index."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_block_get: {
    name: "payload_landing_block_get",
    summary: "Get a landing block by index or blockId.",
    description: "Fetches a single block from sections for precise edits.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "index", type: "number", description: "Block index in sections." },
      { name: "blockId", type: "string", description: "Block id (if present)." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Include drafts (Payload versions)." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON block payload with index.",
    examples: [{ title: "Get block by index", input: { slug: "main", index: 0 } }],
    bestPractices: ["Use blockId when available for stability."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_create: {
    name: "payload_landing_create",
    summary: "Create a landing document.",
    description: "Creates a new landing document in the landing collection.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "data", type: "object", required: true, description: "Landing document payload." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Create as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Create landing", input: { data: { slug: "demo", title: "Demo" } } }],
    bestPractices: ["Create in dev by default; validate sections before publish."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_update: {
    name: "payload_landing_update",
    summary: "Update landing top-level fields.",
    description: "Updates top-level fields on a landing document.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "data", type: "object", required: true, description: "Partial update payload." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Write as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Update hero title", input: { slug: "main", data: { heroH1: "New title" } } }],
    bestPractices: ["Use for small top-level edits; use block tools for sections."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_block_add: {
    name: "payload_landing_block_add",
    summary: "Add a block to landing sections.",
    description: "Appends or inserts a block into sections.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "block", type: "object", required: true, description: "Block payload (must include blockType)." },
      { name: "position", type: "number", description: "Insert position (default end)." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Write as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Add CTA block", input: { slug: "main", block: { blockType: "callToAction", heading: "Let's go" } } }],
    bestPractices: ["Validate block schema before insert."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_block_update: {
    name: "payload_landing_block_update",
    summary: "Update a landing block by index or blockId.",
    description: "Updates a block in sections with merge or replace mode.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "index", type: "number", description: "Block index in sections." },
      { name: "blockId", type: "string", description: "Block id (if present)." },
      { name: "patch", type: "object", required: true, description: "Fields to merge or full block for replace." },
      { name: "mode", type: "enum(merge|replace)", description: "Update mode (default merge)." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Write as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Update hero heading", input: { slug: "main", index: 0, patch: { heading: "New" } } }],
    bestPractices: ["Use merge mode for small edits; replace only when needed."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_block_remove: {
    name: "payload_landing_block_remove",
    summary: "Remove a landing block by index or blockId.",
    description: "Deletes a block from sections by index or id.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "index", type: "number", description: "Block index in sections." },
      { name: "blockId", type: "string", description: "Block id (if present)." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Write as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Remove block by index", input: { slug: "main", index: 3 } }],
    bestPractices: ["Confirm block index with blocks_list first."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_block_move: {
    name: "payload_landing_block_move",
    summary: "Move a landing block within sections.",
    description: "Reorders blocks by moving from index to index.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "from", type: "number", required: true, description: "From index." },
      { name: "to", type: "number", required: true, description: "To index." },
      { name: "sectionsField", type: "string", description: "Sections field name (default sections)." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "draft", type: "boolean", description: "Write as draft (Payload versions)." },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Move block", input: { slug: "main", from: 5, to: 1 } }],
    bestPractices: ["Use blocks_list to confirm indexes before move."],
    pitfalls: ["Prod gated by site+env and allowlist in restricted mode."],
  },
  payload_landing_set_status: {
    name: "payload_landing_set_status",
    summary: "Set landing status (draft/published).",
    description: "Toggles draft/published status via Payload draft workflow.",
    category: "landing",
    readOnly: false,
    destructive: true,
    parameters: [
      { name: "id", type: "string", description: "Landing id." },
      { name: "slug", type: "string", description: "Landing slug." },
      { name: "status", type: "enum(draft|published)", required: true, description: "Target status." },
      { name: "locale", type: "enum(ru|en)", description: "Locale (default ru).", default: "ru" },
      { name: "headers", type: "object", description: "Extra headers." },
      { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Site selector." },
      { name: "env", type: "enum(dev|prod)", description: "Environment selector." },
    ],
    returns: "JSON with status, ok, and data.",
    examples: [{ title: "Publish landing", input: { slug: "main", status: "published" } }],
    bestPractices: ["Use after validating sections."],
    pitfalls: ["Requires Payload draft/publish workflow; may fail if disabled."],
  },
  payload_landing_generate: {
    name: "payload_landing_generate",
    summary: "Generate landing block JSON for GitOps schema.",
    description: "Generates a JSON payload for a landing block that matches schemas.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "blockType", type: "string", required: true, description: "Block type (slug)." },
      { name: "preset", type: "enum(minimal|full)", description: "Sample size." },
      { name: "locale", type: "enum(en|ru)", description: "Sample locale." },
    ],
    returns: "JSON block payload.",
    examples: [{ title: "Generate content block", input: { blockType: "content", preset: "full" } }],
    bestPractices: ["Use preset=minimal for skeletons, full for samples."],
    pitfalls: ["Only supports known block types."],
  },
  payload_landing_validate: {
    name: "payload_landing_validate",
    summary: "Validate landing JSON against schemas.",
    description: "Validates a landing document or block JSON against schemas.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "document", type: "string", required: true, description: "JSON string for a block or document." },
      { name: "mode", type: "enum(strict|loose)", description: "Loose mode skips non-JSON." },
    ],
    returns: "JSON validation result.",
    examples: [{ title: "Validate document", input: { document: "{\"sections\":[{\"blockType\":\"content\"}]}" } }],
    bestPractices: ["Validate after editing content blocks."],
    pitfalls: ["Strict mode rejects non-JSON input."],
  },
  payload_landing_schema_list: {
    name: "payload_landing_schema_list",
    summary: "List available landing schemas.",
    description: "Returns the list of available landing block schemas.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [],
    returns: "JSON list of block types.",
    examples: [{ title: "List schemas", input: {} }],
    bestPractices: ["Use to discover supported blocks."],
    pitfalls: ["List depends on bundled schemas."],
  },
  payload_landing_schema_get: {
    name: "payload_landing_schema_get",
    summary: "Get JSON schema for a landing block.",
    description: "Returns the JSON schema for a specific landing block type.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [{ name: "blockType", type: "string", required: true, description: "Block type (slug)." }],
    returns: "JSON schema text.",
    examples: [{ title: "Get content schema", input: { blockType: "content" } }],
    bestPractices: ["Use for validation or tooling generation."],
    pitfalls: ["Unknown blockType returns error message."],
  },
  payload_landing_documentation: {
    name: "payload_landing_documentation",
    summary: "Help for landing tools.",
    description: "Returns summary or per-tool details for landing tools.",
    category: "landing",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "mode", type: "enum(summary|tool)", description: "Summary or specific tool help." },
      { name: "toolName", type: "string", description: "Tool name for detailed help." },
    ],
    returns: "JSON documentation.",
    examples: [{ title: "Get landing docs summary", input: { mode: "summary" } }],
    bestPractices: ["Prefer payload_tools_documentation for full server docs."],
    pitfalls: ["Limited to landing tools only."],
  },
  payload_tools_documentation: {
    name: "payload_tools_documentation",
    summary: "Full documentation for payloadcmsmcp tools.",
    description:
      "Returns overview and per-tool documentation in markdown or JSON. Similar to n8n_tools_documentation.",
    category: "core",
    readOnly: true,
    destructive: false,
    parameters: [
      { name: "topic", type: "string", description: "Tool name or 'overview' (default)." },
      { name: "depth", type: "enum(essentials|full)", description: "Detail level (default essentials)." },
      { name: "format", type: "enum(json|markdown)", description: "Output format (default markdown)." },
    ],
    returns: "Documentation text.",
    examples: [
      { title: "Overview", input: { topic: "overview", depth: "essentials" } },
      { title: "Full doc for payload_api_find", input: { topic: "payload_api_find", depth: "full" } },
    ],
    bestPractices: ["Use overview to discover tools, then query per-tool docs."],
    pitfalls: ["Unknown topic returns list of valid tool names."],
  },
};

const TOOL_ORDER = Object.keys(TOOL_DOCS);

function renderOverviewMarkdown(depth: "essentials" | "full") {
  const lines: string[] = [];
  lines.push("# payloadcmsmcp Tools Documentation");
  lines.push("");
  lines.push("## Overview");
  lines.push(
    "This MCP server provides Payload CMS tooling, landing schema helpers, and Payload API bridge tools. Use `payload_tools_documentation` to discover tools and get per-tool details."
  );
  lines.push("");
  lines.push("## Tool Index");
  TOOL_ORDER.forEach((name) => {
    const doc = TOOL_DOCS[name];
    lines.push(`- **${doc.name}** (${doc.category}) — ${doc.summary}`);
    if (depth === "full") {
      lines.push(`  - readOnly: ${doc.readOnly}, destructive: ${doc.destructive}`);
    }
  });
  lines.push("");
  lines.push("## Best Practices");
  lines.push("- Use dev by default; prod requires explicit `site` + `env`.");
  lines.push("- Site-bound tools include `_mcp` in responses with resolved env/site.");
  lines.push("- Prefer specific tools (payload_api_find/update/...) over payload_api_request.");
  lines.push("- Keep payloads small (<1.5MB) and validate content before writes.");
  lines.push("- Treat destructive tools as high-risk, especially in prod.");
  lines.push("");
  lines.push("## Safety Notes");
  lines.push("- Prod access can be restricted by allowlist (PAYLOAD_PROD_ALLOWLIST) unless in unrestricted mode.");
  lines.push("- This server does not generate or persist secrets.");
  return lines.join("\n");
}

function renderToolMarkdown(doc: ToolDoc, depth: "essentials" | "full") {
  const lines: string[] = [];
  lines.push(`# ${doc.name}`);
  lines.push("");
  lines.push(doc.description);
  lines.push("");
  lines.push(`Category: **${doc.category}**  |  readOnly: **${doc.readOnly}**  |  destructive: **${doc.destructive}**`);
  lines.push("");
  lines.push("## Parameters");
  if (!doc.parameters.length) {
    lines.push("- (none)");
  } else {
    doc.parameters.forEach((p) => {
      const req = p.required ? "required" : "optional";
      const def = p.default ? `, default: ${p.default}` : "";
      lines.push(`- **${p.name}** (${p.type}, ${req}${def}) — ${p.description}`);
    });
  }
  lines.push("");
  lines.push("## Returns");
  lines.push(getReturnsWithMeta(doc));
  if (depth === "full") {
    lines.push("");
    lines.push("## Examples");
    doc.examples.forEach((ex) => {
      lines.push(`- ${ex.title}:`);
      lines.push("```json");
      lines.push(JSON.stringify(ex.input, null, 2));
      lines.push("```");
    });
    lines.push("");
    lines.push("## Best Practices");
    doc.bestPractices.forEach((bp) => lines.push(`- ${bp}`));
    lines.push("");
    lines.push("## Common Pitfalls");
    doc.pitfalls.forEach((p) => lines.push(`- ${p}`));
  }
  return lines.join("\n");
}

function renderToolJson(doc: ToolDoc, depth: "essentials" | "full") {
  if (depth === "essentials") {
    return {
      name: doc.name,
      summary: doc.summary,
      description: doc.description,
      category: doc.category,
      readOnly: doc.readOnly,
      destructive: doc.destructive,
      parameters: doc.parameters,
      returns: getReturnsWithMeta(doc),
    };
  }
  return doc;
}

export function getPayloadcmsToolsDocumentation(req: DocumentationRequest) {
  const topic = (req.topic || "overview").toLowerCase();
  const depth = req.depth || "essentials";
  const format = req.format || "markdown";

  if (topic === "overview" || topic === "index") {
    const markdown = renderOverviewMarkdown(depth);
    return format === "json"
      ? { overview: markdown, tools: TOOL_ORDER.map((t) => renderToolJson(TOOL_DOCS[t], depth)) }
      : markdown;
  }

  const doc = TOOL_DOCS[topic];
  if (!doc) {
    const message = {
      error: `Unknown tool: ${req.topic}`,
      tools: TOOL_ORDER,
    };
    return format === "json" ? message : JSON.stringify(message, null, 2);
  }

  if (format === "json") {
    return renderToolJson(doc, depth);
  }

  return renderToolMarkdown(doc, depth);
}

export function getPayloadcmsToolAnnotations(toolName: string): ToolAnnotations {
  const doc = TOOL_DOCS[toolName];
  if (!doc) {
    return {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    };
  }
  return {
    readOnlyHint: doc.readOnly,
    destructiveHint: doc.destructive,
    idempotentHint: doc.readOnly,
    openWorldHint: false,
  };
}
