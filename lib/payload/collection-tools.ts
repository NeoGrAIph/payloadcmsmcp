import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveDraft } from "./draft-utils.mjs";
import {
  buildLocaleDraftQuery,
  buildMcpMeta,
  buildQueryString,
  doFetch,
  isProdAllowed,
  resolveTarget,
  DEV_SITE,
  PROD_SITE,
} from "./api-tools";
import { COLLECTIONS } from "./collection-tools.generated";

type CollectionDescriptor = typeof COLLECTIONS[number];

type CollectionToolNames = {
  list: string;
  get: string;
  create?: string;
  update: string;
  delete: string;
  setStatus?: string;
};

function toolName(segment: string, action: string): string {
  return `payload_${segment}_${action}`;
}

function getToolNames(collection: CollectionDescriptor): CollectionToolNames {
  const segment = collection.toolSegment;
  const base = {
    list: toolName(segment, "list"),
    get: toolName(segment, "get"),
    update: toolName(segment, "update"),
    delete: toolName(segment, "delete"),
  };
  const create = collection.hasUpload ? undefined : toolName(segment, "create");
  if (collection.hasDrafts) {
    return { ...base, create, setStatus: toolName(segment, "set_status") };
  }
  return { ...base, create };
}

export function getCollectionToolNames(): string[] {
  return COLLECTIONS.filter((c) => !c.skip)
    .flatMap((collection) => {
      const names = getToolNames(collection);
      return Object.values(names).filter(Boolean) as string[];
    })
    .sort();
}

function ensureIdentifier(id?: string, slug?: string) {
  if (!id && !slug) throw new Error("id or slug is required");
}

async function fetchByIdOrSlug(opts: {
  collection: string;
  id?: string;
  slug?: string;
  locale?: string;
  draft?: boolean;
  env?: string;
  site?: string;
  headers?: Record<string, string>;
}) {
  ensureIdentifier(opts.id, opts.slug);
  if (opts.id) {
    const res = await doFetch({
      method: "GET",
      path: `/api/${opts.collection}/${opts.id}${buildLocaleDraftQuery(opts.locale, opts.draft)}`,
      headers: opts.headers,
      env: opts.env,
      site: opts.site,
    });
    if (!res.ok) throw new Error(`document not found (status ${res.status})`);
    return res.data;
  }

  const where = { slug: { equals: opts.slug } } as any;
  const query: any = { where, limit: 1 };
  if (opts.locale) query.locale = opts.locale;
  const res = await doFetch({
    method: "GET",
    path: `/api/${opts.collection}${buildQueryString(query, opts.draft)}`,
    headers: opts.headers,
    env: opts.env,
    site: opts.site,
  });
  if (!res.ok) throw new Error(`collection query failed (status ${res.status})`);
  const doc = res.data?.docs?.[0];
  if (!doc) throw new Error("document not found");
  return doc;
}

async function resolveDocId(opts: {
  collection: string;
  id?: string;
  slug?: string;
  locale?: string;
  draft?: boolean;
  env?: string;
  site?: string;
  headers?: Record<string, string>;
}) {
  if (opts.id) return opts.id;
  const doc = await fetchByIdOrSlug(opts);
  const resolved = doc?.id || doc?._id;
  if (!resolved) throw new Error("document id not found in response");
  return resolved as string;
}

export async function registerCollectionTools(server: McpServer) {
  for (const collection of COLLECTIONS) {
    if (collection.skip) continue;
    const names = getToolNames(collection);

    const envSchema = z.enum(["dev", "prod"]).optional();
    const siteSchema = z.enum([DEV_SITE, PROD_SITE]).optional();
    const headersSchema = z.record(z.string()).optional();

    const localeSchema = z.enum(["ru", "en"]).optional().default("ru");
    const draftSchema = collection.hasDrafts ? z.boolean().optional() : undefined;
    const statusSchema = collection.hasDrafts ? z.enum(["draft", "published"]).optional() : undefined;

    server.tool(
      names.list,
      `List ${collection.slug} documents with optional filters`,
      {
        where: z.record(z.any()).optional(),
        limit: z.number().min(1).max(100).optional(),
        page: z.number().min(1).optional(),
        sort: z.string().optional(),
        ...(statusSchema ? { status: statusSchema } : {}),
        locale: localeSchema,
        ...(draftSchema ? { draft: draftSchema } : {}),
        headers: headersSchema,
        env: envSchema,
        site: siteSchema,
      },
      async ({ where, limit, page, sort, status, locale, draft, headers, env, site }) => {
        const target = resolveTarget(site, env);
        if (target.env === "prod" && !isProdAllowed(names.list)) {
          throw new Error(`prod access denied: ${names.list}`);
        }
        let finalWhere = where || {};
        let effectiveDraft = draft;
        if (collection.hasDrafts) {
          effectiveDraft = resolveDraft({ status, draft, where });
          if (status) {
            const statusFilter = { _status: { equals: status } };
            if (Object.keys(finalWhere).length) {
              finalWhere = { and: [finalWhere, statusFilter] };
            } else {
              finalWhere = statusFilter;
            }
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
          path: `/api/${collection.slug}${buildQueryString(query, effectiveDraft)}`,
          headers,
          env,
          site,
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }
    );

    server.tool(
      names.get,
      `Get a ${collection.slug} document by id or slug`,
      {
        id: collection.hasSlugField ? z.string().optional() : z.string(),
        ...(collection.hasSlugField ? { slug: z.string().optional() } : {}),
        ...(statusSchema ? { status: statusSchema } : {}),
        locale: localeSchema,
        ...(draftSchema ? { draft: draftSchema } : {}),
        headers: headersSchema,
        env: envSchema,
        site: siteSchema,
      },
      async ({ id, slug, status, locale, draft, headers, env, site }) => {
        const target = resolveTarget(site, env);
        if (target.env === "prod" && !isProdAllowed(names.get)) {
          throw new Error(`prod access denied: ${names.get}`);
        }
        const effectiveDraft = collection.hasDrafts ? resolveDraft({ status, draft }) : draft;
        const doc = await fetchByIdOrSlug({
          collection: collection.slug,
          id,
          slug: collection.hasSlugField ? slug : undefined,
          locale,
          draft: effectiveDraft,
          env,
          site,
          headers,
        });
        const payload = { ...(doc || {}), _mcp: buildMcpMeta(target.env) };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      }
    );

    if (names.create) {
      server.tool(
        names.create,
        `Create a ${collection.slug} document`,
      {
        data: z.record(z.any()),
        ...(statusSchema ? { status: statusSchema } : {}),
        locale: localeSchema,
        ...(draftSchema ? { draft: draftSchema } : {}),
        headers: headersSchema,
        env: envSchema,
        site: siteSchema,
      },
      async ({ data, status, locale, draft, headers, env, site }) => {
        const target = resolveTarget(site, env);
        if (target.env === "prod" && !isProdAllowed(names.create)) {
          throw new Error(`prod access denied: ${names.create}`);
        }
        let effectiveDraft = draft;
        if (collection.hasDrafts && status) {
          const statusDraft = status === "draft";
          if (draft !== undefined && draft !== statusDraft) {
            throw new Error("status conflicts with draft; provide only one");
          }
          effectiveDraft = statusDraft;
        }
        const path = `/api/${collection.slug}${buildLocaleDraftQuery(locale, effectiveDraft)}`;
        const res = await doFetch({
          method: "POST",
          path,
          body: data,
          headers,
            env,
            site,
          });
          return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
        }
      );
    }

    server.tool(
      names.update,
      `Update a ${collection.slug} document by id`,
      {
        id: z.string(),
        data: z.record(z.any()),
        locale: localeSchema,
        ...(draftSchema ? { draft: draftSchema } : {}),
        headers: headersSchema,
        env: envSchema,
        site: siteSchema,
      },
      async ({ id, data, locale, draft, headers, env, site }) => {
        const target = resolveTarget(site, env);
        if (target.env === "prod" && !isProdAllowed(names.update)) {
          throw new Error(`prod access denied: ${names.update}`);
        }
        const path = `/api/${collection.slug}/${id}${buildLocaleDraftQuery(locale, draft)}`;
        const res = await doFetch({
          method: "PATCH",
          path,
          body: data,
          headers,
          env,
          site,
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }
    );

    server.tool(
      names.delete,
      `Delete a ${collection.slug} document by id`,
      {
        id: z.string(),
        locale: localeSchema,
        headers: headersSchema,
        env: envSchema,
        site: siteSchema,
      },
      async ({ id, locale, headers, env, site }) => {
        const target = resolveTarget(site, env);
        if (target.env === "prod" && !isProdAllowed(names.delete)) {
          throw new Error(`prod access denied: ${names.delete}`);
        }
        const path = `/api/${collection.slug}/${id}${buildLocaleDraftQuery(locale, undefined)}`;
        const res = await doFetch({
          method: "DELETE",
          path,
          headers,
          env,
          site,
        });
        return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
      }
    );

    if (collection.hasDrafts && names.setStatus) {
      server.tool(
        names.setStatus,
        `Set ${collection.slug} status to draft or published`,
        {
          id: collection.hasSlugField ? z.string().optional() : z.string(),
          ...(collection.hasSlugField ? { slug: z.string().optional() } : {}),
          status: z.enum(["draft", "published"]),
          locale: localeSchema,
          headers: headersSchema,
          env: envSchema,
          site: siteSchema,
        },
        async ({ id, slug, status, locale, headers, env, site }) => {
          const target = resolveTarget(site, env);
          if (target.env === "prod" && !isProdAllowed(names.setStatus)) {
            throw new Error(`prod access denied: ${names.setStatus}`);
          }
          const resolvedId = await resolveDocId({
            collection: collection.slug,
            id,
            slug: collection.hasSlugField ? slug : undefined,
            locale,
            env,
            site,
            headers,
          });
          const draft = status === "draft";
          const path = `/api/${collection.slug}/${resolvedId}${buildLocaleDraftQuery(locale, draft)}`;
          const res = await doFetch({ method: "PATCH", path, body: {}, headers, env, site });
          return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
        }
      );
    }
  }
}
