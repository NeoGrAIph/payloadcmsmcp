# 🚀 MCP‑сервер для Payload CMS 3.0

<div align="center">
  <p align="center">
    <img src="https://www.payloadcmsmcp.info/logopayload.png" alt="Логотип Payload CMS" width="120" height="120" style="border-radius: 10px; padding: 5px; background-color: white; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);" />
  </p>
<p align="center">
    <img src="https://img.shields.io/badge/Model%20Context%20Protocol-Enabled-6366F1?style=for-the-badge" alt="MCP включён" />
    <img src="https://img.shields.io/badge/Payload%20CMS%203.0-Integration-3B82F6?style=for-the-badge" alt="Payload CMS" />
    <img src="https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge" alt="Лицензия" />
    <img src="https://img.shields.io/badge/Railway-Deployment-0B0D0E?style=for-the-badge" alt="Деплой на Railway" />
  </p>
  
  <h3>Специализированный MCP‑сервер для Payload CMS 3.0</h3>
  <p>Валидация кода, генерация шаблонов и создание каркаса проектов по лучшим практикам</p>
</div>

<hr>

## 📋 Обзор

MCP‑сервер для Payload CMS 3.0 — специализированный сервер Model Context Protocol, созданный для улучшения разработки на Payload CMS. Он помогает разработчикам делать приложения лучше за счёт валидации кода, генерации шаблонов и создания структуры проекта в соответствии с лучшими практиками.

<hr>

## ✨ Возможности

<div align="center">
  <table>
    <tr>
      <td align="center">
        <h3>📚</h3>
        <b>Валидация кода</b>
        <p>Проверка кода Payload CMS для коллекций, полей, глобальных сущностей и конфиг‑файлов с подробной обратной связью по ошибкам синтаксиса и best practices.</p>
      </td>
      <td align="center">
        <h3>🔍</h3>
        <b>Генерация кода</b>
        <p>Генерация шаблонов для коллекций, полей, глобальных сущностей, access control, хуков, эндпоинтов, плагинов, блоков и миграций.</p>
      </td>
      <td align="center">
        <h3>🚀</h3>
        <b>Скаффолдинг проекта</b>
        <p>Создание полного каркаса проектов Payload CMS с проверенными опциями для консистентности и соответствия лучшим практикам.</p>
      </td>
    </tr>
  </table>
</div>

<hr>

## 🔧 Возможности Payload CMS 3.0

### Инструменты валидации

* `payload_validation_validate` — валидация кода коллекций, полей, глобальных сущностей и конфигурации
* `payload_validation_query` — поиск по небольшому встроенному набору правил (не полная база best practices)
* `payload_validation_mcp_query` — SQL‑подобные запросы к встроенной таблице `validation_rules`

### Генерация кода

* `payload_template_generate` — генерация шаблонов для различных компонентов
* `payload_collection_generate` — создание полной конфигурации коллекции
* `payload_field_generate` — генерация определения поля с корректной типизацией

### Настройка проекта

* `payload_scaffold_project_generate` — создание структуры проекта Payload CMS
* `validate_scaffold_options` — внутренний валидатор для `payload_scaffold_project_generate` (не доступен как инструмент)

<hr>

## 📝 Подробный справочник по инструментам

### Инструменты валидации

#### `payload_validation_validate`
Проверяет код Payload CMS на синтаксис и best practices.

**Параметры:**
- `code` (string): код для проверки
- `fileType` (enum): тип файла — "collection", "field", "global" или "config"

**Важно:**
- `payload_validation_validate` использует `eval` для переданной строки. **Не** передавайте непроверенный ввод.
- Вход должен быть **чистым JS‑литералом объекта**. `import`/`export` не поддерживаются.

**Пример запроса:**
```
Can you validate this Payload CMS collection code?

```typescript
{
  slug: 'posts',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
    }
  ],
  admin: {
    useAsTitle: 'title',
  }
}
```

#### `payload_validation_query`
Ищет по небольшому **встроенному** набору правил (эвристики). Это не полная база best practices.

**Параметры:**
- `query` (string): строка запроса
- `fileType` (optional enum): тип файла — "collection", "field", "global" или "config"

**Пример запроса:**
```
Find rules related to access control for collections.
```

#### `payload_validation_mcp_query`
Выполняет SQL‑подобные запросы к **встроенной** таблице `validation_rules`.

**Параметры:**
- `sql` (string): строка SQL‑подобного запроса

**Пример запроса:**
```
Can you list security rules?
SELECT id, category, description FROM validation_rules WHERE category = 'security' LIMIT 5

Describe the available columns:
DESCRIBE validation_rules
```

### Генерация кода

#### `payload_template_generate`
Генерирует шаблоны кода для различных компонентов Payload CMS.

**Параметры:**
- `templateType` (enum): тип шаблона — "collection", "field", "global", "config", "access-control", "hook", "endpoint", "plugin", "block", "migration"
- `options` (record): опции конфигурации шаблона

**Примечания:**
- Сейчас код использует `import ... from 'payload/types'` (стиль Payload v2). Для Payload 3 нужно заменить на `import type { ... } from 'payload'`.
- Некоторые шаблоны намеренно универсальные и требуют ручной доработки.

**Пример запроса:**
```
Generate a template for a Payload CMS hook that logs when a document is created.
```

#### `payload_collection_generate`
Генерирует полную конфигурацию коллекции Payload CMS.

**Параметры:**
- `slug` (string): slug коллекции
- `fields` (optional array): массив объектов полей
- `auth` (optional boolean): является ли коллекция auth‑коллекцией
- `timestamps` (optional boolean): добавлять ли временные метки
- `admin` (optional object): настройки админ‑панели
- `hooks` (optional boolean): включать ли хуки
- `access` (optional boolean): включать ли access control
- `versions` (optional boolean): включать ли версионирование

**Пример запроса:**
```
Generate a Payload CMS collection for a blog with title, content, author, and published date fields. Include timestamps and versioning.
```

**Примечания:**
- Вывод — стартовая точка. Обычно нужно добавить access control, admin‑labels и пути импорта Payload 3.

#### `payload_field_generate`
Генерирует определение поля Payload CMS.

**Параметры:**
- `name` (string): имя поля
- `type` (string): тип поля
- `required` (optional boolean): обязательность
- `unique` (optional boolean): уникальность
- `localized` (optional boolean): локализация
- `access` (optional boolean): включить access control
- `admin` (optional object): настройки админ‑панели
- `validation` (optional boolean): включить валидацию
- `defaultValue` (optional any): значение по умолчанию

**Пример запроса:**
```
Generate a Payload CMS image field with validation that requires alt text and has a description in the admin panel.
```

**Примечания:**
- Для текстовых полей добавляются `minLength`/`maxLength` по умолчанию.
- Для `upload` полей всё равно нужен `relationTo`, соответствующий вашему проекту.

### Настройка проекта

#### `payload_scaffold_project_generate`
Создаёт полную структуру проекта Payload CMS.

**Параметры:**
- `projectName` (string): имя проекта
- `description` (optional string): описание проекта
- `serverUrl` (optional string): URL сервера
- `database` (optional enum): тип базы данных — "mongodb" или "postgres"
- `auth` (optional boolean): включать ли аутентификацию
- `admin` (optional object): настройки админ‑панели
- `collections` (optional array): массив коллекций
- `globals` (optional array): массив глобальных сущностей
- `blocks` (optional array): массив блоков
- `plugins` (optional array): массив плагинов
- `typescript` (optional boolean): использовать ли TypeScript

**Пример запроса:**
```
Scaffold a Payload CMS project called "blog-platform" with MongoDB, authentication, and collections for posts, categories, and users. Include a global for site settings.
```

**Примечания:**
- Возвращает **JSON‑описание** файлов, а не реальные файлы.
- Опции валидируются; неверные значения дают ошибку.

### Landing GitOps (новое)

#### `payload_tools_documentation`
Возвращает документацию по всем инструментам payloadcmsmcp (обзор или по инструменту). Аналог `n8n_tools_documentation`.

**Параметры:**
- `topic` (optional string): имя инструмента или `overview` (по умолчанию).
- `depth` (optional enum): `essentials` | `full` (по умолчанию essentials).
- `format` (optional enum): `json` | `markdown` (по умолчанию markdown).

#### `payload_landing_generate`
Генерирует JSON для landing‑блока, соответствующего встроенным схемам.
Поддерживаемые `blockType`: `content`, `callToAction`, `mediaBlock`, `banner`, `carousel`, `archive`, `threeItemGrid`, `formBlock`, `code`.

**Параметры:**
- `blockType` (string): slug блока.
- `preset` (optional enum): "minimal" | "full" (по умолчанию full).
- `locale` (optional enum): "en" | "ru" (влияет только на примерный текст).

#### `payload_landing_validate`
Проверяет landing‑документ по схемам. Принимает одиночный блок или `{ "sections": [...] }`.
Вход — **строка JSON**. В `mode: "loose"` не‑JSON пропускается.

**Параметры:**
- `document` (string): строка JSON.
- `mode` (optional enum): "strict" | "loose" (loose пропускает не‑JSON).

#### `payload_landing_schema_list`
Список доступных схем landing‑блоков.

#### `payload_landing_schema_get`
Возвращает полную JSON‑схему для `blockType`.

#### `payload_landing_documentation`
Краткая или подробная справка по инструментам landing.

### Payload API Bridge (новое)

**Ответы:** все site‑bound инструменты включают `_mcp` с `{ env, site }`.

#### `payload_api_request`
Сырый HTTP‑вызов к Payload API (base из `PAYLOAD_API_URL_DEV`/`PAYLOAD_API_URL_PROD`). Параметры: `method`, `path` (должен начинаться с `/`), optional `body`, `headers`, optional `site` (`dev.synestra.io` по умолчанию / `synestra.io`), optional `env` (`dev` по умолчанию / `prod`). Для prod **нужно и** `site: "synestra.io"`, и `env: "prod"`, плюс allowlist если `PAYLOAD_PROD_ACCESS_MODE=unrestricted` не задан.
Auth по умолчанию: `PAYLOAD_API_SECRET` (Bearer) или `PAYLOAD_API_USER/PASS` (Basic).
Если API требует иную схему (например, `users API-Key <token>`), передайте кастомный `Authorization` через `headers`.

**Переопределения схемы авторизации (optional):**
- `PAYLOAD_API_AUTH_SCHEME` = `auto` (по умолчанию), `bearer`, `basic`, `users-api-key`, `api-key`, `none`
- `PAYLOAD_API_KEY_PREFIX` (по умолчанию: `users API-Key`)
- `PAYLOAD_API_AUTH_HEADER_NAME` (по умолчанию: `Authorization`)

#### `payload_api_find` / `payload_api_create` / `payload_api_update` / `payload_api_delete`
Упрощённые CRUD‑хелперы для коллекций с optional `locale`.

#### `payload_api_upload`
Загрузка небольшого файла через multipart; параметры: `filename`, `mime`, `base64`, optional `relationTo` (по умолчанию `media`).

#### `payload_api_docs`
Шпаргалка по общим эндпоинтам и подсказкам (auth, коллекции, uploads, locale).

### Landing Editor Tools (новое)

Эти инструменты работают **только** с коллекцией `landing` и ориентированы на удобную работу редактора.

#### `payload_landing_list`
Список landing‑документов с фильтрами (status/locale/пагинация). Если `status=draft`, сервер принудительно выставляет `draft=true` (включая случаи, когда `where` содержит `_status=draft`).

#### `payload_landing_get`
Получить landing по `id` или `slug`. Опционально `status`; при `status=draft` используется `draft=true`.

#### `payload_landing_hero_get`
Получить hero‑поля верхнего уровня и опциональный hero‑блок.

#### `payload_landing_blocks_list`
Список блоков с индексами и краткими описаниями для точечного редактирования. Опциональный `status`; при `status=draft` используется `draft=true`.

#### `payload_landing_block_get`
Получить один блок по индексу или blockId.

#### `payload_landing_create` / `payload_landing_update`
Создать или обновить поля верхнего уровня. `payload_landing_update` по умолчанию в **safe**‑режиме (массивы мержатся по `id/_id`). Чтобы использовать legacy shallow update, задайте `mode: "merge"` и `allowUnsafe: true`.

#### `payload_landing_block_add` / `payload_landing_block_update` / `payload_landing_block_remove` / `payload_landing_block_move`
Добавить/обновить/удалить/переупорядочить блоки в `sections`. `payload_landing_block_update` по умолчанию в **safe**‑режиме: глубокий merge, элементы массивов по `id/_id` (предотвращает случайные удаления). Для legacy shallow merge или полной замены задайте `mode: "merge"|"replace"` **и** `allowUnsafe: true`.

#### `payload_landing_set_status`
Публикация/снятие с публикации (draft/published) через механизм черновиков Payload.

## ⚠️ Известные ограничения и подводные камни

- **Валидация использует `eval`**: передавайте только доверенный ввод и **чистые литералы объектов** (без `import`/`export`).
- **Набор правил небольшой**: `payload_validation_query`/`payload_validation_mcp_query` ищут по ограниченному набору правил. Результаты могут быть пустыми.
- **SQL‑таблицы ограничены**: поддерживается только `validation_rules` (`payload_schema` не поддерживается).
- **Импорты Payload 3**: сгенерированный код использует `payload/types` и может потребовать ручной замены на `import type { ... } from 'payload'`.
- **Поля по умолчанию для блоков**: `payload_template_generate` для блоков добавляет `image` и `content` по умолчанию. Установите `imageField: false` / `contentField: false`, чтобы отключить.
- **Хуки универсальные**: шаблоны используют `beforeOperation`/`afterOperation` и могут требовать адаптации под ваш проект.
- **Схемы авторизации API**: поддерживаются `PAYLOAD_API_AUTH_SCHEME` (`users-api-key`, `bearer`, `basic`, `api-key`, `none`) и кастомные заголовки.
- **Вывод скаффолда**: `payload_scaffold_project_generate` возвращает JSON‑структуру, а не файлы на диске.

## 🔌 Транспорт и эндпоинты

- MCP‑сервер использует **SSE‑транспорт** с `/sse` и `/message`.
- Streamable HTTP MCP **не** обслуживается напрямую; используйте мост (например, mcp‑sse‑bridge) или gateway для `/mcp`.
- `tools/list` включает MCP `annotations` для клиентов с учётом безопасности (readOnly/destructive/idempotent/openWorld).

<hr>

## 🚀 Начало работы

### 1. Требования

Перед началом убедитесь, что у вас есть:

* Node.js 18+ (обязательно для Payload CMS 3.0)
* Аккаунт Railway
* Railway API token (создайте на [railway.app/account/tokens](https://railway.app/account/tokens))
* Базовые знания Payload CMS 3.0

### 1.1 Обязательные переменные окружения

MCP‑сервер **требует Redis** для SSE‑сессий:
- `REDIS_URL` или `KV_URL` (обязательно)

Для инструментов Payload API требуются:
- `PAYLOAD_API_URL_DEV` (обязательно для payload_api_*; цель по умолчанию)
- `PAYLOAD_API_URL_PROD` (обязательно для payload_api_* при `site=synestra.io` и `env=prod`)
- `PAYLOAD_PROD_ALLOWLIST` (CSV, по умолчанию пусто). Пример: `payload_api_find,payload_api_update,payload_api_upload,payload_api_request_get`.
- `PAYLOAD_PROD_ACCESS_MODE` (по умолчанию `restricted`). Установите `unrestricted` чтобы обойти allowlist для prod.
- `PAYLOAD_API_SECRET` **или** `PAYLOAD_API_USER` + `PAYLOAD_API_PASS` (опционально, для auth)
- `PAYLOAD_API_AUTH_SCHEME` (опционально): `auto` (по умолчанию), `bearer`, `basic`, `users-api-key`, `api-key`, `none`
- `PAYLOAD_API_KEY_PREFIX` (опционально, по умолчанию: `users API-Key`)
- `PAYLOAD_API_AUTH_HEADER_NAME` (опционально, по умолчанию: `Authorization`)

Ограничения:
- Тела JSON и загрузки ограничены ~1.5MB.

### 1.2 CRUD‑инструменты коллекций (генерируются автоматически)

Сервер предоставляет CRUD‑инструменты по коллекциям, сгенерированные из `web-core/apps/synestra-io` collections.

- Имена инструментов: `payload_<collection>_<action>`, где action — `list|get|create|update|delete|set_status`.
- Коллекции с черновиками получают `set_status` и draft‑ориентированное поведение list/get.
- Коллекции загрузок (например, `media`) **не** получают `create`; используйте `payload_api_upload`.
- `landing` исключён в пользу специализированных инструментов.

Перегенерируйте при изменении коллекций:

```
pnpm generate:collection-tools
```

### 2. Настройка Cursor

Чтобы использовать в Cursor IDE:

1. Откройте настройки Cursor
2. Перейдите в раздел MCP Servers
3. Добавьте новый MCP‑сервер
4. Назовите его "Payload CMS 3.0 MCP"
5. Тип транспорта — "Command"
6. Команда: `railway run --service=YOUR_SERVICE_ID`
7. Сохраните

### 3. Использование MCP‑сервера

После настройки можно вызывать инструменты в промптах:

* **Валидация кода:** "Validate this Payload CMS collection code"
* **Генерация шаблонов:** "Generate a template for a media collection"
* **Запрос правил:** "Find validation rules about access control"
* **SQL‑подобные запросы:** "List security rules from validation_rules"

### 4. Пример рабочего процесса

Типичный процесс с MCP‑сервером Payload CMS:

1. Сгенерировать шаблон коллекции с нужными полями
2. Провалидировать код по best practices
3. Запросить встроенные правила для улучшения кода
4. Сгенерировать дополнительные компоненты (хуки, эндпоинты)
5. При готовности — скаффолдинг проекта

### 5. Полный пример рабочего процесса

Полный пример диалога:

```
User: I need to create a Payload CMS collection for a product catalog.

AI: I'll help you create a product catalog collection. Let me generate a template for you.

[Uses payload_collection_generate tool]

Here's a collection template for your product catalog:

```typescript
import { CollectionConfig } from 'payload/types';

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'category', 'inStock'],
    group: 'Shop',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'altText',
          type: 'text',
          required: true,
        }
      ]
    },
    {
      name: 'inStock',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  timestamps: true,
}
```

User: Can you validate this code to make sure it follows best practices?

AI: I'll validate the code for you.

[Uses payload_validation_validate tool]

The validation results show that your code is valid and follows best practices. Here are a few suggestions:

1. Consider adding a maxDepth to your category relationship field to prevent deep queries
2. You might want to add access control for create, update, and delete operations
3. Consider adding hooks for inventory management when products are updated

User: What are the best practices for access control in Payload CMS?

AI: Let me query the validation rules for access control.

[Uses payload_validation_query tool]

Here are the **built-in** rules related to access control (note: the rule set is small and heuristic):

- access-control (category: security)
- sensitive-fields (category: security)

User: Now I need to scaffold a complete project with this product collection and a categories collection.

AI: I'll scaffold a complete project for you.

[Uses payload_scaffold_project_generate tool]

I've generated a complete Payload CMS project structure with the following:

- Product collection as you specified
- Categories collection with name and description fields
- Media collection for product images
- Authentication for admin users
- TypeScript configuration
- MongoDB database setup
- All necessary files and configurations

The project is ready to be initialized with `npm install` and `npm run dev`.

<hr>

## 📋 Примеры скаффолдинга и подробные промпты

### Примеры скаффолдинга проектов

При скаффолдинге проекта MCP‑сервер возвращает полную структуру. Пример для e‑commerce:

```
e-commerce-platform/
├── .env
├── .eslintrc.js
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   ├── payload.config.ts
│   ├── server.ts
│   ├── collections/
│   │   ├── Products.ts
│   │   ├── Categories.ts
│   │   ├── Orders.ts
│   │   ├── Customers.ts
│   │   ├── Media.ts
│   │   └── Users.ts
│   ├── globals/
│   │   ├── Settings.ts
│   │   └── Footer.ts
│   ├── blocks/
│   │   ├── Hero.ts
│   │   ├── ProductGrid.ts
│   │   └── CallToAction.ts
│   ├── fields/
│   │   ├── richText/
│   │   ├── metaImage.ts
│   │   └── slug.ts
│   ├── hooks/
│   │   ├── beforeChange.ts
│   │   └── afterChange.ts
│   ├── access/
│   │   ├── isAdmin.ts
│   │   └── isAdminOrSelf.ts
│   └── utilities/
│       ├── formatSlug.ts
│       └── sendEmail.ts
```

### Пример базового промпта для скаффолдинга

```
Scaffold a Payload CMS project for a blog platform with the following:
- Project name: blog-platform
- Database: MongoDB
- Authentication: Yes
- Collections: Posts, Categories, Authors, Media
- Globals: SiteSettings
- TypeScript: Yes
```

### Пример подробного промпта для скаффолдинга

```
Scaffold a comprehensive Payload CMS project for an e-commerce platform with the following specifications:

Project details:
- Name: luxury-watches-store
- Description: "An e-commerce platform for luxury watches"
- Database: PostgreSQL
- TypeScript: Yes

Collections needed:
1. Products collection with:
   - Name (text, required)
   - Description (rich text)
   - Price (number, required)
   - SKU (text, unique)
   - Brand (relationship to Brands collection)
   - Categories (relationship to Categories, multiple)
   - Features (array of text fields)
   - Specifications (array of key-value pairs)
   - Images (array of media uploads with alt text)
   - Stock quantity (number)
   - Status (select: available, out of stock, discontinued)

2. Categories collection with:
   - Name (text, required)
   - Description (rich text)
   - Parent category (self-relationship)
   - Image (media upload)

3. Brands collection with:
   - Name (text, required)
   - Logo (media upload)
   - Description (rich text)
   - Founded year (number)
   - Country of origin (text)

4. Orders collection with:
   - Order number (text, generated)
   - Customer (relationship to Users)
   - Products (array of relationships to Products with quantity)
   - Status (select: pending, processing, shipped, delivered, cancelled)
   - Shipping address (group of fields)
   - Billing address (group of fields)
   - Payment method (select)
   - Total amount (number, calculated)
   - Notes (text)

5. Users collection (auth enabled) with:
   - Email (email, required)
   - Name (text, required)
   - Shipping addresses (array of address groups)
   - Order history (relationship to Orders)
   - Wishlist (relationship to Products)
   - Role (select: customer, admin)

Globals:
1. SiteSettings with:
   - Site name
   - Logo
   - Contact information
   - Social media links
   - SEO defaults

2. ShippingMethods with:
   - Array of shipping options with prices

Include access control for:
- Admin-only access to manage products, categories, brands
- Customer access to their own orders and profile
- Public read access to products and categories

Add hooks for:
- Updating stock when orders are placed
- Generating order numbers
- Sending email notifications on order status changes
```

### Пример базового промпта для создания коллекции

```
Generate a Payload CMS collection for blog posts with title, content, author, and published date fields.
```

### Пример подробного промпта для создания коллекции

```
Generate a Payload CMS collection for a real estate property listing with the following specifications:

Collection name: Properties
Admin configuration:
- Use "title" as the display field
- Group under "Listings" in the admin panel
- Default columns: title, price, location, status, createdAt

Fields:
1. Title (text, required)
2. Slug (text, unique, generated from title)
3. Description (rich text with basic formatting options)
4. Price (number, required)
5. Location (group) with:
   - Address (text)
   - City (text, required)
   - State/Province (text, required)
   - Postal code (text)
   - Country (select from predefined list)
   - Coordinates (point) for map display
6. Property details (group) with:
   - Property type (select: house, apartment, condo, land, commercial)
   - Bedrooms (number)
   - Bathrooms (number)
   - Square footage (number)
   - Lot size (number)
   - Year built (number)
   - Parking spaces (number)
7. Features (array of checkboxes) including:
   - Air conditioning
   - Swimming pool
   - Garden
   - Garage
   - Fireplace
   - Security system
   - Elevator
   - Furnished
8. Images (array of media uploads with alt text and caption)
9. Documents (array of file uploads for floor plans, certificates, etc.)
10. Status (select: available, under contract, sold, off market)
11. Featured (checkbox to highlight on homepage)
12. Agent (relationship to Users collection, required)
13. Related properties (relationship to self, multiple)

Access control:
- Public read access
- Agent can create and edit their own listings
- Admin can manage all listings

Hooks:
- Before change: Format slug from title
- After change: Notify agent of status changes

Versioning: Enabled
Timestamps: Enabled
```

### Уровень детализации в промптах

MCP‑сервер понимает промпты разной детализации:

#### Минимальная детализация (AI дополняет детали)
```
Generate a collection for blog posts.
```

#### Средняя детализация (конкретные требования)
```
Generate a collection for blog posts with title, content, featured image, categories, and author fields. Make title and content required.
```

#### Максимальная детализация (полные спецификации)
```
Generate a collection for blog posts with:
- Slug: posts
- Fields:
  - Title (text, required)
  - Content (rich text with custom formatting options)
  - Featured image (upload with alt text)
  - Categories (relationship to categories collection, multiple)
  - Author (relationship to users collection)
  - Status (select: draft, published, archived)
  - Published date (date)
  - SEO (group with title, description, and keywords)
- Admin configuration:
  - Use title as display field
  - Group under "Content"
  - Default columns: title, author, status, publishedDate
- Access control for different user roles
- Hooks for slug generation and notification
- Enable versioning and timestamps
```

### Советы по эффективным промптам

1. **Будьте конкретны в требованиях**: чем больше деталей, тем точнее результат.
2. **Указывайте связи**: описывайте, как коллекции связаны между собой.
3. **Добавляйте требования к валидации**: указывайте ограничения для полей.
4. **Опишите предпочтения для админ‑UI**: как коллекция должна выглядеть в панели.
5. **Упоминайте хуки и access control**: если нужна бизнес‑логика или безопасность.
6. **Используйте терминологию домена**: описывайте проект понятиями вашей отрасли.

<hr>

## 📄 Лицензия

Проект распространяется по лицензии MIT — см. файл LICENSE.

<hr>

## 🌍 О MATMAX WORLDWIDE

<div align="center">
  <h3>MATMAX WORLDWIDE</h3>
  <p>Создаём технологии, которые помогают людям быть более человечными.</p>
</div>

Мы верим в технологии во благо — инструменты, которые улучшают нашу жизнь, уважая нашу человечность.

Присоединяйтесь к созданию будущего, где технологии служат благополучию, связи и цели. Вместе мы можем создавать цифровые опыт и продукты, которые помогают людям раскрывать лучшее в себе.

Посетите [matmax.world](https://matmax.world), чтобы узнать больше о нашем видении человекоцентричных технологий.

<hr>

## 🖥️ Локальный запуск

Вы можете запустить MCP‑сервер Payload CMS локально через npm:

[![npm version](https://img.shields.io/npm/v/payload-cms-mcp.svg?style=flat-square)](https://www.npmjs.org/package/payload-cms-mcp)
[![npm downloads](https://img.shields.io/npm/dm/payload-cms-mcp.svg?style=flat-square)](https://npmjs.org/package/payload-cms-mcp)

### Вариант 1: Установка из npm

```bash
# Установить глобально
npm install -g payload-cms-mcp

# Запустить сервер
payload-cms-mcp
```

Примечание: `payload-cms-mcp` раздаёт статический UI из `public/`. MCP‑эндпоинты находятся в `/api/server.ts` (serverless). Для локального тестирования MCP запускайте в serverless/dev окружении (например, Vercel dev) или подключите handler в свой HTTP‑сервер, чтобы открыть `/sse` и `/message`.

### Вариант 2: Клонировать репозиторий

1. Клонируйте репозиторий:
```bash
git clone https://github.com/Matmax-Worldwide/payloadcmsmcp.git
cd payloadcmsmcp
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите локально:
```bash
npm run dev
```

Или:
```bash
npm run local
```

Ваш MCP‑сервер будет работать локально и доступен для разработки и тестов без Railway API token.

## 🚀 Варианты деплоя

### Деплой на Railway (рекомендуется)

Самый простой способ — one‑click deploy на Railway:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

После нажатия кнопки:
1. Выберите "Deploy from GitHub repo"
2. Найдите "Matmax-Worldwide/payloadcmsmcp"
3. Нажмите "Deploy Now"

#### Быстрая настройка Cursor IDE

После деплоя:
1. Установите Railway CLI: `npm install -g @railway/cli`
2. Логин в Railway: `railway login`
3. Свяжите проект: `railway link`
4. В Cursor Settings > MCP Servers задайте Command: `railway run`
