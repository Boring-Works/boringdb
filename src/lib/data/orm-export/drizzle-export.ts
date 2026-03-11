import type { Diagram } from '@/lib/domain/diagram';
import { DatabaseType } from '@/lib/domain/database-type';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBField } from '@/lib/domain/db-field';
import type { DBRelationship } from '@/lib/domain/db-relationship';
// --- Helpers ---

const JS_RESERVED = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'undefined',
    'var',
    'void',
    'while',
    'with',
    'yield',
]);

function toJsIdentifier(name: string): string {
    // Replace non-alphanumeric chars (hyphens, dots, spaces, etc.) with underscores, then camelCase
    let id = name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    // Remove any remaining underscores at start (from leading special chars)
    id = id.replace(/^_+/, '');
    // Prefix with underscore if starts with digit or is empty
    if (!id || /^\d/.test(id)) {
        id = '_' + id;
    }
    // Suffix with Table if JS reserved word
    if (JS_RESERVED.has(id)) {
        id = id + 'Table';
    }
    return id;
}

function escapeString(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// --- Type Mapping ---

interface ColumnMapping {
    constructor: string;
    options?: string;
}

function mapPostgresType(field: DBField): ColumnMapping {
    const typeId = field.type.id.toLowerCase();
    const name = field.name;

    switch (typeId) {
        case 'int':
        case 'integer':
        case 'int4':
            return { constructor: `integer('${name}')` };
        case 'bigint':
        case 'int8':
            return {
                constructor: `bigint('${name}', { mode: 'bigint' })`,
            };
        case 'smallint':
        case 'int2':
            return { constructor: `smallint('${name}')` };
        case 'serial':
            return { constructor: `serial('${name}')` };
        case 'bigserial':
            return { constructor: `bigserial('${name}')` };
        case 'smallserial':
            return { constructor: `smallserial('${name}')` };
        case 'varchar':
        case 'character_varying':
        case 'character varying': {
            const len = field.characterMaximumLength;
            const opts = len ? `, { length: ${len} }` : '';
            return { constructor: `varchar('${name}'${opts})` };
        }
        case 'char':
        case 'character': {
            const len = field.characterMaximumLength;
            const opts = len ? `, { length: ${len} }` : '';
            return { constructor: `char('${name}'${opts})` };
        }
        case 'text':
            return { constructor: `text('${name}')` };
        case 'boolean':
        case 'bool':
            return { constructor: `boolean('${name}')` };
        case 'timestamp':
        case 'timestamp_without_time_zone':
        case 'timestamp without time zone':
            return { constructor: `timestamp('${name}')` };
        case 'timestamptz':
        case 'timestamp_with_time_zone':
        case 'timestamp with time zone':
            return {
                constructor: `timestamp('${name}', { withTimezone: true })`,
            };
        case 'date':
            return { constructor: `date('${name}')` };
        case 'time':
        case 'time_without_time_zone':
        case 'time without time zone':
            return { constructor: `time('${name}')` };
        case 'timetz':
        case 'time_with_time_zone':
        case 'time with time zone':
            return {
                constructor: `time('${name}', { withTimezone: true })`,
            };
        case 'interval':
            return { constructor: `interval('${name}')` };
        case 'uuid':
            return { constructor: `uuid('${name}')` };
        case 'json':
            return { constructor: `json('${name}')` };
        case 'jsonb':
            return { constructor: `jsonb('${name}')` };
        case 'numeric':
        case 'decimal': {
            const opts = buildPrecisionScale(field);
            return { constructor: `numeric('${name}'${opts})` };
        }
        case 'real':
        case 'float4':
            return { constructor: `real('${name}')` };
        case 'double_precision':
        case 'double precision':
        case 'float8':
            return { constructor: `doublePrecision('${name}')` };
        case 'inet':
            return { constructor: `inet('${name}')` };
        case 'cidr':
            return { constructor: `cidr('${name}')` };
        case 'macaddr':
            return { constructor: `macaddr('${name}')` };
        case 'bytea':
            return { constructor: `text('${name}')` }; // No direct Drizzle type
        case 'user-defined':
            return { constructor: `jsonb('${name}')` };
        default:
            return { constructor: `text('${name}')` }; // Fallback
    }
}

function mapMysqlType(field: DBField): ColumnMapping {
    const typeId = field.type.id.toLowerCase();
    const name = field.name;

    switch (typeId) {
        case 'int':
        case 'integer':
            return { constructor: `int('${name}')` };
        case 'bigint':
            return {
                constructor: `bigint('${name}', { mode: 'bigint' })`,
            };
        case 'smallint':
            return { constructor: `smallint('${name}')` };
        case 'mediumint':
            return { constructor: `mediumint('${name}')` };
        case 'tinyint':
            return { constructor: `tinyint('${name}')` };
        case 'varchar':
        case 'character_varying':
        case 'character varying': {
            const len = field.characterMaximumLength || '255';
            return { constructor: `varchar('${name}', { length: ${len} })` };
        }
        case 'char':
        case 'character': {
            const len = field.characterMaximumLength || '1';
            return { constructor: `char('${name}', { length: ${len} })` };
        }
        case 'text':
            return { constructor: `text('${name}')` };
        case 'tinytext':
            return { constructor: `tinytext('${name}')` };
        case 'mediumtext':
            return { constructor: `mediumtext('${name}')` };
        case 'longtext':
            return { constructor: `longtext('${name}')` };
        case 'boolean':
        case 'bool':
            return { constructor: `boolean('${name}')` };
        case 'timestamp':
            return { constructor: `timestamp('${name}')` };
        case 'datetime':
            return { constructor: `datetime('${name}')` };
        case 'date':
            return { constructor: `date('${name}')` };
        case 'time':
            return { constructor: `time('${name}')` };
        case 'year':
            return { constructor: `year('${name}')` };
        case 'json':
        case 'jsonb':
            return { constructor: `json('${name}')` };
        case 'decimal':
        case 'numeric': {
            const opts = buildPrecisionScale(field);
            return { constructor: `decimal('${name}'${opts})` };
        }
        case 'float':
            return { constructor: `float('${name}')` };
        case 'double':
        case 'double_precision':
            return { constructor: `double('${name}')` };
        case 'binary': {
            const len = field.characterMaximumLength || '1';
            return { constructor: `binary('${name}', { length: ${len} })` };
        }
        case 'varbinary': {
            const len = field.characterMaximumLength || '255';
            return {
                constructor: `varbinary('${name}', { length: ${len} })`,
            };
        }
        case 'blob':
            return { constructor: `text('${name}')` }; // Drizzle blob is custom
        case 'uuid':
            return { constructor: `char('${name}', { length: 36 })` };
        case 'serial':
            return { constructor: `serial('${name}')` };
        default:
            return { constructor: `text('${name}')` };
    }
}

function mapSqliteType(field: DBField): ColumnMapping {
    const typeId = field.type.id.toLowerCase();
    const name = field.name;

    switch (typeId) {
        case 'integer':
        case 'int':
        case 'bigint':
        case 'smallint':
        case 'mediumint':
        case 'tinyint':
            return { constructor: `integer('${name}')` };
        case 'text':
        case 'varchar':
        case 'char':
        case 'character_varying':
        case 'character varying':
        case 'character':
        case 'tinytext':
        case 'mediumtext':
        case 'longtext':
            return { constructor: `text('${name}')` };
        case 'real':
        case 'float':
        case 'double':
        case 'double_precision':
            return { constructor: `real('${name}')` };
        case 'numeric':
        case 'decimal':
            return { constructor: `numeric('${name}')` };
        case 'blob':
        case 'binary':
        case 'varbinary':
        case 'bytea':
            return { constructor: `blob('${name}')` };
        case 'boolean':
        case 'bool':
            return {
                constructor: `integer('${name}', { mode: 'boolean' })`,
            };
        case 'timestamp':
        case 'datetime':
        case 'timestamptz':
        case 'timestamp_without_time_zone':
        case 'timestamp_with_time_zone':
            return {
                constructor: `integer('${name}', { mode: 'timestamp' })`,
            };
        case 'date':
        case 'time':
            return { constructor: `text('${name}')` };
        case 'json':
        case 'jsonb':
            return { constructor: `text('${name}', { mode: 'json' })` };
        case 'uuid':
            return { constructor: `text('${name}')` };
        default:
            return { constructor: `text('${name}')` };
    }
}

function buildPrecisionScale(field: DBField): string {
    if (field.precision != null && field.scale != null) {
        return `, { precision: ${field.precision}, scale: ${field.scale} }`;
    }
    if (field.precision != null) {
        return `, { precision: ${field.precision} }`;
    }
    return '';
}

// --- Modifier Chaining ---

function buildModifiers(
    field: DBField,
    dbType: DatabaseType,
    relationships: DBRelationship[],
    tableMap: Map<string, DBTable>,
    fieldTableId: string
): string {
    let mods = '';
    const typeId = field.type.id.toLowerCase();
    const isSerial =
        typeId === 'serial' ||
        typeId === 'bigserial' ||
        typeId === 'smallserial';

    // Primary key
    if (field.primaryKey) {
        if (dbType === DatabaseType.SQLITE && (field.increment || isSerial)) {
            mods += '.primaryKey({ autoIncrement: true })';
        } else {
            mods += '.primaryKey()';
        }
    }

    // Not null (serial in PG auto-includes notNull)
    if (
        !field.nullable &&
        !field.primaryKey &&
        !(
            isSerial &&
            (dbType === DatabaseType.POSTGRESQL ||
                dbType === DatabaseType.MYSQL ||
                dbType === DatabaseType.MARIADB)
        )
    ) {
        mods += '.notNull()';
    }

    // Unique
    if (field.unique && !field.primaryKey) {
        mods += '.unique()';
    }

    // Auto-increment (MySQL only — PG uses serial type, SQLite uses primaryKey option)
    if (field.increment && !isSerial && dbType === DatabaseType.MYSQL) {
        mods += '.autoincrement()';
    }

    // Default value
    if (field.default) {
        mods += buildDefaultModifier(field.default);
    }

    // Array (PG only)
    if (field.isArray && dbType === DatabaseType.POSTGRESQL) {
        mods += '.array()';
    }

    // Inline references for FK fields
    const rel = relationships.find(
        (r) => r.sourceTableId === fieldTableId && r.sourceFieldId === field.id
    );
    if (rel) {
        const targetTable = tableMap.get(rel.targetTableId);
        const targetField = targetTable?.fields.find(
            (f) => f.id === rel.targetFieldId
        );
        if (targetTable && targetField) {
            const targetVar = toJsIdentifier(targetTable.name);
            mods += `.references(() => ${targetVar}.${toJsIdentifier(targetField.name)})`;
        }
    }

    return mods;
}

function buildDefaultModifier(defaultVal: string): string {
    const trimmed = defaultVal.trim();
    const upper = trimmed.toUpperCase();

    // now() / CURRENT_TIMESTAMP
    if (
        upper === 'NOW()' ||
        upper === 'CURRENT_TIMESTAMP' ||
        upper === 'CURRENT_TIMESTAMP()'
    ) {
        return '.defaultNow()';
    }

    // gen_random_uuid() on uuid columns
    if (upper === 'GEN_RANDOM_UUID()' || upper === 'UUID_GENERATE_V4()') {
        return '.defaultRandom()';
    }

    // Boolean literals
    if (upper === 'TRUE') return '.default(true)';
    if (upper === 'FALSE') return '.default(false)';

    // Numeric literal
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return `.default(${trimmed})`;
    }

    // Already-quoted string
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        const inner = trimmed.slice(1, -1).replace(/''/g, "'");
        return `.default('${escapeString(inner)}')`;
    }

    // Function call or SQL expression
    if (trimmed.includes('(') || upper === 'NULL') {
        return `.default(sql\`${trimmed}\`)`;
    }

    // Plain string
    return `.default('${escapeString(trimmed)}')`;
}

// --- Index Generation ---

function buildIndexes(table: DBTable): string[] {
    const lines: string[] = [];

    for (const idx of table.indexes) {
        // Skip primary key indexes (handled by .primaryKey() modifier)
        if (idx.isPrimaryKey) continue;
        // Skip indexes that only contain PK fields
        const pkFieldIds = new Set(
            table.fields.filter((f) => f.primaryKey).map((f) => f.id)
        );
        if (
            idx.fieldIds.length > 0 &&
            idx.fieldIds.every((id) => pkFieldIds.has(id))
        ) {
            continue;
        }

        const fieldRefs = idx.fieldIds
            .map((fid) => {
                const field = table.fields.find((f) => f.id === fid);
                return field ? `t.${toJsIdentifier(field.name)}` : null;
            })
            .filter(Boolean);

        if (fieldRefs.length === 0) continue;

        const fnName = idx.unique ? 'uniqueIndex' : 'index';
        const idxName = idx.name || `${table.name}_${fieldRefs.join('_')}_idx`;
        lines.push(
            `${fnName}('${escapeString(idxName)}').on(${fieldRefs.join(', ')})`
        );
    }

    return lines;
}

// --- Relations Generation ---

function buildRelations(
    tables: DBTable[],
    relationships: DBRelationship[],
    tableMap: Map<string, DBTable>
): string[] {
    // Group relationships by table
    const relsByTable = new Map<string, DBRelationship[]>();
    for (const rel of relationships) {
        // Source side (the FK holder — many side)
        if (!relsByTable.has(rel.sourceTableId)) {
            relsByTable.set(rel.sourceTableId, []);
        }
        relsByTable.get(rel.sourceTableId)!.push(rel);

        // Target side (the referenced table — one side)
        if (!relsByTable.has(rel.targetTableId)) {
            relsByTable.set(rel.targetTableId, []);
        }
        relsByTable.get(rel.targetTableId)!.push(rel);
    }

    const output: string[] = [];

    for (const table of tables) {
        if (table.isView) continue;
        const rels = relsByTable.get(table.id);
        if (!rels || rels.length === 0) continue;

        const tableVar = toJsIdentifier(table.name);
        const relLines: string[] = [];

        // Deduplicate: only process each relationship once per side
        const seen = new Set<string>();

        // Track property names to disambiguate duplicates (e.g. two FKs to same table)
        const propCount = new Map<string, number>();

        for (const rel of rels) {
            const relKey = `${rel.id}-${table.id}`;
            if (seen.has(relKey)) continue;
            seen.add(relKey);

            const sourceTable = tableMap.get(rel.sourceTableId);
            const targetTable = tableMap.get(rel.targetTableId);
            if (!sourceTable || !targetTable) continue;

            const sourceField = sourceTable.fields.find(
                (f) => f.id === rel.sourceFieldId
            );
            const targetField = targetTable.fields.find(
                (f) => f.id === rel.targetFieldId
            );
            if (!sourceField || !targetField) continue;

            if (table.id === rel.sourceTableId) {
                // This table holds the FK — it has a "one" relation to the target
                const targetVar = toJsIdentifier(targetTable.name);
                let propName = targetVar;
                const count = propCount.get(propName) || 0;
                if (count > 0) {
                    propName = `${propName}_${toJsIdentifier(sourceField.name)}`;
                }
                propCount.set(targetVar, count + 1);
                relLines.push(
                    `  ${propName}: one(${targetVar}, { fields: [${tableVar}.${toJsIdentifier(sourceField.name)}], references: [${targetVar}.${toJsIdentifier(targetField.name)}] })`
                );
            } else {
                // This table is referenced — check cardinality
                const sourceVar = toJsIdentifier(sourceTable.name);
                let propName = sourceVar;
                const count = propCount.get(propName) || 0;
                if (count > 0) {
                    propName = `${propName}_${toJsIdentifier(sourceField.name)}`;
                }
                propCount.set(sourceVar, count + 1);

                if (rel.sourceCardinality === 'one') {
                    // 1:1 — emit one() without fields (reverse side)
                    relLines.push(`  ${propName}: one(${sourceVar})`);
                } else {
                    // 1:many — emit many()
                    relLines.push(`  ${propName}: many(${sourceVar})`);
                }
            }
        }

        if (relLines.length > 0) {
            output.push(
                `export const ${tableVar}Relations = relations(${tableVar}, ({ one, many }) => ({\n${relLines.join(',\n')},\n}));`
            );
        }
    }

    return output;
}

// --- Imports Collector ---

function collectImports(
    tables: DBTable[],
    relationships: DBRelationship[],
    dbType: DatabaseType
): { tableImports: Set<string>; sharedImports: Set<string> } {
    const tableImports = new Set<string>();
    const sharedImports = new Set<string>();

    // Table constructor
    switch (dbType) {
        case DatabaseType.POSTGRESQL:
        case DatabaseType.COCKROACHDB:
            tableImports.add('pgTable');
            break;
        case DatabaseType.MYSQL:
        case DatabaseType.MARIADB:
            tableImports.add('mysqlTable');
            break;
        case DatabaseType.SQLITE:
            tableImports.add('sqliteTable');
            break;
        default:
            tableImports.add('pgTable'); // Default to PG
    }

    let hasIndexes = false;
    let hasUniqueIndexes = false;
    let hasRelations = false;
    let hasSqlDefault = false;

    for (const table of tables) {
        if (table.isView) continue;

        for (const field of table.fields) {
            const typeId = field.type.id.toLowerCase();
            addTypeImport(tableImports, typeId, dbType);

            // Check for array modifier (PG only)
            if (field.isArray && dbType === DatabaseType.POSTGRESQL) {
                // .array() is a method, no import needed
            }

            // Check defaults
            if (field.default) {
                const upper = field.default.trim().toUpperCase();
                if (
                    upper.includes('(') &&
                    upper !== 'NOW()' &&
                    upper !== 'CURRENT_TIMESTAMP' &&
                    upper !== 'CURRENT_TIMESTAMP()' &&
                    upper !== 'GEN_RANDOM_UUID()' &&
                    upper !== 'UUID_GENERATE_V4()'
                ) {
                    hasSqlDefault = true;
                }
                if (upper === 'NULL') {
                    hasSqlDefault = true;
                }
            }
        }

        for (const idx of table.indexes) {
            if (idx.isPrimaryKey) continue;
            const pkFieldIds = new Set(
                table.fields.filter((f) => f.primaryKey).map((f) => f.id)
            );
            if (idx.fieldIds.every((id) => pkFieldIds.has(id))) continue;

            if (idx.unique) {
                hasUniqueIndexes = true;
            } else {
                hasIndexes = true;
            }
        }
    }

    if (relationships.length > 0) {
        hasRelations = true;
    }

    if (hasIndexes) tableImports.add('index');
    if (hasUniqueIndexes) tableImports.add('uniqueIndex');
    if (hasRelations) sharedImports.add('relations');
    if (hasSqlDefault) sharedImports.add('sql');

    return { tableImports, sharedImports };
}

function addTypeImport(
    imports: Set<string>,
    typeId: string,
    dbType: DatabaseType
): void {
    const isPg =
        dbType === DatabaseType.POSTGRESQL ||
        dbType === DatabaseType.COCKROACHDB;
    const isMysql =
        dbType === DatabaseType.MYSQL || dbType === DatabaseType.MARIADB;
    const isSqlite = dbType === DatabaseType.SQLITE;

    if (isPg) {
        const pgMap: Record<string, string> = {
            int: 'integer',
            integer: 'integer',
            int4: 'integer',
            bigint: 'bigint',
            int8: 'bigint',
            smallint: 'smallint',
            int2: 'smallint',
            serial: 'serial',
            bigserial: 'bigserial',
            smallserial: 'smallserial',
            varchar: 'varchar',
            character_varying: 'varchar',
            'character varying': 'varchar',
            char: 'char',
            character: 'char',
            text: 'text',
            boolean: 'boolean',
            bool: 'boolean',
            timestamp: 'timestamp',
            timestamp_without_time_zone: 'timestamp',
            'timestamp without time zone': 'timestamp',
            timestamptz: 'timestamp',
            timestamp_with_time_zone: 'timestamp',
            'timestamp with time zone': 'timestamp',
            date: 'date',
            time: 'time',
            time_without_time_zone: 'time',
            'time without time zone': 'time',
            timetz: 'time',
            time_with_time_zone: 'time',
            'time with time zone': 'time',
            interval: 'interval',
            uuid: 'uuid',
            json: 'json',
            jsonb: 'jsonb',
            numeric: 'numeric',
            decimal: 'numeric',
            real: 'real',
            float4: 'real',
            double_precision: 'doublePrecision',
            'double precision': 'doublePrecision',
            float8: 'doublePrecision',
            inet: 'inet',
            cidr: 'cidr',
            macaddr: 'macaddr',
            bytea: 'text',
            'user-defined': 'jsonb',
        };
        imports.add(pgMap[typeId] || 'text');
    } else if (isMysql) {
        const mysqlMap: Record<string, string> = {
            int: 'int',
            integer: 'int',
            bigint: 'bigint',
            smallint: 'smallint',
            mediumint: 'mediumint',
            tinyint: 'tinyint',
            varchar: 'varchar',
            character_varying: 'varchar',
            char: 'char',
            text: 'text',
            tinytext: 'tinytext',
            mediumtext: 'mediumtext',
            longtext: 'longtext',
            boolean: 'boolean',
            bool: 'boolean',
            timestamp: 'timestamp',
            datetime: 'datetime',
            date: 'date',
            time: 'time',
            year: 'year',
            json: 'json',
            jsonb: 'json',
            decimal: 'decimal',
            numeric: 'decimal',
            float: 'float',
            double: 'double',
            double_precision: 'double',
            binary: 'binary',
            varbinary: 'varbinary',
            serial: 'serial',
            uuid: 'char',
        };
        imports.add(mysqlMap[typeId] || 'text');
    } else if (isSqlite) {
        const sqliteMap: Record<string, string> = {
            integer: 'integer',
            int: 'integer',
            bigint: 'integer',
            smallint: 'integer',
            mediumint: 'integer',
            tinyint: 'integer',
            text: 'text',
            varchar: 'text',
            char: 'text',
            real: 'real',
            float: 'real',
            double: 'real',
            double_precision: 'real',
            numeric: 'numeric',
            decimal: 'numeric',
            blob: 'blob',
            binary: 'blob',
            boolean: 'integer',
            bool: 'integer',
            timestamp: 'integer',
            datetime: 'integer',
            timestamptz: 'integer',
            date: 'text',
            time: 'text',
            json: 'text',
            jsonb: 'text',
            uuid: 'text',
        };
        imports.add(sqliteMap[typeId] || 'text');
    } else {
        // Default to PG
        imports.add('text');
    }
}

function getImportPath(dbType: DatabaseType): string {
    switch (dbType) {
        case DatabaseType.POSTGRESQL:
        case DatabaseType.COCKROACHDB:
            return 'drizzle-orm/pg-core';
        case DatabaseType.MYSQL:
        case DatabaseType.MARIADB:
            return 'drizzle-orm/mysql-core';
        case DatabaseType.SQLITE:
            return 'drizzle-orm/sqlite-core';
        default:
            return 'drizzle-orm/pg-core';
    }
}

function getTableConstructor(dbType: DatabaseType): string {
    switch (dbType) {
        case DatabaseType.POSTGRESQL:
        case DatabaseType.COCKROACHDB:
            return 'pgTable';
        case DatabaseType.MYSQL:
        case DatabaseType.MARIADB:
            return 'mysqlTable';
        case DatabaseType.SQLITE:
            return 'sqliteTable';
        default:
            return 'pgTable';
    }
}

function mapType(field: DBField, dbType: DatabaseType): ColumnMapping {
    switch (dbType) {
        case DatabaseType.POSTGRESQL:
        case DatabaseType.COCKROACHDB:
            return mapPostgresType(field);
        case DatabaseType.MYSQL:
        case DatabaseType.MARIADB:
            return mapMysqlType(field);
        case DatabaseType.SQLITE:
            return mapSqliteType(field);
        default:
            return mapPostgresType(field);
    }
}

// --- Main Export ---

export function exportDrizzle({ diagram }: { diagram: Diagram }): string {
    const dbType = diagram.databaseType;
    const tables = (diagram.tables ?? []).filter((t) => !t.isView);
    const relationships = diagram.relationships ?? [];

    // Build table map
    const tableMap = new Map<string, DBTable>();
    for (const table of tables) {
        tableMap.set(table.id, table);
    }

    // Collect imports
    const { tableImports, sharedImports } = collectImports(
        tables,
        relationships,
        dbType
    );

    const lines: string[] = [];

    // Header comment
    lines.push('// Schema generated by BoringDB (https://db.getboring.io)');
    lines.push('');

    // Import from drizzle-orm/<dialect>-core
    const importPath = getImportPath(dbType);
    const sortedTableImports = [...tableImports].sort();
    lines.push(
        `import { ${sortedTableImports.join(', ')} } from '${importPath}';`
    );

    // Import from drizzle-orm
    if (sharedImports.size > 0) {
        const sortedShared = [...sharedImports].sort();
        lines.push(`import { ${sortedShared.join(', ')} } from 'drizzle-orm';`);
    }

    lines.push('');

    // Generate table definitions
    const tableConstructor = getTableConstructor(dbType);

    for (const table of tables) {
        const varName = toJsIdentifier(table.name);

        // Column definitions
        const colLines: string[] = [];
        for (const field of table.fields) {
            const mapping = mapType(field, dbType);
            const modifiers = buildModifiers(
                field,
                dbType,
                relationships,
                tableMap,
                table.id
            );
            colLines.push(
                `  ${toJsIdentifier(field.name)}: ${mapping.constructor}${modifiers},`
            );
        }

        // Index definitions
        const indexLines = buildIndexes(table);

        let tableDef = `export const ${varName} = ${tableConstructor}('${escapeString(table.name)}', {\n`;
        tableDef += colLines.join('\n');
        tableDef += '\n}';

        if (indexLines.length > 0) {
            tableDef += `, (t) => [\n`;
            tableDef += indexLines.map((l) => `  ${l},`).join('\n');
            tableDef += '\n]';
        }

        tableDef += ');';
        lines.push(tableDef);
        lines.push('');
    }

    // Generate relations
    const relLines = buildRelations(tables, relationships, tableMap);
    if (relLines.length > 0) {
        lines.push('// Relations');
        for (const relLine of relLines) {
            lines.push(relLine);
            lines.push('');
        }
    }

    return lines.join('\n');
}
