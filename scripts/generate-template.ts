#!/usr/bin/env npx tsx
/**
 * BoringDB Template Generator
 *
 * Generates template .ts files from PostgreSQL DDL for src/templates-data/templates/
 *
 * Usage:
 *   npx tsx scripts/generate-template.ts \
 *     --name "SaaS Starter" \
 *     --slug "saas-starter" \
 *     --file schemas/saas.sql \
 *     --db postgresql \
 *     --tags "Postgres,SaaS" \
 *     --featured \
 *     --description "Multi-tenant SaaS schema with orgs, teams, and billing"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CLI Arg Parsing ---

function parseArgs(): {
    name: string;
    slug: string;
    file: string;
    db: string;
    tags: string[];
    featured: boolean;
    description: string;
    shortDescription: string;
} {
    const args = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const idx = args.indexOf(flag);
        return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
    };

    const name = get('--name');
    const slug = get('--slug');
    const file = get('--file');
    const db = get('--db') || 'postgresql';
    const tags = (get('--tags') || '').split(',').filter(Boolean);
    const featured = args.includes('--featured');
    const description = get('--description') || '';
    const shortDescription =
        get('--short-description') || description.slice(0, 60);

    if (!name || !slug || !file) {
        console.error(
            'Usage: npx tsx scripts/generate-template.ts --name "Name" --slug "slug" --file path/to/schema.sql [--db postgresql] [--tags "tag1,tag2"] [--featured] [--description "..."]'
        );
        process.exit(1);
    }

    return {
        name,
        slug,
        file,
        db,
        tags,
        featured,
        description,
        shortDescription,
    };
}

// --- ID Generation ---

function generateId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 25; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

// --- SQL Parsing ---

interface ParsedColumn {
    name: string;
    type: string;
    typeId: string;
    typeName: string;
    primaryKey: boolean;
    unique: boolean;
    nullable: boolean;
    increment: boolean;
    defaultValue?: string;
    characterMaximumLength?: string;
    precision?: number;
    scale?: number;
}

interface ParsedFK {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    constraintName?: string;
}

interface ParsedIndex {
    name: string;
    tableName: string;
    columns: string[];
    unique: boolean;
}

interface ParsedTable {
    name: string;
    columns: ParsedColumn[];
    primaryKeys: string[]; // Composite PK columns
    inlineIndexes: ParsedIndex[];
}

function parseSQL(sql: string): {
    tables: ParsedTable[];
    foreignKeys: ParsedFK[];
    indexes: ParsedIndex[];
} {
    const tables: ParsedTable[] = [];
    const foreignKeys: ParsedFK[] = [];
    const indexes: ParsedIndex[] = [];

    // Remove comments
    const clean = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Split into statements
    const statements = clean
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    for (const stmt of statements) {
        // CREATE TABLE
        const tableMatch = stmt.match(
            /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([\s\S]*)\)/i
        );
        if (tableMatch) {
            const tableName = tableMatch[2];
            const body = tableMatch[3];
            const parsed = parseTableBody(body, tableName);
            tables.push(parsed.table);
            foreignKeys.push(...parsed.foreignKeys);
            continue;
        }

        // CREATE INDEX
        const indexMatch = stmt.match(
            /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+ON\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*(?:USING\s+\w+\s*)?\(([^)]+)\)/i
        );
        if (indexMatch) {
            const unique = !!indexMatch[1];
            const indexName = indexMatch[2];
            const tableName = indexMatch[4];
            const cols = indexMatch[5]
                .split(',')
                .map((c) => c.trim().replace(/"/g, '').split(/\s/)[0]);
            indexes.push({ name: indexName, tableName, columns: cols, unique });
            continue;
        }

        // ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY
        const fkMatch = stmt.match(
            /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s+ADD\s+CONSTRAINT\s+"?(\w+)"?\s+FOREIGN\s+KEY\s*\("?(\w+)"?\)\s*REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\("?(\w+)"?\)/i
        );
        if (fkMatch) {
            foreignKeys.push({
                sourceTable: fkMatch[2],
                sourceColumn: fkMatch[4],
                targetTable: fkMatch[6],
                targetColumn: fkMatch[7],
                constraintName: fkMatch[3],
            });
        }
    }

    return { tables, foreignKeys, indexes };
}

function parseTableBody(
    body: string,
    tableName: string
): { table: ParsedTable; foreignKeys: ParsedFK[] } {
    const columns: ParsedColumn[] = [];
    const foreignKeys: ParsedFK[] = [];
    const compositeKeys: string[] = [];
    const inlineIndexes: ParsedIndex[] = [];

    // Split body by commas, but respect parentheses
    const parts = splitByTopLevelComma(body);

    for (const part of parts) {
        const trimmed = part.trim();

        // Skip empty
        if (!trimmed) continue;

        // PRIMARY KEY constraint
        const pkMatch = trimmed.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
            const cols = pkMatch[1]
                .split(',')
                .map((c) => c.trim().replace(/"/g, ''));
            compositeKeys.push(...cols);
            continue;
        }

        // FOREIGN KEY constraint
        const fkMatch = trimmed.match(
            /^(?:CONSTRAINT\s+"?\w+"?\s+)?FOREIGN\s+KEY\s*\("?(\w+)"?\)\s*REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\("?(\w+)"?\)/i
        );
        if (fkMatch) {
            foreignKeys.push({
                sourceTable: tableName,
                sourceColumn: fkMatch[1],
                targetTable: fkMatch[3],
                targetColumn: fkMatch[4],
            });
            continue;
        }

        // UNIQUE constraint
        const uniqueMatch = trimmed.match(
            /^(?:CONSTRAINT\s+"?\w+"?\s+)?UNIQUE\s*\(([^)]+)\)/i
        );
        if (uniqueMatch) {
            const cols = uniqueMatch[1]
                .split(',')
                .map((c) => c.trim().replace(/"/g, ''));
            if (cols.length > 1) {
                inlineIndexes.push({
                    name: `${tableName}_${cols.join('_')}_unique`,
                    tableName,
                    columns: cols,
                    unique: true,
                });
            }
            continue;
        }

        // CHECK constraint — skip
        if (/^(?:CONSTRAINT\s+"?\w+"?\s+)?CHECK\s/i.test(trimmed)) continue;

        // Column definition
        const col = parseColumnDef(trimmed);
        if (col) {
            columns.push(col);
            // Check for inline REFERENCES
            const refMatch = trimmed.match(
                /REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\("?(\w+)"?\)/i
            );
            if (refMatch) {
                foreignKeys.push({
                    sourceTable: tableName,
                    sourceColumn: col.name,
                    targetTable: refMatch[2],
                    targetColumn: refMatch[3],
                });
            }
        }
    }

    // Apply composite PKs
    for (const pkCol of compositeKeys) {
        const col = columns.find((c) => c.name === pkCol);
        if (col) col.primaryKey = true;
    }

    return {
        table: {
            name: tableName,
            columns,
            primaryKeys: compositeKeys,
            inlineIndexes,
        },
        foreignKeys,
    };
}

function splitByTopLevelComma(s: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of s) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current);
    return parts;
}

function parseColumnDef(def: string): ParsedColumn | null {
    // Match: "column_name" TYPE(args) constraints...
    const match = def.match(
        /^"?(\w+)"?\s+(\w+(?:\s+\w+)*?)(?:\(([^)]*)\))?\s*(.*)?$/i
    );
    if (!match) return null;

    const name = match[1];
    const rawType = match[2].toLowerCase();
    const typeArgs = match[3];
    const constraints = (match[4] || '').toUpperCase();

    // Normalize type
    const typeInfo = normalizeType(rawType, typeArgs);

    const primaryKey = constraints.includes('PRIMARY KEY');
    const unique = constraints.includes('UNIQUE') || primaryKey;
    const nullable = !constraints.includes('NOT NULL') && !primaryKey;
    const increment =
        rawType === 'serial' ||
        rawType === 'bigserial' ||
        rawType === 'smallserial';

    // Parse DEFAULT
    let defaultValue: string | undefined;
    const defaultMatch = (match[4] || '').match(
        /DEFAULT\s+(.+?)(?:\s+(?:NOT\s+NULL|NULL|UNIQUE|PRIMARY|CHECK|REFERENCES|CONSTRAINT)|\s*$)/i
    );
    if (defaultMatch) {
        defaultValue = defaultMatch[1].trim();
    }

    // Parse REFERENCES (inline FK)
    // We handle these at the ALTER TABLE level, skip here

    return {
        name,
        type: rawType,
        typeId: typeInfo.id,
        typeName: typeInfo.name,
        primaryKey,
        unique,
        nullable,
        increment,
        defaultValue,
        characterMaximumLength: typeInfo.length,
        precision: typeInfo.precision,
        scale: typeInfo.scale,
    };
}

interface TypeInfo {
    id: string;
    name: string;
    length?: string;
    precision?: number;
    scale?: number;
}

function normalizeType(rawType: string, args?: string): TypeInfo {
    const type = rawType.replace(/\s+/g, '_');

    // Map common types to BoringDB type IDs
    const typeMap: Record<string, { id: string; name: string }> = {
        int: { id: 'integer', name: 'integer' },
        integer: { id: 'integer', name: 'integer' },
        bigint: { id: 'bigint', name: 'bigint' },
        smallint: { id: 'smallint', name: 'smallint' },
        serial: { id: 'serial', name: 'serial' },
        bigserial: { id: 'bigserial', name: 'bigserial' },
        smallserial: { id: 'smallserial', name: 'smallserial' },
        varchar: { id: 'varchar', name: 'varchar' },
        character_varying: { id: 'varchar', name: 'varchar' },
        char: { id: 'char', name: 'char' },
        character: { id: 'char', name: 'char' },
        text: { id: 'text', name: 'text' },
        boolean: { id: 'boolean', name: 'boolean' },
        bool: { id: 'boolean', name: 'boolean' },
        timestamp: { id: 'timestamp', name: 'timestamp' },
        timestamp_without_time_zone: { id: 'timestamp', name: 'timestamp' },
        timestamptz: { id: 'timestamptz', name: 'timestamptz' },
        timestamp_with_time_zone: { id: 'timestamptz', name: 'timestamptz' },
        date: { id: 'date', name: 'date' },
        time: { id: 'time', name: 'time' },
        interval: { id: 'interval', name: 'interval' },
        uuid: { id: 'uuid', name: 'uuid' },
        json: { id: 'json', name: 'json' },
        jsonb: { id: 'jsonb', name: 'jsonb' },
        numeric: { id: 'numeric', name: 'numeric' },
        decimal: { id: 'numeric', name: 'numeric' },
        real: { id: 'real', name: 'real' },
        float: { id: 'real', name: 'real' },
        float4: { id: 'real', name: 'real' },
        double_precision: { id: 'double_precision', name: 'double precision' },
        float8: { id: 'double_precision', name: 'double precision' },
        inet: { id: 'inet', name: 'inet' },
        cidr: { id: 'cidr', name: 'cidr' },
        macaddr: { id: 'macaddr', name: 'macaddr' },
        bytea: { id: 'bytea', name: 'bytea' },
    };

    const mapped = typeMap[type] || { id: type, name: type };
    const info: TypeInfo = { ...mapped };

    if (args) {
        const parts = args.split(',').map((a) => a.trim());
        if (
            (type === 'varchar' ||
                type === 'character_varying' ||
                type === 'char' ||
                type === 'character') &&
            parts[0]
        ) {
            info.length = parts[0];
        } else if ((type === 'numeric' || type === 'decimal') && parts[0]) {
            info.precision = parseInt(parts[0], 10);
            if (parts[1]) info.scale = parseInt(parts[1], 10);
        }
    }

    return info;
}

// --- Template Generation ---

const TABLE_COLORS = [
    '#ff6b8a',
    '#8eb7ff',
    '#4dee8a',
    '#ff9f74',
    '#b067e9',
    '#7175fa',
    '#c05dcf',
    '#9ef07a',
    '#ffcc5c',
    '#5ce1e6',
    '#ff6363',
    '#a78bfa',
    '#34d399',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#8b5cf6',
    '#14b8a6',
];

function generateTemplate(
    config: ReturnType<typeof parseArgs>,
    parsed: ReturnType<typeof parseSQL>
): string {
    const { name, slug, db, tags, featured, description, shortDescription } =
        config;
    const { tables, foreignKeys, indexes: externalIndexes } = parsed;

    // Build lookup maps
    const tableIdMap = new Map<string, string>(); // tableName -> id
    const fieldIdMap = new Map<string, Map<string, string>>(); // tableName -> (colName -> id)

    for (const table of tables) {
        const tableId = generateId();
        tableIdMap.set(table.name, tableId);
        const fields = new Map<string, string>();
        for (const col of table.columns) {
            fields.set(col.name, generateId());
        }
        fieldIdMap.set(table.name, fields);
    }

    // Database type mapping
    const dbTypeMap: Record<string, string> = {
        postgresql: 'DatabaseType.POSTGRESQL',
        mysql: 'DatabaseType.MYSQL',
        sqlite: 'DatabaseType.SQLITE',
        mariadb: 'DatabaseType.MARIADB',
        mssql: 'DatabaseType.SQL_SERVER',
    };
    const databaseType = dbTypeMap[db] || 'DatabaseType.POSTGRESQL';

    // Schema name
    const schemaName =
        db === 'mysql' ? `t_${slug.replace(/-/g, '_')}_db` : 'public';

    // Camel case for export name
    const exportName = slug.replace(/-(\w)/g, (_, c) => c.toUpperCase()) + 'Db';

    // Position tables in a grid
    const COLS = 4;
    const GAP_X = 400;
    const GAP_Y = 500;
    const START_X = 100;
    const START_Y = 100;

    const lines: string[] = [];

    // File header
    lines.push(`import { DatabaseType } from '@/lib/domain/database-type';`);
    lines.push(`import type { Template } from '../templates-data';`);
    lines.push(`import image from '@/assets/templates/${slug}.png';`);
    lines.push(`import imageDark from '@/assets/templates/${slug}-dark.png';`);
    lines.push('');
    lines.push('const now = Date.now();');
    lines.push('');
    lines.push(`export const ${exportName}: Template = {`);
    lines.push(`    slug: '${slug}',`);
    lines.push(`    name: '${name}',`);
    lines.push(
        `    shortDescription: '${shortDescription.replace(/'/g, "\\'")}',`
    );
    lines.push(`    description:`);
    lines.push(`        '${description.replace(/'/g, "\\'")}',`);
    lines.push('    image,');
    lines.push('    imageDark,');
    lines.push(`    tags: [${tags.map((t) => `'${t}'`).join(', ')}],`);
    lines.push(`    featured: ${featured},`);
    lines.push('    diagram: {');
    lines.push(`        id: '${slug.replace(/-/g, '_')}_db',`);
    lines.push(`        name: '${slug}',`);
    lines.push('        createdAt: new Date(),');
    lines.push('        updatedAt: new Date(),');
    lines.push(`        databaseType: ${databaseType},`);
    lines.push('        tables: [');

    // Generate tables
    tables.forEach((table, tableIdx) => {
        const tableId = tableIdMap.get(table.name)!;
        const fields = fieldIdMap.get(table.name)!;
        const color = TABLE_COLORS[tableIdx % TABLE_COLORS.length];
        const col = tableIdx % COLS;
        const row = Math.floor(tableIdx / COLS);
        const x = START_X + col * GAP_X;
        const y = START_Y + row * GAP_Y;

        lines.push('            {');
        lines.push(`                id: '${tableId}',`);
        lines.push(`                name: '${table.name}',`);
        lines.push(`                schema: '${schemaName}',`);
        lines.push(`                x: ${x},`);
        lines.push(`                y: ${y},`);
        lines.push('                fields: [');

        for (const col of table.columns) {
            const fieldId = fields.get(col.name)!;
            lines.push('                    {');
            lines.push(`                        id: '${fieldId}',`);
            lines.push(`                        name: '${col.name}',`);
            lines.push(`                        type: {`);
            lines.push(`                            id: '${col.typeId}',`);
            lines.push(`                            name: '${col.typeName}',`);
            lines.push(`                        },`);
            lines.push(
                `                        primaryKey: ${col.primaryKey},`
            );
            lines.push(`                        unique: ${col.unique},`);
            lines.push(`                        nullable: ${col.nullable},`);
            if (col.characterMaximumLength) {
                lines.push(
                    `                        characterMaximumLength: '${col.characterMaximumLength}',`
                );
            }
            if (col.precision) {
                lines.push(
                    `                        precision: ${col.precision},`
                );
            }
            if (col.scale) {
                lines.push(`                        scale: ${col.scale},`);
            }
            if (col.defaultValue) {
                lines.push(
                    `                        default: '${col.defaultValue.replace(/'/g, "\\'")}',`
                );
            }
            lines.push('                        createdAt: now,');
            lines.push('                    },');
        }

        lines.push('                ],');

        // Indexes for this table
        const tableIndexes = [
            ...table.inlineIndexes,
            ...externalIndexes.filter((idx) => idx.tableName === table.name),
        ];

        // Add PK index
        const pkFields = table.columns.filter((c) => c.primaryKey);
        if (pkFields.length > 0) {
            const pkIndex = {
                id: generateId(),
                name: `${table.name}_pkey`,
                unique: true,
                fieldIds: pkFields.map((f) => fields.get(f.name)!),
            };
            lines.push('                indexes: [');
            lines.push('                    {');
            lines.push(`                        id: '${pkIndex.id}',`);
            lines.push(`                        name: '${pkIndex.name}',`);
            lines.push(`                        unique: true,`);
            lines.push(
                `                        fieldIds: [${pkIndex.fieldIds.map((id) => `'${id}'`).join(', ')}],`
            );
            lines.push('                        createdAt: now,');
            lines.push('                    },');
        } else {
            lines.push('                indexes: [');
        }

        // Other indexes
        for (const idx of tableIndexes) {
            const idxFieldIds = idx.columns
                .map((c) => fields.get(c))
                .filter(Boolean) as string[];
            if (idxFieldIds.length === 0) continue;

            lines.push('                    {');
            lines.push(`                        id: '${generateId()}',`);
            lines.push(`                        name: '${idx.name}',`);
            lines.push(`                        unique: ${idx.unique},`);
            lines.push(
                `                        fieldIds: [${idxFieldIds.map((id) => `'${id}'`).join(', ')}],`
            );
            lines.push('                        createdAt: now,');
            lines.push('                    },');
        }

        lines.push('                ],');
        lines.push(`                color: '${color}',`);
        lines.push('                isView: false,');
        lines.push('                isMaterializedView: false,');
        lines.push('                createdAt: now,');
        lines.push('            },');
    });

    lines.push('        ],');

    // Relationships from foreign keys
    lines.push('        relationships: [');
    for (const fk of foreignKeys) {
        const sourceTableId = tableIdMap.get(fk.sourceTable);
        const targetTableId = tableIdMap.get(fk.targetTable);
        const sourceFields = fieldIdMap.get(fk.sourceTable);
        const targetFields = fieldIdMap.get(fk.targetTable);

        if (!sourceTableId || !targetTableId || !sourceFields || !targetFields)
            continue;

        const sourceFieldId = sourceFields.get(fk.sourceColumn);
        const targetFieldId = targetFields.get(fk.targetColumn);
        if (!sourceFieldId || !targetFieldId) continue;

        const relName =
            fk.constraintName || `${fk.sourceTable}_${fk.sourceColumn}_fkey`;

        lines.push('            {');
        lines.push(`                id: '${generateId()}',`);
        lines.push(`                name: '${relName}',`);
        lines.push(`                sourceSchema: '${schemaName}',`);
        lines.push(`                targetSchema: '${schemaName}',`);
        lines.push(`                sourceTableId: '${sourceTableId}',`);
        lines.push(`                targetTableId: '${targetTableId}',`);
        lines.push(`                sourceFieldId: '${sourceFieldId}',`);
        lines.push(`                targetFieldId: '${targetFieldId}',`);
        lines.push(`                sourceCardinality: 'many',`);
        lines.push(`                targetCardinality: 'one',`);
        lines.push('                createdAt: now,');
        lines.push('            },');
    }
    lines.push('        ],');
    lines.push('        dependencies: [],');
    lines.push('    },');
    lines.push('};');
    lines.push('');

    return lines.join('\n');
}

// --- Placeholder Image Generation ---

function createPlaceholderPNG(slug: string, assetsDir: string): void {
    // Minimal 1x1 transparent PNG (68 bytes)
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = createPNGChunk(
        'IHDR',
        Buffer.from([
            0,
            0,
            0,
            1, // width
            0,
            0,
            0,
            1, // height
            8, // bit depth
            6, // color type (RGBA)
            0,
            0,
            0, // compression, filter, interlace
        ])
    );
    const idat = createPNGChunk(
        'IDAT',
        Buffer.from([
            0x78, 0x01, 0x62, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x05,
            0x00, 0x01,
        ])
    );
    const iend = createPNGChunk('IEND', Buffer.alloc(0));

    const png = Buffer.concat([pngSignature, ihdr, idat, iend]);

    writeFileSync(resolve(assetsDir, `${slug}.png`), png);
    writeFileSync(resolve(assetsDir, `${slug}-dark.png`), png);
    console.log(`  Created placeholder images: ${slug}.png, ${slug}-dark.png`);
}

function createPNGChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// --- Main ---

const config = parseArgs();
const sqlPath = resolve(process.cwd(), config.file);

if (!existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf-8');
const parsed = parseSQL(sql);

console.log(
    `Parsed ${parsed.tables.length} tables, ${parsed.foreignKeys.length} foreign keys, ${parsed.indexes.length} external indexes`
);

const template = generateTemplate(config, parsed);

const outDir = resolve(__dirname, '../src/templates-data/templates');
const outFile = resolve(outDir, `${config.slug}-db.ts`);
writeFileSync(outFile, template);
console.log(`Generated: ${outFile}`);

// Create placeholder images
const assetsDir = resolve(__dirname, '../src/assets/templates');
createPlaceholderPNG(config.slug, assetsDir);

console.log('Done! Next steps:');
console.log(`  1. Import in src/templates-data/templates-data.ts`);
console.log(`  2. Add to templates[] array`);
