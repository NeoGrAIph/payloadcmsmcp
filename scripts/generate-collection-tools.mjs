import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const webCoreRoot =
  process.env.WEB_CORE_ROOT ||
  path.resolve(repoRoot, "../web-core/apps/synestra-io/src");

const payloadConfigPath = path.join(webCoreRoot, "payload.config.ts");
const outputPath = path.join(repoRoot, "lib", "payload", "collection-tools.generated.ts");

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractArray(source, key) {
  const idx = source.indexOf(`${key}:`);
  if (idx === -1) return null;
  const start = source.indexOf("[", idx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start + 1, i);
      }
    }
  }
  return null;
}

function parseImports(source) {
  const imports = new Map();
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(source))) {
    const rawNames = match[1];
    const fromPath = match[2];
    const names = rawNames
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(" as ")[0].trim());
    for (const name of names) {
      if (!name) continue;
      imports.set(name, fromPath);
    }
  }
  return imports;
}

function resolveImportPath(importPath, baseDir) {
  if (importPath.startsWith("@/")) {
    return path.join(webCoreRoot, importPath.slice(2));
  }
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    return path.resolve(baseDir, importPath);
  }
  return null;
}

async function findFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.jsx"),
  ];
  for (const filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) return filePath;
    } catch {
      // ignore
    }
  }
  return null;
}

function extractSlug(source) {
  const match = source.match(/\bslug\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function detectHasSlugField(source) {
  if (/\bslugField\s*\(/.test(source)) return true;
  if (/\bname\s*:\s*['"]slug['"]/.test(source)) return true;
  return false;
}

function detectHasUpload(source) {
  return /\bupload\s*:/.test(source);
}

function detectHasDrafts(source) {
  if (/\bdrafts\s*:/.test(source)) return true;
  if (/\bversions\s*:\s*true\b/.test(source)) return true;
  return false;
}

function toToolSegment(slug) {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  const payloadConfig = await fs.readFile(payloadConfigPath, "utf8");
  const cleaned = stripComments(payloadConfig);
  const importMap = parseImports(cleaned);

  const collectionsBlock = extractArray(cleaned, "collections");
  if (!collectionsBlock) {
    throw new Error("Failed to find collections array in payload.config.ts");
  }

  const collectionNames = collectionsBlock
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+|\./g, ""));

  const identifiers = collectionNames.filter((name) => importMap.has(name));

  const results = [];
  const warnings = [];
  const payloadConfigDir = path.dirname(payloadConfigPath);

  for (const name of identifiers) {
    const importPath = importMap.get(name);
    const resolvedImport = resolveImportPath(importPath, payloadConfigDir);
    if (!resolvedImport) {
      warnings.push(`Skip ${name}: unsupported import path ${importPath}`);
      continue;
    }
    const filePath = await findFile(resolvedImport);
    if (!filePath) {
      warnings.push(`Skip ${name}: file not found for ${resolvedImport}`);
      continue;
    }
    const rawContent = await fs.readFile(filePath, "utf8");
    const fileContent = stripComments(rawContent);
    const slug = extractSlug(fileContent);
    if (!slug) {
      warnings.push(`Skip ${name}: slug not found in ${path.relative(repoRoot, filePath)}`);
      continue;
    }

    const hasSlugField = detectHasSlugField(fileContent);
    const hasDrafts = detectHasDrafts(fileContent);
    const hasUpload = detectHasUpload(fileContent);

    results.push({
      slug,
      source: name,
      hasSlugField,
      hasDrafts,
      hasUpload,
      toolSegment: toToolSegment(slug),
    });
  }

  results.sort((a, b) => a.slug.localeCompare(b.slug));

  const skipped = new Set([
    "landing",
    "users",
    "testimonials",
    "docs",
    "landing-docs",
    "customerLogos",
    "caseStudies",
  ]);

  const header = `// This file is auto-generated by scripts/generate-collection-tools.mjs.\n// Do not edit by hand.\n`;
  const lines = [];
  lines.push(header);
  lines.push("export type CollectionDescriptor = {");
  lines.push("  slug: string;");
  lines.push("  source: string;");
  lines.push("  hasSlugField: boolean;");
  lines.push("  hasDrafts: boolean;");
  lines.push("  hasUpload: boolean;");
  lines.push("  toolSegment: string;");
  lines.push("  skip?: boolean;");
  lines.push("};\n");
  lines.push("export const COLLECTIONS: CollectionDescriptor[] = [");
  for (const item of results) {
    const skip = skipped.has(item.slug);
    lines.push(
      `  { slug: ${JSON.stringify(item.slug)}, source: ${JSON.stringify(
        item.source
      )}, hasSlugField: ${item.hasSlugField}, hasDrafts: ${item.hasDrafts}, hasUpload: ${item.hasUpload}, toolSegment: ${JSON.stringify(
        item.toolSegment
      )}${skip ? ", skip: true" : ""} },`
    );
  }
  lines.push("];\n");
  lines.push("export const SKIPPED_COLLECTIONS = COLLECTIONS.filter((c) => c.skip).map((c) => c.slug);\n");

  await fs.writeFile(outputPath, lines.join("\n"), "utf8");

  if (warnings.length) {
    console.warn("Warnings during generation:\n" + warnings.map((w) => `- ${w}`).join("\n"));
  }

  console.log(`Generated ${results.length} collections -> ${path.relative(repoRoot, outputPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
