import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_BODY_BYTES = 1_500_000; // ~1.5 MB

function buildAuthHeaders() {
  const headers: Record<string, string> = {};
  const scheme = (process.env.PAYLOAD_API_AUTH_SCHEME || "auto").toLowerCase();
  const headerName = process.env.PAYLOAD_API_AUTH_HEADER_NAME || "Authorization";

  if (scheme === "none") {
    return headers;
  }

  if (scheme === "users-api-key" || scheme === "api-key") {
    if (!process.env.PAYLOAD_API_SECRET) return headers;
    const prefix = process.env.PAYLOAD_API_KEY_PREFIX || "users API-Key";
    headers[headerName] = `${prefix} ${process.env.PAYLOAD_API_SECRET}`;
    return headers;
  }

  if (scheme === "basic") {
    if (!process.env.PAYLOAD_API_USER || !process.env.PAYLOAD_API_PASS) return headers;
    const token = Buffer.from(
      `${process.env.PAYLOAD_API_USER}:${process.env.PAYLOAD_API_PASS}`
    ).toString("base64");
    headers[headerName] = `Basic ${token}`;
    return headers;
  }

  if (scheme === "bearer") {
    if (!process.env.PAYLOAD_API_SECRET) return headers;
    headers[headerName] = `Bearer ${process.env.PAYLOAD_API_SECRET}`;
    return headers;
  }

  // auto (backward compatible): prefer Bearer secret, else Basic
  if (process.env.PAYLOAD_API_SECRET) {
    headers[headerName] = `Bearer ${process.env.PAYLOAD_API_SECRET}`;
  } else if (process.env.PAYLOAD_API_USER && process.env.PAYLOAD_API_PASS) {
    const token = Buffer.from(
      `${process.env.PAYLOAD_API_USER}:${process.env.PAYLOAD_API_PASS}`
    ).toString("base64");
    headers[headerName] = `Basic ${token}`;
  }
  return headers;
}

const DEV_SITE = "dev.synestra.io";
const PROD_SITE = "synestra.io";
const PROD_ACCESS_MODE = (process.env.PAYLOAD_PROD_ACCESS_MODE || "restricted").toLowerCase();
const LANDING_COLLECTION = "landing";
const DEFAULT_SECTIONS_FIELD = "sections";
const HERO_FIELD_CANDIDATES = [
  "heroH1",
  "heroTitle",
  "heroSubtitle",
  "heroDescription",
  "heroLead",
  "heroEyebrow",
  "heroCTA",
  "heroCta",
  "heroImage",
  "heroMedia",
  "heroVideo",
];
const SUMMARY_FIELD_CANDIDATES = [
  "heroH1",
  "heroTitle",
  "headline",
  "heading",
  "title",
  "blockName",
  "name",
  "label",
  "subtitle",
  "description",
  "text",
];

function parseAllowlist(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

const PROD_ALLOWLIST = parseAllowlist(process.env.PAYLOAD_PROD_ALLOWLIST);

function isProdAllowed(key: string): boolean {
  if (PROD_ACCESS_MODE === "unrestricted") return true;
  return PROD_ALLOWLIST.has(key.toLowerCase());
}

function ensureLandingIdentifier(id?: string, slug?: string) {
  if (!id && !slug) throw new Error("id or slug is required");
}

function appendWhereParams(params: URLSearchParams, value: any, path: string) {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendWhereParams(params, item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      appendWhereParams(params, nested, `${path}[${key}]`);
    }
    return;
  }
  params.set(path, String(value));
}

function buildQueryString(query?: Record<string, any>, draft?: boolean): string {
  const params = new URLSearchParams();
  if (query && Object.keys(query).length) {
    if (query.where !== undefined) {
      const whereValue = query.where;
      if (typeof whereValue === "string") {
        params.set("where", whereValue);
      } else {
        appendWhereParams(params, whereValue, "where");
      }
    }
    for (const [key, value] of Object.entries(query)) {
      if (key === "where") continue;
      if (value === undefined) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params.set(key, String(value));
        continue;
      }
      params.set(key, JSON.stringify(value));
    }
  }
  if (draft !== undefined) {
    params.set("draft", String(draft));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function buildLocaleDraftQuery(locale?: string, draft?: boolean): string {
  const params = new URLSearchParams();
  if (locale) params.set("locale", locale);
  if (draft !== undefined) params.set("draft", String(draft));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function fetchLandingDoc(opts: {
  id?: string;
  slug?: string;
  locale?: string;
  draft?: boolean;
  env?: string;
  site?: string;
  headers?: Record<string, string>;
}) {
  ensureLandingIdentifier(opts.id, opts.slug);
  if (opts.id) {
    const res = await doFetch({
      method: "GET",
      path: `/api/${LANDING_COLLECTION}/${opts.id}${buildLocaleDraftQuery(opts.locale, opts.draft)}`,
      headers: opts.headers,
      env: opts.env,
      site: opts.site,
    });
    if (!res.ok) throw new Error(`landing not found (status ${res.status})`);
    return res.data;
  }

  const where = { slug: { equals: opts.slug } } as any;
  const query: any = { where, limit: 1 };
  if (opts.locale) query.locale = opts.locale;
  const res = await doFetch({
    method: "GET",
    path: `/api/${LANDING_COLLECTION}${buildQueryString(query, opts.draft)}`,
    headers: opts.headers,
    env: opts.env,
    site: opts.site,
  });
  if (!res.ok) throw new Error(`landing query failed (status ${res.status})`);
  const doc = res.data?.docs?.[0];
  if (!doc) throw new Error("landing not found");
  return doc;
}

async function resolveLandingId(opts: {
  id?: string;
  slug?: string;
  locale?: string;
  draft?: boolean;
  env?: string;
  site?: string;
  headers?: Record<string, string>;
}) {
  if (opts.id) return opts.id;
  const doc = await fetchLandingDoc(opts);
  const resolved = doc?.id || doc?._id;
  if (!resolved) throw new Error("landing id not found in response");
  return resolved as string;
}

function ensureSections(doc: any, sectionsField?: string) {
  const field = sectionsField || DEFAULT_SECTIONS_FIELD;
  const sections = doc?.[field];
  if (!Array.isArray(sections)) {
    throw new Error(`sections field '${field}' is not an array`);
  }
  return { field, sections };
}

function summarizeBlock(block: any): string | undefined {
  for (const key of SUMMARY_FIELD_CANDIDATES) {
    const value = block?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.length > 140 ? `${value.slice(0, 137)}...` : value;
    }
  }
  return undefined;
}

function findHeroBlock(sections: any[], blockType?: string) {
  if (blockType) {
    const idx = sections.findIndex((b) => b?.blockType === blockType);
    return idx >= 0 ? { index: idx, block: sections[idx] } : undefined;
  }
  const idx = sections.findIndex((b) => {
    const type = typeof b?.blockType === "string" ? b.blockType.toLowerCase() : "";
    return type.includes("hero") || type === "banner" || type === "header";
  });
  return idx >= 0 ? { index: idx, block: sections[idx] } : undefined;
}

function resolveTarget(site?: string, env?: string): { env: "dev" | "prod" } {
  const siteVal = (site || DEV_SITE).toLowerCase();
  const envVal = (env || "dev").toLowerCase();
  if (siteVal === PROD_SITE && envVal === "prod") {
    return { env: "prod" };
  }
  return { env: "dev" };
}

function buildMcpMeta(targetEnv: "dev" | "prod") {
  return {
    env: targetEnv,
    site: targetEnv === "prod" ? PROD_SITE : DEV_SITE,
  };
}

function isPlainObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getItemId(value: any): string | undefined {
  if (!isPlainObject(value)) return undefined;
  return (value as any).id || (value as any)._id;
}

function mergeArrayById(targetArr: any[], patchArr: any[], pathLabel: string) {
  if (!patchArr.length) {
    throw new Error(
      `safe mode disallows empty array patch at ${pathLabel}; use mode=replace with allowUnsafe=true to overwrite arrays`
    );
  }
  const out = targetArr.slice();
  for (const patchItem of patchArr) {
    const id = getItemId(patchItem);
    if (!id) {
      throw new Error(
        `safe mode requires array items with id/_id at ${pathLabel}; use mode=merge with allowUnsafe=true to overwrite arrays`
      );
    }
    const idx = out.findIndex((item: any) => {
      const itemId = getItemId(item);
      return itemId && itemId === id;
    });
    if (idx >= 0) {
      out[idx] = deepMergeSafe(out[idx], patchItem, `${pathLabel}[${id}]`);
    } else {
      out.push(patchItem);
    }
  }
  return out;
}

function deepMergeSafe(target: any, patch: any, pathLabel = "block"): any {
  if (Array.isArray(patch)) {
    if (target === undefined || target === null) return patch;
    if (!Array.isArray(target)) {
      throw new Error(`safe mode expected array at ${pathLabel}; use mode=merge with allowUnsafe=true`);
    }
    return mergeArrayById(target, patch, pathLabel);
  }

  if (!isPlainObject(patch)) return patch;

  const base = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    const nextPath = pathLabel ? `${pathLabel}.${key}` : key;
    base[key] = deepMergeSafe((base as any)[key], value, nextPath);
  }
  return base;
}

function buildSafePatch(current: any, patch: any, pathLabel = "data"): any {
  if (Array.isArray(patch)) {
    if (current === undefined || current === null) {
      throw new Error(
        `safe mode requires existing array at ${pathLabel}; use mode=merge with allowUnsafe=true to overwrite arrays`
      );
    }
    if (!Array.isArray(current)) {
      throw new Error(`safe mode expected array at ${pathLabel}; use mode=merge with allowUnsafe=true`);
    }
    return mergeArrayById(current, patch, pathLabel);
  }

  if (!isPlainObject(patch)) return patch;

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(patch)) {
    const nextPath = pathLabel ? `${pathLabel}.${key}` : key;
    const currentValue = current && (isPlainObject(current) || Array.isArray(current)) ? current[key] : undefined;
    out[key] = buildSafePatch(currentValue, value, nextPath);
  }
  return out;
}

function getBaseUrl(env?: string): string {
  const selected = (env || "dev").toLowerCase();
  if (selected === "prod") {
    return process.env.PAYLOAD_API_URL_PROD || process.env.PAYLOAD_API_URL || "";
  }
  if (selected === "dev") {
    return process.env.PAYLOAD_API_URL_DEV || process.env.PAYLOAD_API_URL || "";
  }
  throw new Error("env must be 'dev' or 'prod'");
}

function ensureUrl(path: string, env?: string): URL {
  const base = getBaseUrl(env);
  if (!base) throw new Error("PAYLOAD_API_URL_DEV/PROD is not set");
  if (!path.startsWith("/")) throw new Error("path must start with '/'");
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (!url.href.startsWith(base)) {
    throw new Error("URL outside PAYLOAD_API_URL is not allowed");
  }
  return url;
}

async function doFetch(opts: {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  env?: string;
  site?: string;
}) {
  const target = resolveTarget(opts.site, opts.env);
  const url = ensureUrl(opts.path, target.env);
  const authHeaders = buildAuthHeaders();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders,
    ...(opts.headers || {}),
  };

  const body =
    opts.body === undefined || opts.body === null ? undefined : JSON.stringify(opts.body);

  if (body && Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Body too large (>1.5MB)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: res.status, ok: res.ok, data: parsed, _mcp: buildMcpMeta(target.env) };
  } catch (err) {
    const msg = (err as Error).message.replace(
      process.env.PAYLOAD_API_SECRET || "",
      "***"
    );
    throw new Error(msg);
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerApiTools(server: McpServer) {
  server.tool(
    "payload_api_request",
    "Perform raw HTTP request to Payload API (site+env; prod requires allowlist or unrestricted mode)",
    {
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string().describe("Path beginning with /, e.g. /api/globals"),
      body: z.any().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ method, path, body, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod") {
        const methodKey = `payload_api_request_${method.toLowerCase()}`;
        if (!isProdAllowed(methodKey) && !isProdAllowed("payload_api_request")) {
          throw new Error(`prod access denied: ${methodKey}`);
        }
      }
      const res = await doFetch({ method, path, body, headers, env, site });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "payload_api_find",
    "Find documents in a collection",
    {
      collection: z.string(),
      where: z.record(z.any()).optional(),
      limit: z.number().min(1).max(100).optional(),
      page: z.number().min(1).optional(),
      locale: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ collection, where, limit, page, locale, headers, env, site }) => {
      const query: any = {};
      if (where) query.where = where;
      if (limit) query.limit = limit;
      if (page) query.page = page;
      if (locale) query.locale = locale;
      const search = Object.keys(query).length
        ? `?${new URLSearchParams({ query: JSON.stringify(query) }).toString()}`
        : "";
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_api_find")) {
        throw new Error("prod access denied: payload_api_find");
      }
      const res = await doFetch({
        method: "GET",
        path: `/api/${collection}${search}`,
        headers,
        env,
        site,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "payload_api_create",
    "Create a document",
    {
      collection: z.string(),
      data: z.record(z.any()),
      locale: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ collection, data, locale, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_api_create")) {
        throw new Error("prod access denied: payload_api_create");
      }
      const path = `/api/${collection}${locale ? `?locale=${locale}` : ""}`;
      const res = await doFetch({
        method: "POST",
        path,
        body: data,
        headers,
        env,
        site,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "payload_api_update",
    "Update a document by ID",
    {
      collection: z.string(),
      id: z.string(),
      data: z.record(z.any()),
      locale: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ collection, id, data, locale, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_api_update")) {
        throw new Error("prod access denied: payload_api_update");
      }
      const path = `/api/${collection}/${id}${locale ? `?locale=${locale}` : ""}`;
      const res = await doFetch({
        method: "PATCH",
        path,
        body: data,
        headers,
        env,
        site,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "payload_api_delete",
    "Delete a document by ID",
    {
      collection: z.string(),
      id: z.string(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ collection, id, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_api_delete")) {
        throw new Error("prod access denied: payload_api_delete");
      }
      const path = `/api/${collection}/${id}`;
      const res = await doFetch({
        method: "DELETE",
        path,
        headers,
        env,
        site,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "payload_api_upload",
    "Upload a file (base64) to Payload",
    {
      filename: z.string(),
      mime: z.string(),
      base64: z.string(),
      relationTo: z.string().default("media"),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ filename, mime, base64, relationTo, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_api_upload")) {
        throw new Error("prod access denied: payload_api_upload");
      }
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > MAX_BODY_BYTES) {
        throw new Error("Upload too large (>1.5MB)");
      }
      const url = ensureUrl(`/api/${relationTo}`, target.env);
      const authHeaders = buildAuthHeaders();
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: mime }), filename);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: authHeaders,
          body: form as any,
          signal: controller.signal,
        });
        const text = await res.text();
        let data: any = text;
        try {
          data = JSON.parse(text);
        } catch {
          /* noop */
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { status: res.status, ok: res.ok, data, _mcp: buildMcpMeta(target.env) },
                null,
                2
              ),
            },
          ],
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  );

  server.tool(
    "payload_api_docs",
    "Cheat-sheet for common Payload API endpoints and usage",
    {},
    async () => {
      const cheat = {
        base: "PAYLOAD_API_URL",
        auth: "Bearer PAYLOAD_API_SECRET or Basic with PAYLOAD_API_USER/PASS",
        endpoints: {
          me: "GET /api/users/me",
          find: "GET /api/<collection>?where={...}",
          create: "POST /api/<collection>",
          update: "PATCH /api/<collection>/<id>",
          delete: "DELETE /api/<collection>/<id>",
          upload: "POST /api/media (multipart form-data)",
          globals: "GET /api/globals",
        },
        tips: [
          "Use locale param (?locale=ru) for localized content",
          "Prefer PATCH for partial updates",
          "Uploads require multipart; keep files small for this bridge",
        ],
      };
      return { content: [{ type: "text", text: JSON.stringify(cheat, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_list",
    "List landing documents with optional filters",
    {
      where: z.record(z.any()).optional(),
      limit: z.number().min(1).max(100).optional(),
      page: z.number().min(1).optional(),
      sort: z.string().optional(),
      status: z.enum(["draft", "published"]).optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ where, limit, page, sort, status, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_list")) {
        throw new Error("prod access denied: payload_landing_list");
      }
      let finalWhere = where || {};
      if (status) {
        const statusFilter = { _status: { equals: status } };
        if (Object.keys(finalWhere).length) {
          finalWhere = { and: [finalWhere, statusFilter] };
        } else {
          finalWhere = statusFilter;
        }
      }
      const query: any = {};
      if (Object.keys(finalWhere).length) query.where = finalWhere;
      if (limit) query.limit = limit;
      if (page) query.page = page;
      if (sort) query.sort = sort;
      if (locale) query.locale = locale;

      const res = await doFetch({
        method: "GET",
        path: `/api/${LANDING_COLLECTION}${buildQueryString(query, draft)}`,
        headers,
        env,
        site,
      });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_get",
    "Get a landing document by id or slug",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_get")) {
        throw new Error("prod access denied: payload_landing_get");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const payload = { ...(doc || {}), _mcp: buildMcpMeta(target.env) };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_hero_get",
    "Get hero-related fields and optional hero block",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      blockType: z.string().optional(),
      sectionsField: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, locale, draft, blockType, sectionsField, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_hero_get")) {
        throw new Error("prod access denied: payload_landing_hero_get");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const hero: Record<string, any> = {};
      for (const key of HERO_FIELD_CANDIDATES) {
        if (doc && doc[key] !== undefined) hero[key] = doc[key];
      }
      let heroBlock: any = undefined;
      try {
        const { sections } = ensureSections(doc, sectionsField);
        const found = findHeroBlock(sections, blockType);
        if (found) {
          heroBlock = { index: found.index, block: found.block };
        }
      } catch {
        /* ignore missing sections */
      }
      const payload = {
        id: doc?.id || doc?._id,
        slug: doc?.slug,
        hero,
        heroBlock,
        _mcp: buildMcpMeta(target.env),
      };
      return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_blocks_list",
    "List landing blocks with indexes and summaries",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      sectionsField: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, locale, draft, sectionsField, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_blocks_list")) {
        throw new Error("prod access denied: payload_landing_blocks_list");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const { field, sections } = ensureSections(doc, sectionsField);
      const blocks = sections.map((block: any, index: number) => ({
        index,
        id: block?.id || block?._id,
        blockType: block?.blockType,
        blockName: block?.blockName,
        summary: summarizeBlock(block),
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ field, blocks, _mcp: buildMcpMeta(target.env) }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "payload_landing_block_get",
    "Get a single landing block by index or blockId",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      index: z.number().int().min(0).optional(),
      blockId: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      sectionsField: z.string().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, index, blockId, locale, draft, sectionsField, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_block_get")) {
        throw new Error("prod access denied: payload_landing_block_get");
      }
      if (blockId === undefined && index === undefined) {
        throw new Error("blockId or index is required");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const { field, sections } = ensureSections(doc, sectionsField);
      let block: any = undefined;
      let resolvedIndex: number | undefined = undefined;
      if (blockId) {
        resolvedIndex = sections.findIndex((b: any) => b?.id === blockId || b?._id === blockId);
        if (resolvedIndex >= 0) block = sections[resolvedIndex];
      } else if (index !== undefined) {
        block = sections[index];
        resolvedIndex = index;
      }
      if (!block) throw new Error("block not found");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ field, index: resolvedIndex, block, _mcp: buildMcpMeta(target.env) }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "payload_landing_create",
    "Create a landing document",
    {
      data: z.record(z.any()),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ data, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_create")) {
        throw new Error("prod access denied: payload_landing_create");
      }
      const path = `/api/${LANDING_COLLECTION}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "POST", path, body: data, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_update",
    "Update a landing document (top-level fields)",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      data: z.record(z.any()),
      mode: z.enum(["safe", "merge"]).optional().default("safe"),
      allowUnsafe: z.boolean().optional().default(false),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, data, mode, allowUnsafe, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_update")) {
        throw new Error("prod access denied: payload_landing_update");
      }
      if (mode !== "safe" && !allowUnsafe) {
        throw new Error("unsafe mode requires allowUnsafe=true");
      }
      const resolvedId = await resolveLandingId({ id, slug, locale, draft, env, site, headers });
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const body =
        mode === "safe"
          ? buildSafePatch(
              await fetchLandingDoc({ id: resolvedId, locale, draft, env, site, headers }),
              data,
              "data"
            )
          : data;
      const res = await doFetch({ method: "PATCH", path, body, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_block_add",
    "Add a block to landing sections",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      block: z.record(z.any()),
      position: z.number().int().min(0).optional(),
      sectionsField: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, block, position, sectionsField, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_block_add")) {
        throw new Error("prod access denied: payload_landing_block_add");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const resolvedId = doc?.id || doc?._id;
      if (!resolvedId) throw new Error("landing id not found in response");
      const { field, sections } = ensureSections(doc, sectionsField);
      const copy = sections.slice();
      if (position === undefined || position >= copy.length) {
        copy.push(block);
      } else {
        copy.splice(position, 0, block);
      }
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "PATCH", path, body: { [field]: copy }, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_block_update",
    "Update a single block in landing sections",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      index: z.number().int().min(0).optional(),
      blockId: z.string().optional(),
      patch: z.record(z.any()),
      mode: z.enum(["safe", "merge", "replace"]).optional().default("safe"),
      allowUnsafe: z.boolean().optional().default(false),
      sectionsField: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, index, blockId, patch, mode, allowUnsafe, sectionsField, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_block_update")) {
        throw new Error("prod access denied: payload_landing_block_update");
      }
      if (blockId === undefined && index === undefined) {
        throw new Error("blockId or index is required");
      }
      if (mode !== "safe" && !allowUnsafe) {
        throw new Error("unsafe mode requires allowUnsafe=true");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const resolvedId = doc?.id || doc?._id;
      if (!resolvedId) throw new Error("landing id not found in response");
      const { field, sections } = ensureSections(doc, sectionsField);
      const copy = sections.slice();
      let resolvedIndex: number | undefined = undefined;
      if (blockId) {
        resolvedIndex = copy.findIndex((b: any) => b?.id === blockId || b?._id === blockId);
      } else if (index !== undefined) {
        resolvedIndex = index;
      }
      if (resolvedIndex === undefined || resolvedIndex < 0 || resolvedIndex >= copy.length) {
        throw new Error("block not found");
      }
      const current = copy[resolvedIndex];
      const next = mode === "replace"
        ? patch
        : mode === "merge"
          ? { ...current, ...patch }
          : deepMergeSafe(current, patch);
      copy[resolvedIndex] = next;
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "PATCH", path, body: { [field]: copy }, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_block_remove",
    "Remove a block from landing sections",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      index: z.number().int().min(0).optional(),
      blockId: z.string().optional(),
      sectionsField: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, index, blockId, sectionsField, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_block_remove")) {
        throw new Error("prod access denied: payload_landing_block_remove");
      }
      if (blockId === undefined && index === undefined) {
        throw new Error("blockId or index is required");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const resolvedId = doc?.id || doc?._id;
      if (!resolvedId) throw new Error("landing id not found in response");
      const { field, sections } = ensureSections(doc, sectionsField);
      const copy = sections.slice();
      let resolvedIndex: number | undefined = undefined;
      if (blockId) {
        resolvedIndex = copy.findIndex((b: any) => b?.id === blockId || b?._id === blockId);
      } else if (index !== undefined) {
        resolvedIndex = index;
      }
      if (resolvedIndex === undefined || resolvedIndex < 0 || resolvedIndex >= copy.length) {
        throw new Error("block not found");
      }
      copy.splice(resolvedIndex, 1);
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "PATCH", path, body: { [field]: copy }, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_block_move",
    "Move a block within landing sections",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      from: z.number().int().min(0),
      to: z.number().int().min(0),
      sectionsField: z.string().optional(),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      draft: z.boolean().optional(),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, from, to, sectionsField, locale, draft, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_block_move")) {
        throw new Error("prod access denied: payload_landing_block_move");
      }
      const doc = await fetchLandingDoc({ id, slug, locale, draft, env, site, headers });
      const resolvedId = doc?.id || doc?._id;
      if (!resolvedId) throw new Error("landing id not found in response");
      const { field, sections } = ensureSections(doc, sectionsField);
      const copy = sections.slice();
      if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) {
        throw new Error("from/to out of range");
      }
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "PATCH", path, body: { [field]: copy }, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );

  server.tool(
    "payload_landing_set_status",
    "Set landing status to draft or published",
    {
      id: z.string().optional(),
      slug: z.string().optional(),
      status: z.enum(["draft", "published"]),
      locale: z.enum(["ru", "en"]).optional().default("ru"),
      headers: z.record(z.string()).optional(),
      env: z.enum(["dev", "prod"]).optional(),
      site: z.enum([DEV_SITE, PROD_SITE]).optional(),
    },
    async ({ id, slug, status, locale, headers, env, site }) => {
      const target = resolveTarget(site, env);
      if (target.env === "prod" && !isProdAllowed("payload_landing_set_status")) {
        throw new Error("prod access denied: payload_landing_set_status");
      }
      const resolvedId = await resolveLandingId({ id, slug, locale, env, site, headers });
      const draft = status === "draft";
      const path = `/api/${LANDING_COLLECTION}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
      const res = await doFetch({ method: "PATCH", path, body: {}, headers, env, site });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );
}
