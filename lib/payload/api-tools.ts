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

function resolveTarget(site?: string, env?: string): { env: "dev" | "prod" } {
  const siteVal = (site || DEV_SITE).toLowerCase();
  const envVal = (env || "dev").toLowerCase();
  if (siteVal === PROD_SITE && envVal === "prod") {
    return { env: "prod" };
  }
  return { env: "dev" };
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
    return { status: res.status, ok: res.ok, data: parsed };
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
    "payload_find",
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
      if (target.env === "prod" && !isProdAllowed("payload_find")) {
        throw new Error("prod access denied: payload_find");
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
    "payload_create",
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
      if (target.env === "prod" && !isProdAllowed("payload_create")) {
        throw new Error("prod access denied: payload_create");
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
    "payload_update",
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
      if (target.env === "prod" && !isProdAllowed("payload_update")) {
        throw new Error("prod access denied: payload_update");
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
    "payload_delete",
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
      if (target.env === "prod" && !isProdAllowed("payload_delete")) {
        throw new Error("prod access denied: payload_delete");
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
    "payload_upload",
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
      if (target.env === "prod" && !isProdAllowed("payload_upload")) {
        throw new Error("prod access denied: payload_upload");
      }
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > MAX_BODY_BYTES) {
        throw new Error("Upload too large (>1.5MB)");
      }
      const selected = resolveTarget(site, env);
      const url = ensureUrl(`/api/${relationTo}`, selected.env);
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
        return { content: [{ type: "text", text: JSON.stringify({ status: res.status, ok: res.ok, data }, null, 2) }] };
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
}
