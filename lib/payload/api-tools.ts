import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_BODY_BYTES = 1_500_000; // ~1.5 MB

function buildAuthHeaders() {
  const headers: Record<string, string> = {};
  if (process.env.PAYLOAD_API_SECRET) {
    headers.Authorization = `Bearer ${process.env.PAYLOAD_API_SECRET}`;
  } else if (process.env.PAYLOAD_API_USER && process.env.PAYLOAD_API_PASS) {
    const token = Buffer.from(
      `${process.env.PAYLOAD_API_USER}:${process.env.PAYLOAD_API_PASS}`
    ).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

function ensureUrl(path: string): URL {
  const base = process.env.PAYLOAD_API_URL;
  if (!base) throw new Error("PAYLOAD_API_URL is not set");
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
}) {
  const url = ensureUrl(opts.path);
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
    "Perform raw HTTP request to Payload API (base URL is PAYLOAD_API_URL)",
    {
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string().describe("Path beginning with /, e.g. /api/globals"),
      body: z.any().optional(),
      headers: z.record(z.string()).optional(),
    },
    async ({ method, path, body, headers }) => {
      const res = await doFetch({ method, path, body, headers });
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
    },
    async ({ collection, where, limit, page, locale }) => {
      const query: any = {};
      if (where) query.where = where;
      if (limit) query.limit = limit;
      if (page) query.page = page;
      if (locale) query.locale = locale;
      const search = Object.keys(query).length
        ? `?${new URLSearchParams({ query: JSON.stringify(query) }).toString()}`
        : "";
      return await server.callTool("payload_api_request", {
        method: "GET",
        path: `/api/${collection}${search}`,
      });
    }
  );

  server.tool(
    "payload_create",
    "Create a document",
    {
      collection: z.string(),
      data: z.record(z.any()),
      locale: z.string().optional(),
    },
    async ({ collection, data, locale }) => {
      const path = `/api/${collection}${locale ? `?locale=${locale}` : ""}`;
      return await server.callTool("payload_api_request", {
        method: "POST",
        path,
        body: data,
      });
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
    },
    async ({ collection, id, data, locale }) => {
      const path = `/api/${collection}/${id}${locale ? `?locale=${locale}` : ""}`;
      return await server.callTool("payload_api_request", {
        method: "PATCH",
        path,
        body: data,
      });
    }
  );

  server.tool(
    "payload_delete",
    "Delete a document by ID",
    {
      collection: z.string(),
      id: z.string(),
    },
    async ({ collection, id }) => {
      const path = `/api/${collection}/${id}`;
      return await server.callTool("payload_api_request", {
        method: "DELETE",
        path,
      });
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
    },
    async ({ filename, mime, base64, relationTo }) => {
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > MAX_BODY_BYTES) {
        throw new Error("Upload too large (>1.5MB)");
      }
      const url = ensureUrl(`/api/${relationTo}`);
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
