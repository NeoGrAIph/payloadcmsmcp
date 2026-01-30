import { COLLECTIONS } from "./collection-tools.generated";

type CollectionDescriptor = typeof COLLECTIONS[number];

export type LandingCollectionDescriptor = CollectionDescriptor & { landingCapable: true };

type LandingToolNames = {
  list: string;
  get: string;
  heroGet: string;
  blocksList: string;
  blockGet: string;
  create?: string;
  update: string;
  delete: string;
  blockAdd: string;
  blockUpdate: string;
  blockRemove: string;
  blockMove: string;
  setStatus?: string;
  generate: string;
  validate: string;
  schemaList: string;
  schemaGet: string;
  documentation: string;
};

function toolName(segment: string, action: string): string {
  return `payload_${segment}_${action}`;
}

export function getLandingCollections(): LandingCollectionDescriptor[] {
  return COLLECTIONS.filter((collection) => collection.landingCapable) as LandingCollectionDescriptor[];
}

export function getLandingToolNames(collection: CollectionDescriptor): LandingToolNames {
  const segment = collection.toolSegment;
  const create = collection.hasUpload ? undefined : toolName(segment, "create");
  const setStatus = collection.hasDrafts ? toolName(segment, "set_status") : undefined;
  return {
    list: toolName(segment, "list"),
    get: toolName(segment, "get"),
    heroGet: toolName(segment, "hero_get"),
    blocksList: toolName(segment, "blocks_list"),
    blockGet: toolName(segment, "block_get"),
    create,
    update: toolName(segment, "update"),
    delete: toolName(segment, "delete"),
    blockAdd: toolName(segment, "block_add"),
    blockUpdate: toolName(segment, "block_update"),
    blockRemove: toolName(segment, "block_remove"),
    blockMove: toolName(segment, "block_move"),
    setStatus,
    generate: toolName(segment, "generate"),
    validate: toolName(segment, "validate"),
    schemaList: toolName(segment, "schema_list"),
    schemaGet: toolName(segment, "schema_get"),
    documentation: toolName(segment, "documentation"),
  };
}

export function listLandingToolNames(): string[] {
  return getLandingCollections()
    .flatMap((collection) => {
      const names = getLandingToolNames(collection);
      return Object.values(names).filter(Boolean) as string[];
    })
    .sort();
}

export function listLandingSiteBoundToolNames(): string[] {
  return getLandingCollections()
    .flatMap((collection) => {
      const names = getLandingToolNames(collection);
      return [
        names.list,
        names.get,
        names.heroGet,
        names.blocksList,
        names.blockGet,
        names.create,
        names.update,
        names.delete,
        names.blockAdd,
        names.blockUpdate,
        names.blockRemove,
        names.blockMove,
        names.setStatus,
      ].filter(Boolean) as string[];
    })
    .sort();
}
