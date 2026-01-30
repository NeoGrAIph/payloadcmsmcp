import { COLLECTIONS } from "./collection-tools.generated";
import { getCollectionToolNames } from "./collection-tools";
import { getLandingCollections, getLandingToolNames, listLandingSiteBoundToolNames } from "./landing-tool-names";

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

const COLLECTION_TOOL_NAMES = getCollectionToolNames();
const LANDING_SITE_BOUND_TOOL_NAMES = listLandingSiteBoundToolNames();

const SITE_BOUND_TOOLS = new Set([
  "payload_api_request",
  "payload_api_find",
  "payload_api_create",
  "payload_api_update",
  "payload_api_delete",
  "payload_api_upload",
  ...LANDING_SITE_BOUND_TOOL_NAMES,
  ...COLLECTION_TOOL_NAMES,
]);

const MCP_META_NOTE = "Response always includes `_mcp` with resolved { env, site }.";

function getReturnsWithMeta(doc: ToolDoc) {
  if (!SITE_BOUND_TOOLS.has(doc.name)) return doc.returns;
  if (doc.returns.includes("_mcp")) return doc.returns;
  return `${doc.returns} ${MCP_META_NOTE}`;
}

function buildCollectionToolDocs(): Record<string, ToolDoc> {
  const docs: Record<string, ToolDoc> = {};
  const siteParams: ToolParam[] = [
    { name: "headers", type: "object", description: "Дополнительные заголовки." },
    { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Выбор сайта." },
    { name: "env", type: "enum(dev|prod)", description: "Выбор окружения." },
  ];
  const localeParam: ToolParam = {
    name: "locale",
    type: "enum(ru|en)",
    description: "Локаль (по умолчанию ru).",
    default: "ru",
  };

  for (const collection of COLLECTIONS) {
    if (collection.skip) continue;
    const segment = collection.toolSegment;

    const listName = `payload_${segment}_list`;
    const getName = `payload_${segment}_get`;
    const createName = `payload_${segment}_create`;
    const updateName = `payload_${segment}_update`;
    const deleteName = `payload_${segment}_delete`;
    const setStatusName = `payload_${segment}_set_status`;

    const statusParams = collection.hasDrafts
      ? [{ name: "status", type: "enum(draft|published)", description: "Фильтр статуса." }]
      : [];
    const draftParams = collection.hasDrafts
      ? [{ name: "draft", type: "boolean", description: "Включать черновики (версии Payload)." }]
      : [];
    const uploadNote = collection.hasUpload
      ? ["Для загрузок используйте payload_api_upload."]
      : [];

    const listParams: ToolParam[] = [
      { name: "where", type: "object", description: "Фильтр where (Payload)." },
      { name: "limit", type: "number", description: "Максимум результатов (1–100)." },
      { name: "page", type: "number", description: "Страница пагинации." },
      { name: "sort", type: "string", description: "Сортировка (например, -updatedAt)." },
      ...statusParams,
      localeParam,
      ...draftParams,
      ...siteParams,
    ];

    docs[listName] = {
      name: listName,
      summary: `Список документов ${collection.slug}.`,
      description: `Возвращает документы коллекции ${collection.slug} с фильтрами.`,
      category: "collection",
      readOnly: true,
      destructive: false,
      parameters: listParams,
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Список ${collection.slug}`,
          input: collection.hasDrafts ? { status: "published", limit: 5 } : { limit: 5 },
        },
      ],
      bestPractices: [
        "Используйте небольшие лимиты.",
        "Для коллекций с черновиками используйте фильтр status.",
        ...uploadNote,
      ],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    const getParams: ToolParam[] = [];
    if (collection.hasSlugField) {
      getParams.push({ name: "id", type: "string", description: "ID документа." });
      getParams.push({ name: "slug", type: "string", description: "Slug документа." });
    } else {
      getParams.push({ name: "id", type: "string", required: true, description: "ID документа." });
    }
    getParams.push(...statusParams);
    getParams.push(localeParam);
    getParams.push(...draftParams);
    getParams.push(...siteParams);

    docs[getName] = {
      name: getName,
      summary: `Получить документ ${collection.slug}.`,
      description: `Получает документ ${collection.slug} по id${
        collection.hasSlugField ? " or slug" : ""
      }.`,
      category: "collection",
      readOnly: true,
      destructive: false,
      parameters: getParams,
      returns: "JSON документа.",
      examples: [
        {
          title: `Получить ${collection.slug}`,
          input: collection.hasSlugField ? { slug: "example" } : { id: "123" },
        },
      ],
      bestPractices: ["Для стабильных запросов предпочтителен id.", ...uploadNote],
      pitfalls: [
        ...(collection.hasSlugField ? ["Нужен id или slug."] : []),
        "Prod требует site+env и allowlist в ограниченном режиме.",
      ],
    };

    if (!collection.hasUpload) {
      const createStatusParams = collection.hasDrafts
        ? [{ name: "status", type: "enum(draft|published)", description: "Подсказка статуса (ставит _status)." }]
        : [];
      docs[createName] = {
        name: createName,
        summary: `Создать документ ${collection.slug}.`,
        description: `Создаёт документ в коллекции ${collection.slug}. Для коллекций с черновиками status задаёт _status.`,
        category: "collection",
        readOnly: false,
        destructive: true,
        parameters: [
          { name: "data", type: "object", required: true, description: "Данные документа." },
          ...createStatusParams,
          localeParam,
          ...draftParams,
          ...siteParams,
        ],
        returns: "JSON со status, ok и data.",
        examples: [{ title: `Создать ${collection.slug}`, input: { data: {} } }],
        bestPractices: ["По умолчанию используйте dev; отправляйте минимальные payload."],
        pitfalls: [
          ...(collection.hasDrafts ? ["Укажите либо status, либо draft (не оба).", "Если data._status задан, он должен совпадать со status."] : []),
          "Prod требует site+env и allowlist в ограниченном режиме.",
        ],
      };
    }

    docs[updateName] = {
      name: updateName,
      summary: `Обновить документ ${collection.slug}.`,
      description: `Частично обновляет документ ${collection.slug} по id.`,
      category: "collection",
      readOnly: false,
      destructive: true,
      parameters: [
        { name: "id", type: "string", required: true, description: "ID документа." },
        { name: "data", type: "object", required: true, description: "Данные для частичного обновления." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [{ title: `Обновить ${collection.slug}`, input: { id: "123", data: {} } }],
      bestPractices: ["Отправляйте только изменённые поля; держите payload небольшим."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[deleteName] = {
      name: deleteName,
      summary: `Удалить документ ${collection.slug}.`,
      description: `Удаляет документ ${collection.slug} по id.`,
      category: "collection",
      readOnly: false,
      destructive: true,
      parameters: [
        { name: "id", type: "string", required: true, description: "ID документа." },
        localeParam,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [{ title: `Удалить ${collection.slug}`, input: { id: "123" } }],
      bestPractices: ["Проверьте id перед удалением."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    if (collection.hasDrafts) {
      const statusParamsForSet: ToolParam[] = [
        { name: "status", type: "enum(draft|published)", required: true, description: "Целевой статус." },
      ];
      const setParams: ToolParam[] = [];
      if (collection.hasSlugField) {
        setParams.push({ name: "id", type: "string", description: "ID документа." });
        setParams.push({ name: "slug", type: "string", description: "Slug документа." });
      } else {
        setParams.push({ name: "id", type: "string", required: true, description: "ID документа." });
      }
      setParams.push(...statusParamsForSet);
      setParams.push(localeParam);
      setParams.push(...siteParams);

      docs[setStatusName] = {
        name: setStatusName,
        summary: `Изменить статус ${collection.slug}.`,
        description: `Устанавливает статус ${collection.slug} в draft или published.`,
        category: "collection",
        readOnly: false,
        destructive: true,
        parameters: setParams,
        returns: "JSON со status, ok и data.",
        examples: [
          {
            title: `Публикация ${collection.slug}`,
            input: collection.hasSlugField ? { slug: "example", status: "published" } : { id: "123", status: "published" },
          },
        ],
        bestPractices: ["Используйте draft для правок; публикуйте, когда готово."],
        pitfalls: [
          ...(collection.hasSlugField ? ["Нужен id или slug."] : []),
          "Prod требует site+env и allowlist в ограниченном режиме.",
        ],
      };
    }
  }

  return docs;
}

function buildLandingToolDocs(): Record<string, ToolDoc> {
  const docs: Record<string, ToolDoc> = {};
  const siteParams: ToolParam[] = [
    { name: "headers", type: "object", description: "Дополнительные заголовки." },
    { name: "site", type: "enum(dev.synestra.io|synestra.io)", description: "Выбор сайта." },
    { name: "env", type: "enum(dev|prod)", description: "Выбор окружения." },
  ];
  const localeParam: ToolParam = {
    name: "locale",
    type: "enum(ru|en)",
    description: "Локаль (по умолчанию ru).",
    default: "ru",
  };

  const landingCollections = getLandingCollections();
  for (const collection of landingCollections) {
    const names = getLandingToolNames(collection);
    const slug = collection.slug;
    const hasSlug = collection.hasSlugField;
    const statusParams = collection.hasDrafts
      ? [{ name: "status", type: "enum(draft|published)", description: "Фильтр статуса." }]
      : [];
    const draftParams = collection.hasDrafts
      ? [{ name: "draft", type: "boolean", description: "Включать черновики (версии Payload)." }]
      : [];
    const idSlugParams: ToolParam[] = hasSlug
      ? [
          { name: "id", type: "string", description: "ID документа." },
          { name: "slug", type: "string", description: "Slug документа." },
        ]
      : [{ name: "id", type: "string", required: true, description: "ID документа." }];

    docs[names.list] = {
      name: names.list,
      summary: `Список документов ${slug} с фильтрами.`,
      description: `Возвращает документы ${slug} с фильтрами статуса, локали, пагинации и where.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        { name: "where", type: "object", description: "Фильтр where (Payload)." },
        { name: "limit", type: "number", description: "Максимум результатов (1–100)." },
        { name: "page", type: "number", description: "Страница пагинации." },
        { name: "sort", type: "string", description: "Сортировка (например, -updatedAt)." },
        ...statusParams,
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Список ${slug}`,
          input: collection.hasDrafts ? { status: "published", limit: 5 } : { limit: 5 },
        },
      ],
      bestPractices: ["Используйте небольшие лимиты."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.get] = {
      name: names.get,
      summary: `Получить документ ${slug}.`,
      description: `Получает документ ${slug} по id${hasSlug ? " или slug" : ""}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [...idSlugParams, ...statusParams, localeParam, ...draftParams, ...siteParams],
      returns: "JSON документа.",
      examples: [
        { title: `Получить ${slug}`, input: hasSlug ? { slug: "main" } : { id: "123" } },
      ],
      bestPractices: ["Для стабильных запросов предпочтителен id."],
      pitfalls: [
        ...(hasSlug ? ["Нужен id или slug."] : []),
        "Prod требует site+env и allowlist в ограниченном режиме.",
      ],
    };

    docs[names.heroGet] = {
      name: names.heroGet,
      summary: "Получить hero‑поля и опциональный hero‑блок.",
      description: `Извлекает hero‑поля и опциональный hero‑блок из ${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        ...idSlugParams,
        localeParam,
        ...draftParams,
        { name: "blockType", type: "string", description: "Явный blockType для hero (необязательно)." },
        ...siteParams,
      ],
      returns: "JSON с hero‑полями и блоком (если найден).",
      examples: [{ title: `Hero ${slug}`, input: hasSlug ? { slug: "main" } : { id: "123" } }],
      bestPractices: ["Используйте blockType, чтобы выбрать конкретный hero‑блок."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blocksList] = {
      name: names.blocksList,
      summary: "Список блоков layout с индексами и краткими данными.",
      description: `Список блоков layout из ${slug} с индексами и кратким описанием.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [...idSlugParams, ...statusParams, localeParam, ...draftParams, ...siteParams],
      returns: "JSON со списком блоков и метаданными.",
      examples: [
        { title: `Блоки ${slug}`, input: hasSlug ? { slug: "main" } : { id: "123" } },
      ],
      bestPractices: ["Используйте index для детерминированных правок."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blockGet] = {
      name: names.blockGet,
      summary: "Получить блок layout по index или blockId.",
      description: `Возвращает один блок layout из ${slug} по index или blockId.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        ...idSlugParams,
        { name: "index", type: "number", description: "Индекс блока." },
        { name: "blockId", type: "string", description: "ID блока (id/_id)." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON с блоком и его индексом.",
      examples: [
        {
          title: `Блок ${slug}`,
          input: hasSlug ? { slug: "main", index: 0 } : { id: "123", index: 0 },
        },
      ],
      bestPractices: ["Укажите blockId или index."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    if (names.create) {
      const createStatusParams = collection.hasDrafts
        ? [{ name: "status", type: "enum(draft|published)", description: "Подсказка статуса (ставит _status)." }]
        : [];
      docs[names.create] = {
        name: names.create,
        summary: `Создать документ ${slug}.`,
        description: `Создаёт документ ${slug}. Блоки layout передавайте в поле layout.`,
        category: "landing",
        readOnly: false,
        destructive: true,
        parameters: [
          { name: "data", type: "object", required: true, description: "Данные документа." },
          ...createStatusParams,
          localeParam,
          ...draftParams,
          ...siteParams,
        ],
        returns: "JSON со status, ok и data.",
        examples: [
          {
            title: `Создать ${slug}`,
            input: hasSlug ? { data: { slug: "demo" } } : { data: {} },
          },
        ],
        bestPractices: ["Держите payload минимальным."],
        pitfalls: [
          ...(collection.hasDrafts ? ["Укажите либо status, либо draft (не оба)."] : []),
          "Prod требует site+env и allowlist в ограниченном режиме.",
        ],
      };
    }

    docs[names.update] = {
      name: names.update,
      summary: `Обновить документ ${slug}.`,
      description: `Безопасно обновляет поля верхнего уровня ${slug}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [
        ...idSlugParams,
        { name: "data", type: "object", required: true, description: "Данные для частичного обновления." },
        { name: "mode", type: "enum(safe|merge)", description: "Режим обновления (по умолчанию safe)." },
        { name: "allowUnsafe", type: "boolean", description: "Разрешить небезопасный merge/replace." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Обновить ${slug}`,
          input: hasSlug ? { slug: "main", data: { title: "New" } } : { id: "123", data: { title: "New" } },
        },
      ],
      bestPractices: ["Обновляйте только изменённые поля."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.delete] = {
      name: names.delete,
      summary: `Удалить документ ${slug}.`,
      description: `Удаляет документ ${slug} по id${hasSlug ? " или slug" : ""}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [...idSlugParams, ...siteParams],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Удалить ${slug}`,
          input: hasSlug ? { slug: "main" } : { id: "123" },
        },
      ],
      bestPractices: ["Проверьте ID перед удалением."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blockAdd] = {
      name: names.blockAdd,
      summary: "Добавить блок в layout.",
      description: `Добавляет блок в layout для ${slug}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [
        ...idSlugParams,
        { name: "block", type: "object", required: true, description: "Данные блока (blockType обязателен)." },
        { name: "position", type: "number", description: "Позиция вставки (необязательно)." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Добавить блок ${slug}`,
          input: hasSlug
            ? { slug: "main", block: { blockType: "content" } }
            : { id: "123", block: { blockType: "content" } },
        },
      ],
      bestPractices: ["Используйте position для контроля порядка."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blockUpdate] = {
      name: names.blockUpdate,
      summary: "Обновить блок layout по index или blockId.",
      description: `Безопасно обновляет блок в layout ${slug}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [
        ...idSlugParams,
        { name: "index", type: "number", description: "Индекс блока." },
        { name: "blockId", type: "string", description: "ID блока (id/_id)." },
        { name: "patch", type: "object", required: true, description: "Патч блока." },
        { name: "mode", type: "enum(safe|merge|replace)", description: "Режим обновления." },
        { name: "allowUnsafe", type: "boolean", description: "Разрешить небезопасный merge/replace." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Обновить блок ${slug}`,
          input: hasSlug
            ? { slug: "main", index: 0, patch: { blockName: "Updated" } }
            : { id: "123", index: 0, patch: { blockName: "Updated" } },
        },
      ],
      bestPractices: ["Используйте safe для защиты массивов при merge."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blockRemove] = {
      name: names.blockRemove,
      summary: "Удалить блок layout по index или blockId.",
      description: `Удаляет блок из layout ${slug}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [
        ...idSlugParams,
        { name: "index", type: "number", description: "Индекс блока." },
        { name: "blockId", type: "string", description: "ID блока (id/_id)." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Удалить блок ${slug}`,
          input: hasSlug ? { slug: "main", index: 0 } : { id: "123", index: 0 },
        },
      ],
      bestPractices: ["Используйте blockId, когда порядок может меняться."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    docs[names.blockMove] = {
      name: names.blockMove,
      summary: "Переместить блок в layout.",
      description: `Перемещает блок в layout ${slug}.`,
      category: "landing",
      readOnly: false,
      destructive: true,
      parameters: [
        ...idSlugParams,
        { name: "from", type: "number", required: true, description: "Индекс источника." },
        { name: "to", type: "number", required: true, description: "Индекс назначения." },
        localeParam,
        ...draftParams,
        ...siteParams,
      ],
      returns: "JSON со status, ok и data.",
      examples: [
        {
          title: `Переместить блок ${slug}`,
          input: hasSlug ? { slug: "main", from: 0, to: 1 } : { id: "123", from: 0, to: 1 },
        },
      ],
      bestPractices: ["Проверьте индексы перед перемещением."],
      pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
    };

    if (names.setStatus) {
      docs[names.setStatus] = {
        name: names.setStatus,
        summary: `Установить статус ${slug} (draft/published).`,
        description: `Устанавливает _status для документов ${slug}.`,
        category: "landing",
        readOnly: false,
        destructive: true,
        parameters: [
          ...idSlugParams,
          { name: "status", type: "enum(draft|published)", required: true, description: "Целевой статус." },
          localeParam,
          ...siteParams,
        ],
        returns: "JSON со status, ok и data.",
        examples: [
          {
            title: `Публикация ${slug}`,
            input: hasSlug ? { slug: "main", status: "published" } : { id: "123", status: "published" },
          },
        ],
        bestPractices: ["Используйте для явной публикации."],
        pitfalls: ["Prod требует site+env и allowlist в ограниченном режиме."],
      };
    }

    docs[names.generate] = {
      name: names.generate,
      summary: "Сгенерировать JSON блока layout по схеме.",
      description: `Генерирует JSON для blockType по схемам schema/${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        { name: "blockType", type: "string", required: true, description: "Slug типа блока." },
        { name: "preset", type: "enum(minimal|full)", description: "Пресет размера примера." },
        { name: "locale", type: "enum(en|ru)", description: "Локаль (необязательно)." },
      ],
      returns: "JSON блока.",
      examples: [{ title: `Сгенерировать блок ${slug}`, input: { blockType: "content" } }],
      bestPractices: ["Используйте minimal для быстрых заготовок."],
      pitfalls: ["Наличие схем зависит от каталога schema."],
    };

    docs[names.validate] = {
      name: names.validate,
      summary: "Проверить JSON layout по схемам.",
      description: `Проверяет JSON документа или блока по схемам schema/${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        { name: "document", type: "string", required: true, description: "JSON строка." },
        { name: "mode", type: "enum(strict|loose)", description: "Loose трактует не‑JSON как MDX." },
      ],
      returns: "JSON результата валидации.",
      examples: [
        { title: `Проверить ${slug}`, input: { document: "{\"layout\":[{\"blockType\":\"content\"}]}" } },
      ],
      bestPractices: ["blockType должен соответствовать схеме."],
      pitfalls: ["Неизвестный blockType приводит к ошибке."],
    };

    docs[names.schemaList] = {
      name: names.schemaList,
      summary: "Список доступных схем блоков.",
      description: `Возвращает список схем блоков в schema/${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [],
      returns: "JSON со списком схем блоков.",
      examples: [{ title: `Схемы ${slug}`, input: {} }],
      bestPractices: ["Убедитесь, что каталог схем существует."],
      pitfalls: ["Пустой список означает, что схемы не найдены."],
    };

    docs[names.schemaGet] = {
      name: names.schemaGet,
      summary: "Получить JSON Schema блока.",
      description: `Возвращает JSON Schema для blockType в schema/${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [{ name: "blockType", type: "string", required: true, description: "Slug типа блока." }],
      returns: "Raw JSON Schema.",
      examples: [{ title: `Получить схему ${slug}`, input: { blockType: "content" } }],
      bestPractices: ["Используйте schema_list, чтобы узнать доступные blockType."],
      pitfalls: ["Если схема отсутствует, вернётся ошибка not found."],
    };

    docs[names.documentation] = {
      name: names.documentation,
      summary: "Справка по landing‑инструментам.",
      description: `Возвращает сводку или детали по инструментам ${slug}.`,
      category: "landing",
      readOnly: true,
      destructive: false,
      parameters: [
        { name: "mode", type: "enum(summary|tool)", description: "Сводка или один инструмент." },
        { name: "toolName", type: "string", description: "Имя инструмента для деталей." },
      ],
      returns: "JSON со списком или деталями.",
      examples: [{ title: `Сводка инструментов ${slug}`, input: { mode: "summary" } }],
      bestPractices: ["Для общего индекса используйте payload_tools_documentation."],
      pitfalls: ["Ограничено только landing‑инструментами."],
    };
  }

  return docs;
}

const COLLECTION_TOOL_DOCS = buildCollectionToolDocs();
const LANDING_TOOL_DOCS = buildLandingToolDocs();

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

Object.assign(TOOL_DOCS, LANDING_TOOL_DOCS, COLLECTION_TOOL_DOCS);

const TOOL_ORDER = Object.keys(TOOL_DOCS);

function renderOverviewMarkdown(depth: "essentials" | "full") {
  const lines: string[] = [];
  lines.push("# payloadcmsmcp Tools Documentation");
  lines.push("");
  lines.push("## Overview");
  lines.push(
    "This MCP server provides Payload CMS tooling, landing schema helpers, collection CRUD tools, and Payload API bridge tools. Use `payload_tools_documentation` to discover tools and get per-tool details."
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
  lines.push("- Prefer collection tools (payload_<collection>_*) for collection CRUD.");
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
