import fs from "fs/promises";
import path from "path";
import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export type LandingSchemaMap = Record<string, ValidateFunction>;

export async function loadLandingSchemas(schemaDir = "schema/landing"): Promise<LandingSchemaMap> {
  const resolvedDir = path.isAbsolute(schemaDir) ? schemaDir : path.join(process.cwd(), schemaDir);
  const entries = await fs.readdir(resolvedDir);
  const validators: LandingSchemaMap = {};
  for (const file of entries) {
    if (!file.endsWith(".schema.json")) continue;
    const slug = file.replace(".schema.json", "");
    const raw = await fs.readFile(path.join(resolvedDir, file), "utf8");
    const schema = JSON.parse(raw);
    validators[slug] = ajv.compile(schema);
  }
  return validators;
}

export function validateLandingBlock(
  validators: LandingSchemaMap,
  block: Record<string, any>
): { valid: boolean; errors?: string[] } {
  const slug = block?.blockType;
  const validate = slug ? validators[slug] : undefined;
  if (!validate) {
    return { valid: false, errors: [`Unknown blockType: ${slug ?? "undefined"}`] };
  }
  const ok = validate(block);
  if (ok) return { valid: true };
  return {
    valid: false,
    errors:
      validate.errors?.map((e) => `${e.instancePath || "/"} ${e.message}`) ?? ["Validation failed"],
  };
}

export function listLandingSchemas(validators: LandingSchemaMap) {
  return Object.keys(validators);
}
