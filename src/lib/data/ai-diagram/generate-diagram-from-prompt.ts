import { OPENAI_API_KEY, OPENAI_API_ENDPOINT } from '@/lib/env';
import type { DatabaseType } from '@/lib/domain/database-type';

const databaseTypeHints: Partial<Record<string, string>> = {
    postgresql:
        'Use PostgreSQL types: uuid, serial, bigserial, text, varchar(255), timestamptz, jsonb, boolean, integer, numeric(10,2).',
    mysql: 'Use MySQL types: INT AUTO_INCREMENT, VARCHAR(255), TEXT, DATETIME, DECIMAL(10,2), BOOLEAN, BIGINT, JSON.',
    sqlite: 'Use SQLite types: INTEGER, TEXT, REAL, BLOB. Use INTEGER PRIMARY KEY for autoincrement.',
    sql_server:
        'Use SQL Server types: INT IDENTITY, NVARCHAR(255), DATETIME2, UNIQUEIDENTIFIER, DECIMAL(10,2), BIT, BIGINT.',
    mariadb:
        'Use MariaDB types: INT AUTO_INCREMENT, VARCHAR(255), TEXT, DATETIME, DECIMAL(10,2), BOOLEAN, BIGINT, JSON.',
    cockroachdb:
        'Use CockroachDB types: UUID, INT, STRING, TIMESTAMPTZ, JSONB, BOOL, DECIMAL(10,2).',
};

function buildSystemPrompt(databaseType: DatabaseType): string {
    const typeHint =
        databaseTypeHints[databaseType] ??
        'Use standard SQL types appropriate for the target database.';

    return `You are a database architect. Generate a database schema in DBML (Database Markup Language) format.

CRITICAL DBML syntax rules:
- Output ONLY valid DBML. No markdown, no explanations, no code blocks.
- For default values that are expressions/functions, wrap in backticks: default: \`now()\`, default: \`gen_random_uuid()\`
- For literal defaults use no backticks: default: 0, default: true, default: 'active'
- Always include length for varchar: varchar(255) not varchar()
- Always include precision for numeric: numeric(10,2) not numeric(,)
- Mark primary keys with [pk]
- Enum values must NOT be quoted: use admin not 'admin'

Schema rules:
- ${typeHint}
- Every table must have a primary key field.
- Use inline ref syntax for foreign keys: user_id uuid [ref: > users.id]
- DBML fields are NOT NULL by default. Mark nullable fields with [null].
- Add created_at and updated_at timestamp fields on main entity tables.
- Use Enum blocks for columns with fixed value sets.
- Do NOT use TableGroup blocks.
- Add [note: '...'] on non-obvious columns.
- Create junction tables for many-to-many relationships.
- Add indexes for foreign key columns and frequently queried fields.

Example of correct DBML:
Enum user_role {
  admin
  member
  owner
}

Table users {
  id uuid [pk, default: \`gen_random_uuid()\`]
  name varchar(255)
  email varchar(255) [unique]
  role user_role [default: 'member']
  balance numeric(10,2) [default: 0]
  is_active boolean [default: true]
  metadata jsonb [null, note: 'Flexible user metadata']
  created_at timestamptz [default: \`now()\`]
  updated_at timestamptz [default: \`now()\`]

  indexes {
    email [unique]
  }
}

Table posts {
  id uuid [pk, default: \`gen_random_uuid()\`]
  user_id uuid [ref: > users.id]
  title varchar(255)
  body text
  created_at timestamptz [default: \`now()\`]

  indexes {
    user_id
  }
}`;
}

/**
 * Fix common DBML syntax issues that LLMs produce.
 * Applied before passing to the DBML parser.
 */
function fixDBMLSyntax(dbml: string): string {
    // Fix quoted enum values: 'admin' → admin (inside Enum blocks only)
    let result = dbml.replace(/^(Enum\s+\w+\s*\{[\s\S]*?\})/gm, (enumBlock) =>
        enumBlock.replace(/^\s*'([^']+)'\s*$/gm, '  $1')
    );

    // Normalize uppercase TABLE/REF keywords to DBML lowercase
    result = result.replace(/^TABLE\b/gm, 'Table');
    result = result.replace(/^REF\b/gm, 'Ref');
    result = result.replace(/^ENUM\b/gm, 'Enum');

    // Convert inline ENUM(val1, val2) type to varchar(50)
    // DBML doesn't support inline enum — requires separate Enum block
    result = result.replace(/\bENUM\s*\([^)]+\)/gi, 'varchar(50)');

    // Convert SQL-style bare constraints to DBML bracket syntax
    // Process field lines that have bare NOT NULL, UNIQUE, DEFAULT outside brackets
    result = result.replace(
        /^(\s+\w+\s+\w[\w(),.]*)((?:\s+(?:NOT\s+NULL|UNIQUE|DEFAULT\s+\S+))+)\s*$/gim,
        (_match, fieldDef, constraints) => {
            const attrs: string[] = [];
            if (/\bUNIQUE\b/i.test(constraints)) attrs.push('unique');
            if (/\bNOT\s+NULL\b/i.test(constraints)) attrs.push('not null');
            const defaultMatch = /\bDEFAULT\s+(\S+)/i.exec(constraints);
            if (defaultMatch) {
                const val = defaultMatch[1];
                // SQL expressions get backtick-wrapped in DBML
                if (/^\w+\(/.test(val) || /^CURRENT_/i.test(val)) {
                    attrs.push(`default: \`${val}\``);
                } else {
                    attrs.push(`default: ${val}`);
                }
            }
            return attrs.length > 0
                ? `${fieldDef} [${attrs.join(', ')}]`
                : fieldDef;
        }
    );

    result = result
        // Wrap bare default: outside brackets into [default: ...]
        .replace(
            /(?<!\[[\w\s,:'"`]*)\bdefault:\s*(`[^`]+`|'[^']*'|"[^"]*"|\d[\d.]*|true|false|null|\w+)(?!\s*[\],])/gm,
            '[default: $1]'
        )
        // Wrap bare function calls in defaults with backticks
        .replace(/default:\s*(?!`)(\w+\([^)]*\))/g, 'default: `$1`')
        // Quote bare identifier defaults (e.g. default: subscriber → default: 'subscriber')
        .replace(
            /default:\s+(?!true\b|false\b|null\b|`|'|"|\d)([a-zA-Z_]\w*)(?=[\s,\]))])/g,
            "default: '$1'"
        )
        // Fix empty varchar parens
        .replace(/varchar\(\s*\)/gi, 'varchar(255)')
        // Fix empty numeric parens
        .replace(/numeric\(\s*,?\s*\)/gi, 'numeric(10,2)')
        // Fix decimal empty parens
        .replace(/decimal\(\s*,?\s*\)/gi, 'decimal(10,2)')
        // Remove empty default annotations: [default:] or [default: ]
        .replace(/,?\s*default:\s*(?=[\],])/g, '')
        // Clean up empty brackets that might result
        .replace(/\[\s*,/g, '[')
        .replace(/,\s*\]/g, ']')
        .replace(/\[\s*\]/g, '');

    // Fix bare index/unique lines → proper "indexes { ... }" blocks
    // Handles: index(field), index (field), unique(f1, f2), unique (f1, f2)
    result = result.replace(
        /(?:^\s*(?:index|unique)\s*\([^)]+\)\s*$\n?)+/gim,
        (match) => {
            const entries: string[] = [];
            const re = /(index|unique)\s*\(([^)]+)\)/gi;
            for (const m of match.matchAll(re)) {
                const kind = m[1].toLowerCase();
                const fields = m[2].trim();
                const wrap = fields.includes(',');
                const col = wrap ? `(${fields})` : fields;
                const attr = kind === 'unique' ? ' [unique]' : '';
                entries.push(`    ${col}${attr}`);
            }
            return `\n  indexes {\n${entries.join('\n')}\n  }\n`;
        }
    );

    return result;
}

export async function generateDiagramFromPrompt({
    prompt,
    databaseType,
    onResultStream,
    signal,
}: {
    prompt: string;
    databaseType: DatabaseType;
    onResultStream: (text: string) => void;
    signal?: AbortSignal;
}): Promise<string> {
    const [{ streamText }, { createOpenAI }] = await Promise.all([
        import('ai'),
        import('@ai-sdk/openai'),
    ]);

    const apiKey = window?.env?.OPENAI_API_KEY ?? OPENAI_API_KEY ?? 'proxy';
    const baseUrl =
        window?.env?.OPENAI_API_ENDPOINT ?? OPENAI_API_ENDPOINT ?? '/api/v1';
    const modelName =
        window?.env?.AI_DIAGRAM_MODEL ?? 'qwen2.5-coder-32b-instruct';

    const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl,
    });

    const { textStream } = await streamText({
        model: openai.chat(modelName),
        system: buildSystemPrompt(databaseType),
        prompt: `Design a ${databaseType} database schema for: ${prompt}`,
        temperature: 0.3,
        abortSignal: signal,
    });

    let fullText = '';
    for await (const textPart of textStream) {
        fullText += textPart;
        onResultStream(textPart);
    }

    return fullText;
}

export { fixDBMLSyntax };
