import { OPENAI_API_KEY, OPENAI_API_ENDPOINT } from '@/lib/env';
import type { DatabaseType } from '@/lib/domain/database-type';

const databaseTypeHints: Partial<Record<string, string>> = {
    postgresql:
        'Use PostgreSQL types: uuid, serial, bigserial, text, varchar, timestamptz, jsonb, boolean, integer, numeric.',
    mysql: 'Use MySQL types: INT AUTO_INCREMENT, VARCHAR, TEXT, DATETIME, DECIMAL, BOOLEAN, BIGINT, JSON.',
    sqlite: 'Use SQLite types: INTEGER, TEXT, REAL, BLOB. Use INTEGER PRIMARY KEY for autoincrement.',
    sql_server:
        'Use SQL Server types: INT IDENTITY, NVARCHAR, DATETIME2, UNIQUEIDENTIFIER, DECIMAL, BIT, BIGINT.',
    mariadb:
        'Use MariaDB types: INT AUTO_INCREMENT, VARCHAR, TEXT, DATETIME, DECIMAL, BOOLEAN, BIGINT, JSON.',
    cockroachdb:
        'Use CockroachDB types: UUID DEFAULT gen_random_uuid(), INT, STRING, TIMESTAMPTZ, JSONB, BOOL, DECIMAL.',
};

function buildSystemPrompt(databaseType: DatabaseType): string {
    const typeHint =
        databaseTypeHints[databaseType] ??
        'Use standard SQL types appropriate for the target database.';

    return `You are a database architect. Generate a database schema in DBML (Database Markup Language) format.

Rules:
- Output ONLY valid DBML. No markdown, no explanations, no code blocks.
- ${typeHint}
- Every table must have a primary key field.
- Use inline ref syntax for foreign keys: user_id integer [ref: > users.id]
- Include NOT NULL by marking fields without [null] (DBML fields are NOT NULL by default).
- Mark nullable fields explicitly with [null].
- Add created_at and updated_at timestamp fields on main entity tables.
- Use Enum blocks for columns with fixed value sets.
- Do NOT use TableGroup blocks.
- Add [note: '...'] on non-obvious columns.
- Create junction tables for many-to-many relationships.
- Add indexes for foreign key columns and frequently queried fields.`;
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
}): Promise<void> {
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

    const { textStream } = streamText({
        model: openai.chat(modelName),
        system: buildSystemPrompt(databaseType),
        prompt: `Design a ${databaseType} database schema for: ${prompt}`,
        temperature: 0.3,
        abortSignal: signal,
    });

    for await (const textPart of textStream) {
        onResultStream(textPart);
    }
}
