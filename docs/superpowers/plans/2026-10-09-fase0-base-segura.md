# Fase 0 — Base segura (Integración Guvia ⇄ Kommo) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar Guvia, Supabase y Kommo listos para la sincronización (punto de restauración, entorno de prueba, migración reversible, guardado por filas modificadas, Realtime y estructura en Kommo) **sin cambiar nada visible ni tocar datos existentes**.

**Architecture:**
- **Base de datos:** scripts de Node (`tools/db/`, librería `pg`) para respaldar, generar una huella de los datos (*fingerprint*), clonar a staging y migrar.
- **Migración 001:** solo agrega columnas, tablas y triggers. Trae su script de reversión (`down`), ensayado en staging.
- **Guvia:** sube solo las filas modificadas (`sync-diff.js`, lógica pura con tests) y escucha Supabase Realtime.
- **Kommo:** la estructura se crea a mano en su interfaz (el conector no permite crearla) y se verifica por API.

**Tech Stack:** JS sin framework (navegador), supabase-js@2 (CDN), Node 24 (`node:test`, `process.loadEnvFile`), `pg` 8, PostgreSQL 17 (Supabase), Kommo API v4 (MCP de solo lectura).

**Spec:** `docs/superpowers/specs/2026-10-09-guvia-kommo-integracion-design.md` (secciones 2, 4, 5, 6, 9, 11 Fase 0 y 12).

## Global Constraints

- **Solo agregar:** nunca `DELETE`, `UPDATE` ni `DROP` sobre datos o columnas existentes en producción.
- **Huella intacta:** la huella (filas + hash de las columnas originales) de las 13 tablas base debe ser **idéntica** antes y después de cada cambio en producción.
- **DDL estricto en la migración `up`:** sin `IF NOT EXISTS`. Si un nombre ya existe, la migración falla y hace rollback.
- **Ningún trigger nuevo puede impedir que el usuario guarde:** el trigger del outbox atrapa cualquier error con `exception when others`.
- **Kill switch apagado por defecto:** `integration_settings.kommo_sync_enabled = false`, o sin fila, equivale a apagado.
- **Secretos solo en `.env`** (`GUVIA_DB_URL`, `GUVIA_STAGING_DB_URL`); los scripts nunca imprimen las URLs.
- **Los respaldos (`backups/`) nunca se suben a Git ni a Vercel**, porque contienen datos financieros.
- **Producción:** cada acción requiere confirmación explícita de Dante en el chat (aplicar la migración, hacer push o desplegar).
- **Kommo:** no se modifica nada existente (embudos, etapas, campos ni bots); solo se agrega lo listado en la Tarea 8.

## Review Focus

1. **Una columna o tabla nueva ya existe en producción** → la migración `up` debe fallar sin aplicar nada, y la `down` nunca debe borrar algo que no creó. Lo cubren la Tarea 4 (DDL estricto + `guvia_realtime_added`) y la Tarea 2 (verificación de nombres contra `columns.json`).
2. **Un error dentro del trigger del outbox** → el guardado del usuario igual se completa. Lo cubre la Tarea 4, escenario "trigger roto".
3. **Falla la red al subir** → la fila sigue marcada como modificada y se reintenta en el siguiente guardado. Lo cubre la Tarea 5 (`changedRows` hasta `rememberRows`).
4. **Llega por Realtime un cambio de una fila que el usuario editó y aún no se subió** → gana lo local; el eco de su propio guardado no re-renderiza ni re-sube nada. Lo cubre la Tarea 6 (`remoteAction`).
5. **`null` en la BD vs `""` o número vs texto numérico en local** → no cuentan como cambio, ni para subir ni para el outbox. Lo cubren la Tarea 5 (`sameValue`) y la Tarea 4 (escenario `null → ''`).

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `tools/package.json` | Dependencia `pg` solo para los scripts (separada de la raíz para no afectar Vercel). |
| `tools/db/lib.js` | Conexión (`connect(target)`), lista `BASE_TABLES`, guarda anti-producción. |
| `tools/db/fingerprint-lib.js` | Funciones puras: `quoteIdent`, `buildFingerprintSql`, `compareFingerprints`. |
| `tools/db/fingerprint-lib.test.js` | Tests de lo anterior. |
| `tools/db/backup.js` | Respaldo JSON por tabla + `columns.json` + `meta.json`. |
| `tools/db/fingerprint.js` | Calcula la huella de un entorno o compara dos huellas. |
| `tools/db/clone-to-staging.js` | Recrea las tablas y los datos de un respaldo en staging. |
| `tools/db/staging-set-user.js` | Reasigna `user_id` en staging al usuario de staging. |
| `tools/db/migrate.js` | Ejecuta un `.sql` en transacción (producción solo con `--confirm-prod`). |
| `tools/db/test-migration-001.js` | Prueba de integración de la migración 001 en staging. |
| `supabase/migrations/001_kommo_sync_base.up.sql` / `.down.sql` | Migración y su reversión. |
| `sync-diff.js` | Lógica pura de "qué filas cambiaron" y "qué hacer con un cambio remoto". |
| `tests/sync-diff.test.js` | Tests de `sync-diff.js`. |
| `app.js` | Integra `sync-diff` en `sbSyncTable`/`sbLoad`, Realtime y override de Supabase en localhost. |
| `index.html` | Carga `sync-diff.js` antes de `app.js`. |
| `.gitignore`, `.vercelignore` | Excluir `backups/`, `tools/node_modules/`, herramientas y docs del deploy. |
| `docs/integracion/REVERSION.md` | Procedimiento de reversión paso a paso. |
| `docs/integracion/kommo-ids.json` | IDs de lo creado en Kommo. |

---

### Task 1: Herramientas de base de datos (huella, respaldo, migración)

**Files:**
- Create: `tools/package.json`, `tools/db/lib.js`, `tools/db/fingerprint-lib.js`, `tools/db/fingerprint-lib.test.js`, `tools/db/backup.js`, `tools/db/fingerprint.js`, `tools/db/migrate.js`
- Modify: `.gitignore`
- Create: `.vercelignore`

**Interfaces:**
- Produces:
  - `connect(target: "prod"|"staging") → Promise<pg.Client>`, `BASE_TABLES: string[]`, `assertStagingIsNotProd()`.
  - `buildFingerprintSql(table, cols) → string`, `compareFingerprints(a, b) → string[]` (lista de diferencias; vacía = idénticas).
  - CLI `node tools/db/backup.js <target>` → carpeta `backups/<YYYYMMDD-HHmmss>-<target>/` con `<tabla>.json`, `columns.json` (`{tabla: [{name,type,default,notnull,pk}]}`) y `meta.json` (`{policies, publication, triggers}`).
  - CLI `node tools/db/fingerprint.js <target> <columns.json> [salida.json]` y `node tools/db/fingerprint.js compare a.json b.json` (exit 1 si difieren).
  - CLI `node tools/db/migrate.js <target> <archivo.sql> [--confirm-prod]`.

- [ ] **Step 1: Ignorar respaldos y excluir herramientas del deploy**

Agregar al final de `.gitignore`:
```
backups/
tools/node_modules/
```
Crear `.vercelignore`:
```
backups/
tools/
tests/
docs/
supabase/
*.backup
```

- [ ] **Step 2: `tools/package.json` e instalar `pg`**

```json
{
  "private": true,
  "name": "guvia-tools",
  "description": "Scripts locales de respaldo, huella y migración de la BD de Guvia. No se despliegan.",
  "devDependencies": { "pg": "^8.13.1" }
}
```
Run: `npm install --prefix tools`
Expected: crea `tools/node_modules/pg`, sin errores.

- [ ] **Step 3: Escribir el test que falla (`tools/db/fingerprint-lib.test.js`)**

```js
const test = require("node:test");
const assert = require("node:assert");
const { quoteIdent, buildFingerprintSql, compareFingerprints } = require("./fingerprint-lib");

test("quoteIdent escapa comillas dobles", () => {
  assert.strictEqual(quoteIdent('a"b'), '"a""b"');
});

test("buildFingerprintSql usa solo las columnas dadas, en orden", () => {
  const sql = buildFingerprintSql("quotes", ["id", "status"]);
  assert.match(sql, /row\("id", "status"\)/);
  assert.match(sql, /from public\."quotes"/);
  assert.match(sql, /order by x/);
});

test("buildFingerprintSql rechaza lista vacía", () => {
  assert.throws(() => buildFingerprintSql("quotes", []), /Sin columnas/);
});

test("compareFingerprints: idénticas → sin diferencias", () => {
  const a = { quotes: { n: 3, h: "abc" } };
  assert.deepStrictEqual(compareFingerprints(a, { quotes: { n: 3, h: "abc" } }), []);
});

test("compareFingerprints detecta conteo, hash y tablas faltantes", () => {
  const a = { quotes: { n: 3, h: "abc" }, clients: { n: 1, h: "x" } };
  const b = { quotes: { n: 4, h: "abd" } };
  const diffs = compareFingerprints(a, b);
  assert.ok(diffs.some(d => d.includes("quotes") && d.includes("filas 3 → 4")));
  assert.ok(diffs.some(d => d.includes("quotes") && d.includes("hash")));
  assert.ok(diffs.some(d => d.includes("clients") && d.includes("falta")));
});
```

- [ ] **Step 4: Correr el test para verificar que falla**

Run: `node --test tools/db/`
Expected: FAIL con `Cannot find module './fingerprint-lib'`.

- [ ] **Step 5: Implementar `tools/db/fingerprint-lib.js`**

```js
// Huella de datos: cantidad de filas + md5 de todas las filas (solo columnas indicadas),
// para demostrar que una migración no cambió ni perdió ningún dato existente.
function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function buildFingerprintSql(table, cols) {
  if (!cols || !cols.length) throw new Error(`Sin columnas para ${table}`);
  const list = cols.map(quoteIdent).join(", ");
  return `select count(*)::int as n, coalesce(md5(string_agg(x, E'\\n' order by x)), '') as h ` +
         `from (select (row(${list}))::text as x from public.${quoteIdent(table)}) s`;
}

function compareFingerprints(a, b) {
  const diffs = [];
  for (const table of Object.keys(a)) {
    if (!b[table]) { diffs.push(`${table}: falta en la segunda huella`); continue; }
    if (a[table].n !== b[table].n) diffs.push(`${table}: filas ${a[table].n} → ${b[table].n}`);
    if (a[table].h !== b[table].h) diffs.push(`${table}: hash distinto (contenido cambió)`);
  }
  for (const table of Object.keys(b)) {
    if (!a[table]) diffs.push(`${table}: falta en la primera huella`);
  }
  return diffs;
}

module.exports = { quoteIdent, buildFingerprintSql, compareFingerprints };
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `node --test tools/db/`
Expected: PASS (5 tests).

- [ ] **Step 7: `tools/db/lib.js`**

```js
// Conexión a la BD de Guvia. Las URLs viven solo en .env y nunca se imprimen.
const path = require("path");
const { Client } = require("pg");
try { process.loadEnvFile(path.join(__dirname, "..", "..", ".env")); } catch {}

const TARGETS = { prod: "GUVIA_DB_URL", staging: "GUVIA_STAGING_DB_URL" };
const BASE_TABLES = [
  "clients", "leads", "quotes", "collections", "expenses", "team_payments", "tax_payments",
  "purchases", "invoiced_sales", "cash_entries", "declaraciones", "settings", "sales_targets",
];

function hostOf(envName) {
  const url = process.env[envName];
  if (!url) throw new Error(`Falta ${envName} en .env`);
  return new URL(url).hostname;
}

// Protección: ningún script de staging puede correr si staging apunta al mismo host que producción.
function assertStagingIsNotProd() {
  if (hostOf("GUVIA_STAGING_DB_URL") === hostOf("GUVIA_DB_URL")) {
    throw new Error("GUVIA_STAGING_DB_URL apunta a PRODUCCIÓN. Abortado, no se tocó nada.");
  }
}

async function connect(target) {
  const envName = TARGETS[target];
  if (!envName) throw new Error(`Destino desconocido: ${target} (usa prod o staging)`);
  if (target === "staging") assertStagingIsNotProd();
  hostOf(envName);
  const client = new Client({ connectionString: process.env[envName], ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

module.exports = { connect, BASE_TABLES, assertStagingIsNotProd };
```

- [ ] **Step 8: `tools/db/backup.js`**

```js
// Respaldo lógico completo: datos de cada tabla base + estructura de columnas + políticas,
// publicación realtime y triggers. Solo lectura.
// Uso: node tools/db/backup.js <prod|staging>
const fs = require("fs");
const path = require("path");
const { connect, BASE_TABLES } = require("./lib");

const COLUMNS_SQL = `
select c.relname as table_name, a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
       pg_get_expr(d.adbin, d.adrelid) as "default", a.attnotnull as notnull,
       coalesce(a.attnum = any(i.indkey::int2[]), false) as pk
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
left join pg_index i on i.indrelid = c.oid and i.indisprimary
where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
  and c.relname = any($1)
order by c.relname, a.attnum`;

(async () => {
  const target = process.argv[2];
  const client = await connect(target);
  try {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const dir = path.join(__dirname, "..", "..", "backups", `${stamp}-${target}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const table of BASE_TABLES) {
      const { rows } = await client.query(`select * from public."${table}"`);
      fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
      console.log(`${table}: ${rows.length} filas`);
    }
    const cols = await client.query(COLUMNS_SQL, [BASE_TABLES]);
    const columns = {};
    for (const r of cols.rows) {
      (columns[r.table_name] = columns[r.table_name] || []).push(
        { name: r.name, type: r.type, default: r.default, notnull: r.notnull, pk: r.pk });
    }
    fs.writeFileSync(path.join(dir, "columns.json"), JSON.stringify(columns, null, 1));
    const policies = (await client.query(
      "select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public'")).rows;
    const publication = (await client.query(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'")).rows.map(r => r.tablename);
    const triggers = (await client.query(
      "select event_object_table as table_name, trigger_name from information_schema.triggers where trigger_schema = 'public'")).rows;
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ policies, publication, triggers }, null, 1));
    console.log(`Respaldo listo en ${dir}`);
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
```

- [ ] **Step 9: `tools/db/fingerprint.js`**

```js
// Huella de datos de las tablas base, usando las columnas ORIGINALES (de un columns.json de respaldo)
// sin user_id, para que columnas nuevas o un user_id distinto en staging no alteren la comparación.
// Uso: node tools/db/fingerprint.js <prod|staging> <columns.json> [salida.json]
//      node tools/db/fingerprint.js compare <a.json> <b.json>
const fs = require("fs");
const { connect, BASE_TABLES } = require("./lib");
const { buildFingerprintSql, compareFingerprints } = require("./fingerprint-lib");

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "compare") {
    const diffs = compareFingerprints(JSON.parse(fs.readFileSync(a)), JSON.parse(fs.readFileSync(b)));
    if (diffs.length) { console.error("DIFERENCIAS:\n" + diffs.join("\n")); process.exit(1); }
    console.log("Huellas IDÉNTICAS ✔");
    return;
  }
  const columns = JSON.parse(fs.readFileSync(a));
  const client = await connect(cmd);
  try {
    const out = {};
    for (const table of BASE_TABLES) {
      const cols = (columns[table] || []).map(c => c.name).filter(n => n !== "user_id");
      const { rows } = await client.query(buildFingerprintSql(table, cols));
      out[table] = rows[0];
    }
    const json = JSON.stringify(out, null, 1);
    if (b) fs.writeFileSync(b, json);
    console.log(json);
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
```

- [ ] **Step 10: `tools/db/migrate.js`**

```js
// Ejecuta un archivo SQL completo dentro de una transacción. Si algo falla → rollback total.
// Producción exige --confirm-prod (solo tras el OK explícito de Dante en el chat).
// Uso: node tools/db/migrate.js <staging|prod> <archivo.sql> [--confirm-prod]
const fs = require("fs");
const { connect } = require("./lib");

(async () => {
  const [target, file, flag] = process.argv.slice(2);
  if (target === "prod" && flag !== "--confirm-prod") throw new Error("Producción requiere --confirm-prod");
  const sql = fs.readFileSync(file, "utf8");
  const client = await connect(target);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(`OK: ${file} aplicado en ${target}`);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw new Error(`${file} falló en ${target} → rollback, no se aplicó nada. Detalle: ${e.message}`);
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
```

- [ ] **Step 11: Commit**

```bash
git add .gitignore .vercelignore tools/package.json tools/package-lock.json tools/db/
git commit -m "Add DB tooling: backup, fingerprint, migrate (local only)"
```

---

### Task 2: Punto de restauración de producción (solo lectura)

**Files:**
- Ninguno versionado. Genera `backups/<stamp>-prod/` y `backups/baseline-prod.json` (ignorados por Git).

**Interfaces:**
- Consumes: CLIs de la Tarea 1.
- Produces:
  - `backups/<stamp>-prod/columns.json` = **columnas originales**, usado por todas las huellas futuras.
  - `backups/baseline-prod.json` = huella de referencia.
  - Tag Git `pre-integracion-kommo`.

- [ ] **Step 1: Pedir a Dante la cadena de conexión de producción**

Dante la copia en Supabase → proyecto `avjthwvppogqezlljksz` → *Connect* → *Session pooler* (URI con contraseña) y agrega a `.env` la línea `GUVIA_DB_URL=postgresql://...`. **Claude no lee ni imprime `.env`.**

- [ ] **Step 2: Respaldo de producción**

Run: `node tools/db/backup.js prod`
Expected: una línea `<tabla>: N filas` por cada una de las 13 tablas y `Respaldo listo en backups/<stamp>-prod`.

- [ ] **Step 3: Verificar que los nombres nuevos NO existen ya**

Run:
```bash
node -e "const c=require('./backups/'+process.argv[1]+'/columns.json');const nuevos={clients:['kommo_company_id','kommo_contact_id','updated_at','sync_source'],leads:['kommo_lead_id','kommo_pipeline_id','updated_at','sync_source'],quotes:['kommo_lead_id','updated_at','sync_source'],collections:['kommo_lead_id','fx_rate','fx_source','amount_pen','updated_at','sync_source']};let ok=true;for(const[t,ns]of Object.entries(nuevos))for(const n of ns)if((c[t]||[]).some(x=>x.name===n)){ok=false;console.log('YA EXISTE',t,n)}console.log(ok?'Sin choques ✔':'HAY CHOQUES ✘')" <stamp>-prod
```
Expected: `Sin choques ✔`. Si hay choques: **detenerse** y renombrar las columnas en la Tarea 4 antes de seguir.

- [ ] **Step 4: Huella de referencia**

Run: `node tools/db/fingerprint.js prod backups/<stamp>-prod/columns.json backups/baseline-prod.json`
Expected: JSON con `{n, h}` por tabla. Los `n` coinciden con los conteos del Step 2.

- [ ] **Step 5: Respaldos que hace Dante (guiados)**

1. En Guvia: Configuración → **Exportar respaldo** → guardar el `.json` en `backups/`.
2. En Kommo: **Leads → ⋯ → Exportar** (todos los embudos), y lo mismo en **Contactos** y **Empresas** → guardar en `backups/`.
3. Capturas de pantalla del **Dashboard, Ventas y Cobranzas** de Guvia con el filtro "Este año". Sirven de referencia visual para la Tarea 9.

- [ ] **Step 6: Respaldo de la estructura de Kommo (Claude, por MCP, solo lectura)**

Llamar `mcp__kommo__get_pipelines` y `mcp__kommo__get_custom_fields` (leads y companies, cuenta `bandu`). Guardar las respuestas en `backups/<stamp>-prod/kommo-structure.json`. Copiar `C:\Users\USER\Downloads\[Bandu] Duplicación de Lead (Venta Ganada) Kommo.json` a `backups/`.

- [ ] **Step 7: Tag de Git del punto de restauración**

```bash
git tag -a pre-integracion-kommo -m "Punto de restauración antes de la integración con Kommo"
```
Expected: `git tag` lista `pre-integracion-kommo`. **No se hace push** hasta la Tarea 9.

---

### Task 3: Entorno de prueba (staging) con copia de los datos

**Files:**
- Create: `tools/db/clone-to-staging.js`, `tools/db/staging-set-user.js`
- Modify: `app.js:1-8` (override de Supabase solo en localhost)

**Interfaces:**
- Consumes:
  - `connect`, `BASE_TABLES`, `assertStagingIsNotProd` (Tarea 1).
  - Carpeta de respaldo (Tarea 2).
- Produces:
  - Proyecto staging con las 13 tablas, RLS y datos copiados.
  - Guvia en `http://localhost:3131` usando staging cuando `localStorage["guvia-sb-override"]` está definido.

- [ ] **Step 1: Dante crea el proyecto de staging**

En su cuenta de Supabase: **New project** → nombre `guvia-staging`, región `us-east-1` (cualquiera) y plan Free. Luego agrega a `.env` `GUVIA_STAGING_DB_URL=postgresql://...` (Session pooler). También anota la *Project URL* y la *anon key*, que son públicas.

- [ ] **Step 2: `tools/db/clone-to-staging.js`**

```js
// Recrea en STAGING las tablas base de un respaldo (columnas, PK, defaults, RLS "own") y copia sus datos.
// Nunca corre contra producción (assertStagingIsNotProd). Con --reset borra antes las tablas base de staging.
// Uso: node tools/db/clone-to-staging.js backups/<stamp>-prod [--reset]
const fs = require("fs");
const path = require("path");
const { connect, BASE_TABLES } = require("./lib");
const { quoteIdent } = require("./fingerprint-lib");

(async () => {
  const [dir, flag] = process.argv.slice(2);
  const columns = JSON.parse(fs.readFileSync(path.join(dir, "columns.json")));
  const client = await connect("staging");
  try {
    await client.query("begin");
    for (const table of BASE_TABLES) {
      const t = `public.${quoteIdent(table)}`;
      if (flag === "--reset") await client.query(`drop table if exists ${t} cascade`);
      const cols = columns[table];
      const defs = cols.map(c => `${quoteIdent(c.name)} ${c.type}` +
        (c.default ? ` default ${c.default}` : "") + (c.notnull ? " not null" : ""));
      const pk = cols.filter(c => c.pk).map(c => quoteIdent(c.name));
      if (pk.length) defs.push(`primary key (${pk.join(", ")})`);
      await client.query(`create table ${t} (${defs.join(", ")})`);
      await client.query(`alter table ${t} enable row level security`);
      await client.query(`create policy "own" on ${t} for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`);
      const rows = JSON.parse(fs.readFileSync(path.join(dir, `${table}.json`)));
      for (let i = 0; i < rows.length; i += 500) {
        await client.query(`insert into ${t} select * from json_populate_recordset(null::${t}, $1::json)`,
          [JSON.stringify(rows.slice(i, i + 500))]);
      }
      console.log(`${table}: ${rows.length} filas copiadas`);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
```

Las tablas de staging no llevan la FK a `auth.users`, así el `user_id` se puede reasignar al usuario de staging.

- [ ] **Step 3: Clonar y verificar con la huella**

Run:
```bash
node tools/db/clone-to-staging.js backups/<stamp>-prod
node tools/db/fingerprint.js staging backups/<stamp>-prod/columns.json backups/staging-clone.json
node tools/db/fingerprint.js compare backups/baseline-prod.json backups/staging-clone.json
```
Expected: `Huellas IDÉNTICAS ✔`.

- [ ] **Step 4: Dante crea su usuario en staging**

Supabase staging → Authentication → **Add user** → `dante@bandu.pe` con una contraseña de prueba que Dante elige (Claude no la ve) y "Auto confirm".

- [ ] **Step 5: `tools/db/staging-set-user.js` y reasignar**

```js
// Reasigna todas las filas de las tablas base de STAGING al usuario de staging con ese email.
// Uso: node tools/db/staging-set-user.js dante@bandu.pe
const { connect, BASE_TABLES } = require("./lib");

(async () => {
  const email = process.argv[2];
  const client = await connect("staging");
  try {
    const { rows } = await client.query("select id from auth.users where email = $1", [email]);
    if (!rows.length) throw new Error(`No existe ${email} en staging`);
    const uid = rows[0].id;
    await client.query("begin");
    for (const table of BASE_TABLES) {
      const r = await client.query(`update public."${table}" set user_id = $1`, [uid]);
      console.log(`${table}: ${r.rowCount} filas → ${email}`);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
```
Run: `node tools/db/staging-set-user.js dante@bandu.pe`
Expected: una línea por tabla. Después, la huella de staging sigue idéntica, porque excluye `user_id`.

- [ ] **Step 6: Override de Supabase solo en localhost (`app.js:1-8`)**

Reemplazar:
```js
const SUPABASE_URL = "https://avjthwvppogqezlljksz.supabase.co";
const SUPABASE_KEY = "eyJ...";
```
por:
```js
// En localhost se puede apuntar a otro proyecto (staging) guardando en localStorage
// "guvia-sb-override" = {"url":"...","key":"<anon key>"}. En producción esto se ignora siempre.
const SB_OVERRIDE = (() => {
  if (!["localhost", "127.0.0.1"].includes(location.hostname)) return null;
  try { return JSON.parse(localStorage.getItem("guvia-sb-override") || "null"); } catch { return null; }
})();
const SUPABASE_URL = SB_OVERRIDE?.url || "https://avjthwvppogqezlljksz.supabase.co";
const SUPABASE_KEY = SB_OVERRIDE?.key || "eyJ...";
```
Conservar intacto el valor `eyJ...` original del archivo. Subir `app.js?v=97` → `app.js?v=98` en `index.html`.

- [ ] **Step 7: Verificar Guvia contra staging**

1. `preview_start` con `{name: "Bandu Panel"}`.
2. En la consola: `localStorage.setItem("guvia-sb-override", JSON.stringify({url:"<staging url>", key:"<staging anon key>"}))` y recargar.
3. Dante inicia sesión con la cuenta de staging; Claude no escribe la contraseña.
4. Expected: el Dashboard muestra los mismos totales que las capturas de producción de la Tarea 2. En `read_network_requests`, todas las peticiones van al host de staging.

- [ ] **Step 8: Commit**

```bash
git add tools/db/clone-to-staging.js tools/db/staging-set-user.js app.js index.html
git commit -m "Add staging clone tools and localhost-only Supabase override"
```

---

### Task 4: Migración 001 (sync base) con reversión y prueba de integración

**Files:**
- Create: `supabase/migrations/001_kommo_sync_base.up.sql`, `supabase/migrations/001_kommo_sync_base.down.sql`, `tools/db/test-migration-001.js`

**Interfaces:**
- Consumes: `migrate.js`, `fingerprint-lib`, `connect` (Tarea 1); staging (Tarea 3).
- Produces (en BD), usado por la Fase 1 y por las Tareas 5 y 6:
  - **Tablas:** `integration_settings(user_id pk, kommo_sync_enabled bool default false, updated_at)`, `kommo_outbox(id, user_id, entity, entity_id, op, payload, status, attempts, error, created_at)`, `sync_log(id, user_id, direction, entity, entity_id, kommo_id, result, detail, created_at)`, `guvia_realtime_added(tablename)`.
  - **Columnas:** `clients.kommo_company_id/kommo_contact_id`, `leads.kommo_lead_id/kommo_pipeline_id`, `quotes.kommo_lead_id`, `collections.kommo_lead_id/fx_rate/fx_source/amount_pen`; `updated_at`, `sync_source` en clients/leads/quotes/collections.
  - **Triggers:** `guvia_sync_meta` (BEFORE INSERT/UPDATE) y `guvia_enqueue_kommo` (AFTER INSERT/UPDATE/DELETE en quotes, collections y clients).
  - **Realtime:** clients, leads, quotes y collections en `supabase_realtime`.

- [ ] **Step 1: Escribir la prueba de integración que falla (`tools/db/test-migration-001.js`)**

```js
// Prueba de la migración 001 en STAGING: up no altera datos, triggers correctos, kill switch,
// trigger roto no bloquea guardados, down deja todo como estaba. Deja staging con la migración aplicada.
// Uso: node tools/db/test-migration-001.js backups/<stamp>-prod/columns.json
const fs = require("fs");
const path = require("path");
const assert = require("node:assert");
const { connect, BASE_TABLES } = require("./lib");
const { buildFingerprintSql, compareFingerprints } = require("./fingerprint-lib");

const UP = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/001_kommo_sync_base.up.sql"), "utf8");
const DOWN = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/001_kommo_sync_base.down.sql"), "utf8");
const columns = JSON.parse(fs.readFileSync(process.argv[2]));

async function fingerprint(c) {
  const out = {};
  for (const t of BASE_TABLES) {
    const cols = columns[t].map(x => x.name).filter(n => n !== "user_id");
    out[t] = (await c.query(buildFingerprintSql(t, cols))).rows[0];
  }
  return out;
}
async function runTx(c, sql) { await c.query("begin"); await c.query(sql); await c.query("commit"); }
async function outboxCount(c) { return (await c.query("select count(*)::int n from public.kommo_outbox")).rows[0].n; }
async function asRole(c, role, uid) {
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role, sub: uid })]);
  await c.query(`set local role ${role}`);
}

// Ejecuta fn dentro de una transacción que SIEMPRE se revierte (no deja rastro en staging).
async function scenario(c, name, fn) {
  await c.query("begin");
  try { await fn(); console.log(`  ✔ ${name}`); }
  finally { await c.query("rollback"); }
}

(async () => {
  const c = await connect("staging");
  try {
    const before = await fingerprint(c);

    await runTx(c, UP);
    assert.deepStrictEqual(compareFingerprints(before, await fingerprint(c)), [], "up alteró datos existentes");
    console.log("✔ up no altera datos");

    const q = (await c.query("select id, user_id, status from public.quotes limit 1")).rows[0];
    assert.ok(q, "staging necesita al menos una cotización");
    const enable = on => c.query(
      `insert into public.integration_settings(user_id, kommo_sync_enabled) values ($1, $2)
       on conflict (user_id) do update set kommo_sync_enabled = excluded.kommo_sync_enabled`, [q.user_id, on]);
    const otherStatus = q.status === "Perdido" ? "Cotizado" : "Perdido";

    await scenario(c, "kill switch apagado: no encola", async () => {
      await enable(false);
      await asRole(c, "authenticated", q.user_id);
      await c.query("update public.quotes set status = $1 where id = $2", [otherStatus, q.id]);
      await c.query("reset role");
      assert.strictEqual(await outboxCount(c), 0);
    });

    await scenario(c, "cambio relevante desde Guvia: encola 1 y marca sync_source=guvia", async () => {
      await enable(true);
      await asRole(c, "authenticated", q.user_id);
      await c.query("update public.quotes set status = $1 where id = $2", [otherStatus, q.id]);
      await c.query("reset role");
      assert.strictEqual(await outboxCount(c), 1);
      const r = (await c.query("select sync_source, updated_at from public.quotes where id = $1", [q.id])).rows[0];
      assert.strictEqual(r.sync_source, "guvia");
      assert.ok(r.updated_at);
    });

    await scenario(c, "upsert sin cambios / columna irrelevante / null→'': no encola", async () => {
      await enable(true);
      await asRole(c, "authenticated", q.user_id);
      await c.query("update public.quotes set status = status, comments = coalesce(comments,'') || 'x' where id = $1", [q.id]);
      await c.query("update public.quotes set code = coalesce(code, '') where id = $1", [q.id]);
      await c.query("reset role");
      assert.strictEqual(await outboxCount(c), 0);
    });

    await scenario(c, "cambio desde n8n (service_role): sync_source=kommo y no encola", async () => {
      await enable(true);
      await asRole(c, "service_role", q.user_id);
      await c.query("update public.quotes set status = $1 where id = $2", [otherStatus, q.id]);
      await c.query("reset role");
      assert.strictEqual(await outboxCount(c), 0);
      const r = (await c.query("select sync_source from public.quotes where id = $1", [q.id])).rows[0];
      assert.strictEqual(r.sync_source, "kommo");
    });

    await scenario(c, "trigger roto NO bloquea el guardado", async () => {
      await enable(true);
      await c.query("alter table public.kommo_outbox add constraint t_fail check (false)");
      await asRole(c, "authenticated", q.user_id);
      await c.query("update public.quotes set status = $1 where id = $2", [otherStatus, q.id]);
      await c.query("reset role");
      const r = (await c.query("select status from public.quotes where id = $1", [q.id])).rows[0];
      assert.strictEqual(r.status, otherStatus);
    });

    await runTx(c, DOWN);
    assert.deepStrictEqual(compareFingerprints(before, await fingerprint(c)), [], "down alteró datos");
    const leftovers = (await c.query(`select
      to_regclass('public.kommo_outbox') a, to_regclass('public.sync_log') b,
      to_regclass('public.integration_settings') c2, to_regclass('public.guvia_realtime_added') d,
      (select count(*)::int from information_schema.columns where table_schema='public'
         and column_name in ('sync_source','kommo_lead_id','kommo_company_id','fx_rate')) cols`)).rows[0];
    assert.deepStrictEqual(leftovers, { a: null, b: null, c2: null, d: null, cols: 0 });
    console.log("✔ down deja todo como estaba");

    await runTx(c, UP);
    console.log("✔ up re-aplicado (staging queda migrado). TODO OK");
  } finally {
    await c.end();
  }
})().catch(e => { console.error("FALLÓ:", e.message); process.exit(1); });
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `node tools/db/test-migration-001.js backups/<stamp>-prod/columns.json`
Expected: FAIL con `ENOENT ... 001_kommo_sync_base.up.sql`.

- [ ] **Step 3: Escribir `supabase/migrations/001_kommo_sync_base.up.sql`**

```sql
-- 001 · Base de sincronización Guvia ⇄ Kommo. SOLO AGREGA. DDL estricto (sin IF NOT EXISTS):
-- si algún nombre ya existe, falla y migrate.js revierte todo. Reversión: 001_kommo_sync_base.down.sql

-- Interruptor general (sin fila o false = apagado)
create table public.integration_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kommo_sync_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.integration_settings enable row level security;
create policy "own" on public.integration_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vínculos con Kommo y datos de tipo de cambio (todas opcionales, vacías en lo existente)
alter table public.clients
  add column kommo_company_id bigint, add column kommo_contact_id bigint,
  add column updated_at timestamptz, add column sync_source text;
alter table public.leads
  add column kommo_lead_id bigint, add column kommo_pipeline_id bigint,
  add column updated_at timestamptz, add column sync_source text;
alter table public.quotes
  add column kommo_lead_id bigint,
  add column updated_at timestamptz, add column sync_source text;
alter table public.collections
  add column kommo_lead_id bigint, add column fx_rate numeric, add column fx_source text,
  add column amount_pen numeric,
  add column updated_at timestamptz, add column sync_source text;

-- Bandeja de salida hacia Kommo (la consume n8n con la service key; sin políticas = el navegador no la ve)
create table public.kommo_outbox (
  id bigserial primary key,
  user_id uuid not null,
  entity text not null,
  entity_id uuid not null,
  op text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now()
);
alter table public.kommo_outbox enable row level security;

-- Auditoría de sincronización (el usuario puede leer la suya)
create table public.sync_log (
  id bigserial primary key,
  user_id uuid not null,
  direction text not null,
  entity text not null,
  entity_id text,
  kommo_id bigint,
  result text not null,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.sync_log enable row level security;
create policy "own_read" on public.sync_log for select using (auth.uid() = user_id);

-- updated_at + origen del cambio: service_role (n8n) = 'kommo'; cualquier otro (navegador) = 'guvia'
create function public.guvia_sync_meta() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.sync_source := case
    when current_user = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    then 'kommo' else 'guvia' end;
  return new;
end $$;

create trigger guvia_sync_meta before insert or update on public.clients     for each row execute function public.guvia_sync_meta();
create trigger guvia_sync_meta before insert or update on public.leads       for each row execute function public.guvia_sync_meta();
create trigger guvia_sync_meta before insert or update on public.quotes      for each row execute function public.guvia_sync_meta();
create trigger guvia_sync_meta before insert or update on public.collections for each row execute function public.guvia_sync_meta();

-- Encola cambios RELEVANTES hechos desde Guvia. Columnas relevantes = argumentos del trigger.
-- Nunca bloquea el guardado: cualquier error se convierte en WARNING.
create function public.guvia_enqueue_kommo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  uid uuid;
  enabled boolean;
  relevant boolean := true;
begin
  begin
    rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    uid := (rec ->> 'user_id')::uuid;
    if tg_op <> 'DELETE' and rec ->> 'sync_source' = 'kommo' then return null; end if;
    if tg_op = 'DELETE' and current_user = 'service_role' then return null; end if;
    select kommo_sync_enabled into enabled from public.integration_settings where user_id = uid;
    if not coalesce(enabled, false) then return null; end if;
    if tg_op = 'UPDATE' then
      select coalesce(bool_or(coalesce(to_jsonb(new) ->> col, '') is distinct from coalesce(to_jsonb(old) ->> col, '')), false)
        into relevant from unnest(tg_argv) as col;
    end if;
    if relevant then
      insert into public.kommo_outbox (user_id, entity, entity_id, op, payload)
      values (uid, tg_table_name, (rec ->> 'id')::uuid, lower(tg_op), rec);
    end if;
  exception when others then
    raise warning 'guvia_enqueue_kommo (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end $$;

create trigger guvia_enqueue_kommo after insert or update or delete on public.quotes
  for each row execute function public.guvia_enqueue_kommo('status','subtotal','has_igv','currency','cuotas','code','client','service','won_date');
create trigger guvia_enqueue_kommo after insert or update or delete on public.collections
  for each row execute function public.guvia_enqueue_kommo('status','amount','due_date','paid_date','invoice','part','currency');
create trigger guvia_enqueue_kommo after insert or update or delete on public.clients
  for each row execute function public.guvia_enqueue_kommo('name','ruc','email','phone','contact');

-- Realtime: agrega solo las tablas que aún no estaban y lo anota, para que down quite exactamente esas
create table public.guvia_realtime_added (tablename text primary key);
alter table public.guvia_realtime_added enable row level security;
do $$
declare t text;
begin
  foreach t in array array['clients','leads','quotes','collections'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      insert into public.guvia_realtime_added (tablename) values (t);
    end if;
  end loop;
end $$;
```

- [ ] **Step 4: Escribir `supabase/migrations/001_kommo_sync_base.down.sql`**

```sql
-- Reversión exacta de 001. Elimina SOLO lo que 001 creó. Los datos originales no se tocan.
do $$
declare t text;
begin
  for t in select tablename from public.guvia_realtime_added loop
    execute format('alter publication supabase_realtime drop table public.%I', t);
  end loop;
end $$;
drop table public.guvia_realtime_added;

drop trigger guvia_enqueue_kommo on public.quotes;
drop trigger guvia_enqueue_kommo on public.collections;
drop trigger guvia_enqueue_kommo on public.clients;
drop function public.guvia_enqueue_kommo();

drop trigger guvia_sync_meta on public.clients;
drop trigger guvia_sync_meta on public.leads;
drop trigger guvia_sync_meta on public.quotes;
drop trigger guvia_sync_meta on public.collections;
drop function public.guvia_sync_meta();

drop table public.kommo_outbox;
drop table public.sync_log;
drop table public.integration_settings;

alter table public.clients
  drop column kommo_company_id, drop column kommo_contact_id, drop column updated_at, drop column sync_source;
alter table public.leads
  drop column kommo_lead_id, drop column kommo_pipeline_id, drop column updated_at, drop column sync_source;
alter table public.quotes
  drop column kommo_lead_id, drop column updated_at, drop column sync_source;
alter table public.collections
  drop column kommo_lead_id, drop column fx_rate, drop column fx_source, drop column amount_pen,
  drop column updated_at, drop column sync_source;
```

- [ ] **Step 5: Correr la prueba para verificar que pasa**

Run: `node tools/db/test-migration-001.js backups/<stamp>-prod/columns.json`
Expected: `✔ up no altera datos`, los 5 escenarios `✔`, `✔ down deja todo como estaba` y `TODO OK`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ tools/db/test-migration-001.js
git commit -m "Add reversible migration 001: Kommo sync base (outbox, sync meta, realtime)"
```

---

### Task 5: Guvia sube solo las filas modificadas

**Files:**
- Create: `sync-diff.js`, `tests/sync-diff.test.js`
- Modify: `app.js` (`sbSyncTable` ~l.52-82, `sbLoad` ~l.135-225), `index.html:280-282`

**Interfaces:**
- Produces: global `GuviaSyncDiff` en el navegador y `module.exports` en Node con:
  - `sameValue(a, b) → boolean`
  - `rowDiffers(localRow, baseRow) → boolean`
  - `createSnapshot() → {}`, `clearSnapshot(snap)`
  - `rememberRows(snap, table, rows)`, `forgetIds(snap, table, ids)`
  - `changedRows(snap, table, rows) → rows[]`
  - `remoteAction(snap, table, eventType, remoteRow, localRow) → "apply"|"same"|"keep-local"|"remove"` (lo usa la Tarea 6)
- Produces en `app.js`: `syncSnapshot`, `sbRowFor(table, record, uid)`, `pickSbCols(table, rawRow)` (los usa la Tarea 6).

- [ ] **Step 1: Escribir el test que falla (`tests/sync-diff.test.js`)**

```js
const test = require("node:test");
const assert = require("node:assert");
const D = require("../sync-diff.js");

test("sameValue: null, undefined y '' son iguales; números y texto numérico también", () => {
  assert.ok(D.sameValue(null, ""));
  assert.ok(D.sameValue(undefined, null));
  assert.ok(D.sameValue(837.5, "837.50"));
  assert.ok(D.sameValue(true, "true"));
  assert.ok(D.sameValue({ a: 1, b: 2 }, { b: 2, a: 1 }));
  assert.ok(!D.sameValue("abc", ""));
  assert.ok(!D.sameValue(1, 2));
});

test("rowDiffers compara solo las claves de la fila local", () => {
  assert.ok(!D.rowDiffers({ id: "1", status: "Ganado" }, { id: "1", status: "Ganado", payment_type: "split" }));
  assert.ok(D.rowDiffers({ id: "1", status: "Ganado" }, { id: "1", status: "Cotizado" }));
  assert.ok(D.rowDiffers({ id: "1" }, undefined));
});

test("changedRows: sin snapshot todo es nuevo; tras rememberRows ya no", () => {
  const snap = D.createSnapshot();
  const rows = [{ id: "a", x: 1 }, { id: "b", x: 2 }];
  assert.strictEqual(D.changedRows(snap, "quotes", rows).length, 2);
  D.rememberRows(snap, "quotes", rows);
  assert.strictEqual(D.changedRows(snap, "quotes", rows).length, 0);
  assert.deepStrictEqual(D.changedRows(snap, "quotes", [{ id: "a", x: 9 }, { id: "b", x: 2 }]).map(r => r.id), ["a"]);
});

test("si la subida falla (no se llama rememberRows) la fila sigue pendiente", () => {
  const snap = D.createSnapshot();
  D.rememberRows(snap, "quotes", [{ id: "a", x: 1 }]);
  const edited = [{ id: "a", x: 2 }];
  assert.strictEqual(D.changedRows(snap, "quotes", edited).length, 1);
  assert.strictEqual(D.changedRows(snap, "quotes", edited).length, 1);
});

test("forgetIds y clearSnapshot", () => {
  const snap = D.createSnapshot();
  D.rememberRows(snap, "quotes", [{ id: "a", x: 1 }]);
  D.forgetIds(snap, "quotes", ["a"]);
  assert.strictEqual(D.changedRows(snap, "quotes", [{ id: "a", x: 1 }]).length, 1);
  D.rememberRows(snap, "quotes", [{ id: "a", x: 1 }]);
  D.clearSnapshot(snap);
  assert.deepStrictEqual(snap, {});
});

test("remoteAction: DELETE → remove; fila nueva → apply", () => {
  const snap = D.createSnapshot();
  assert.strictEqual(D.remoteAction(snap, "quotes", "DELETE", { id: "a" }, { id: "a" }), "remove");
  assert.strictEqual(D.remoteAction(snap, "quotes", "INSERT", { id: "n", x: 1 }, undefined), "apply");
});

test("remoteAction: eco del propio guardado → same; edición local sin subir → keep-local", () => {
  const snap = D.createSnapshot();
  D.rememberRows(snap, "quotes", [{ id: "a", status: "Cotizado" }]);
  assert.strictEqual(D.remoteAction(snap, "quotes", "UPDATE", { id: "a", status: "Cotizado" }, { id: "a", status: "Cotizado" }), "same");
  assert.strictEqual(D.remoteAction(snap, "quotes", "UPDATE", { id: "a", status: "Ganado" }, { id: "a", status: "Perdido" }), "keep-local");
  assert.strictEqual(D.remoteAction(snap, "quotes", "UPDATE", { id: "a", status: "Ganado" }, { id: "a", status: "Cotizado" }), "apply");
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `node --test tests/`
Expected: FAIL con `Cannot find module '../sync-diff.js'`.

- [ ] **Step 3: Implementar `sync-diff.js`**

```js
// Sincronización por filas modificadas. Guarda la última versión confirmada en Supabase de cada
// fila y solo sube las que el usuario cambió, para no pisar lo que otro sistema (n8n/Kommo)
// actualizó en la nube. Lógica pura: se usa en el navegador (window.GuviaSyncDiff) y en tests (Node).
(function (root) {
  function normalize(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return stableStringify(v);
    return String(v);
  }
  function stableStringify(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  }
  function isNumeric(s) { return s !== "" && Number.isFinite(Number(s)); }

  function sameValue(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return true;
    return isNumeric(na) && isNumeric(nb) && Number(na) === Number(nb);
  }

  function rowDiffers(localRow, baseRow) {
    if (!baseRow) return true;
    return Object.keys(localRow).some(k => !sameValue(localRow[k], baseRow[k]));
  }

  function createSnapshot() { return {}; }
  function clearSnapshot(snap) { for (const k of Object.keys(snap)) delete snap[k]; }

  function rememberRows(snap, table, rows) {
    const t = snap[table] || (snap[table] = {});
    for (const r of rows) t[r.id] = Object.assign({}, t[r.id], r);
  }
  function forgetIds(snap, table, ids) {
    const t = snap[table];
    if (t) for (const id of ids) delete t[id];
  }
  function changedRows(snap, table, rows) {
    const t = snap[table] || {};
    return rows.filter(r => rowDiffers(r, t[r.id]));
  }

  // Qué hacer con un cambio que llega por Realtime:
  // remove = se borró en la nube · apply = reemplazar/insertar la fila local ·
  // same = ya es igual (eco del propio guardado) · keep-local = hay una edición local sin subir (gana lo local)
  function remoteAction(snap, table, eventType, remoteRow, localRow) {
    if (eventType === "DELETE") return "remove";
    if (!localRow) return "apply";
    const base = (snap[table] || {})[remoteRow.id];
    if (base && rowDiffers(localRow, base)) return "keep-local";
    if (!rowDiffers(localRow, remoteRow)) return "same";
    return "apply";
  }

  const api = { sameValue, rowDiffers, createSnapshot, clearSnapshot, rememberRows, forgetIds, changedRows, remoteAction };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GuviaSyncDiff = api;
})(this);
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `node --test tests/`
Expected: PASS (7 tests).

- [ ] **Step 5: Cargar `sync-diff.js` en `index.html`**

Antes de `<script src="app.js?v=98"></script>` agregar `<script src="sync-diff.js?v=1"></script>`, y subir `app.js?v=98` → `?v=99`.

- [ ] **Step 6: Integrar en `app.js` — `sbSyncTable`**

Debajo de `markDeleted` agregar:
```js
// Última versión confirmada en Supabase de cada fila (por tabla). Solo se suben filas que difieren.
const syncSnapshot = GuviaSyncDiff.createSnapshot();

function sbRowFor(table, record, uid) {
  const allowed = new Set(SB_COLS[table] || []);
  const filtered = { user_id: uid };
  for (const [k, v] of Object.entries(toSnake(record))) {
    if (allowed.has(k)) filtered[k] = v;
  }
  return filtered;
}

function pickSbCols(table, raw) {
  const out = { user_id: raw.user_id };
  for (const k of SB_COLS[table] || []) if (k in raw) out[k] = raw[k];
  return out;
}
```
En `sbSyncTable`, reemplazar el bloque `const allowed ... return filtered; });` por:
```js
  const rows = records.map(r => sbRowFor(table, r, uid));
```
En la rama de borrado exitoso, después de actualizar `pendingDeletes`, agregar:
```js
      GuviaSyncDiff.forgetIds(syncSnapshot, table, idsToDelete);
```
Reemplazar el bloque final del upsert:
```js
  if (rows.length) {
    const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
    if (error) console.error(`sbSyncTable(${table}):`, error.message);
  }
```
por:
```js
  const dirty = GuviaSyncDiff.changedRows(syncSnapshot, table, rows);
  if (dirty.length) {
    const { error } = await sb.from(table).upsert(dirty, { onConflict: "id" });
    if (error) console.error(`sbSyncTable(${table}):`, error.message);
    else GuviaSyncDiff.rememberRows(syncSnapshot, table, dirty);
  }
```

- [ ] **Step 7: Integrar en `app.js` — `sbLoad`**

Justo después de `const [ { data: clients }, ... ] = results;` agregar:
```js
  // Lo que hay en la nube es la versión confirmada de cada fila.
  GuviaSyncDiff.clearSnapshot(syncSnapshot);
  const loaded = { clients, leads, quotes, collections, expenses, team_payments: team, tax_payments: taxPayments,
                   purchases, invoiced_sales: invoicedSales, cash_entries: cashEntries, declaraciones };
  for (const [table, data] of Object.entries(loaded)) {
    GuviaSyncDiff.rememberRows(syncSnapshot, table, (data || []).map(r => pickSbCols(table, r)));
  }
```
La ruta de "cuenta vacía + subir copia local" no necesita cambios: con el snapshot vacío sube todo, igual que hoy.

- [ ] **Step 8: Verificar en staging con el navegador**

1. Con el override de staging activo (Tarea 3), recargar `http://localhost:3131` (Dante ya tiene sesión).
2. Editar el campo "Comentarios" de **una** cotización y guardar.
3. `read_network_requests` con `urlPattern: "/rest/v1/quotes"`: el cuerpo del POST debe contener **1 fila**. Las otras tablas no envían POST o envían solo filas con diferencias de normalización en el primer guardado.
4. Guardar otra vez sin cambios: no debe aparecer ningún POST a `/rest/v1/`.
5. `read_console_messages` con `onlyErrors: true`: sin errores nuevos.

- [ ] **Step 9: Regresión de datos en staging**

Run: `node tools/db/fingerprint.js staging backups/<stamp>-prod/columns.json backups/staging-after-t5.json`
Expected: difiere de `baseline-prod.json` **solo** en `quotes` (la edición del Step 8). Revertir esa edición a mano en la app y volver a comparar → `Huellas IDÉNTICAS ✔`.

- [ ] **Step 10: Commit**

```bash
git add sync-diff.js tests/sync-diff.test.js app.js index.html
git commit -m "Sync only modified rows to Supabase (dirty tracking)"
```

---

### Task 6: Guvia escucha Supabase Realtime

**Files:**
- Modify: `app.js` (después de `sbLoad`; logout ~l.938-940; mapeo de collections en `sbLoad`), `index.html` (versión)

**Interfaces:**
- Consumes: `GuviaSyncDiff.remoteAction`, `rememberRows`; `syncSnapshot`, `sbRowFor`, `pickSbCols` (Tarea 5); `newClient`, `newLead`, `newQuote`, `syncQuoteSideEffects`, `saveState`, `render`, `STORAGE_KEY`.
- Produces: `collectionFromRow(c, local)`, `startRealtime()`, `stopRealtime()`, `onRemoteChange(table, payload)`.

- [ ] **Step 1: Extraer `collectionFromRow` (refactor sin cambio de comportamiento)**

En `sbLoad`, el `.map(r => { const c = toCamel(r); const lc = ...; return {...} })` de collections pasa a:
```js
  state.collections   = (collections   || []).map(r => collectionFromRow(toCamel(r), localColMap.get(r.id)));
```
y se agrega, antes de `sbLoad`:
```js
function collectionFromRow(c, lc = {}) {
  return { id:c.id, quoteId:c.quoteId||"", part:Number(c.part||1), label:c.label||"", dueDate:c.dueDate||"", amount:Number(c.amount||0), detraction:Number(c.detraction||0), currency:c.currency||"PEN", status:c.status||"Pendiente", paidDate:c.paidDate||"", invoice:c.invoice||"", bankAccount:c.bankAccount||"", declared:c.declared||"Sin declarar", repo:c.repo||lc.repo||"" };
}
```
El objeto devuelto es exactamente el del código actual.

- [ ] **Step 2: Agregar Realtime después de `sbLoad`**

```js
// Cambios que llegan desde la nube (p. ej. n8n/Kommo) se aplican sin recargar.
// Una edición local aún no subida tiene prioridad; el eco del propio guardado se ignora.
const REMOTE_TABLES = {
  clients:     { key: "clients",     from: (r) => newClient(toCamel(r)) },
  leads:       { key: "leads",       from: (r) => newLead(toCamel(r)) },
  quotes:      { key: "quotes",      from: (r) => newQuote(toCamel(r)) },
  collections: { key: "collections", from: (r, local) => collectionFromRow(toCamel(r), local) },
};
let sbChannel = null;

function onRemoteChange(table, payload) {
  const cfg = REMOTE_TABLES[table];
  if (!cfg || !sbUser) return;
  const list = state[cfg.key];
  const raw = payload.eventType === "DELETE" ? payload.old : payload.new;
  if (!raw?.id) return;
  if (payload.eventType !== "DELETE" && raw.user_id !== sbUser.id) return;
  const local = list.find(x => x.id === raw.id);
  const remoteRow = payload.eventType === "DELETE" ? { id: raw.id } : pickSbCols(table, raw);
  const localRow = local ? sbRowFor(table, local, sbUser.id) : undefined;
  const action = GuviaSyncDiff.remoteAction(syncSnapshot, table, payload.eventType, remoteRow, localRow);
  if (action === "keep-local") return;
  if (action === "same") { GuviaSyncDiff.rememberRows(syncSnapshot, table, [remoteRow]); return; }
  if (action === "remove") {
    if (!local) return;
    state[cfg.key] = list.filter(x => x.id !== raw.id);
    GuviaSyncDiff.forgetIds(syncSnapshot, table, [raw.id]);
  } else {
    const record = cfg.from(raw, local);
    state[cfg.key] = local ? list.map(x => (x.id === raw.id ? record : x)) : list.concat(record);
    GuviaSyncDiff.rememberRows(syncSnapshot, table, [remoteRow]);
    if (table === "quotes") {
      // Mantener cobranzas/lead coherentes (misma lógica que al cargar). Si cambian, se suben.
      syncQuoteSideEffects(state, record);
      saveState();
      render();
      return;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function startRealtime() {
  if (sbChannel || !sbUser) return;
  sbChannel = sb.channel("guvia-sync");
  for (const table of Object.keys(REMOTE_TABLES)) {
    sbChannel.on("postgres_changes", { event: "*", schema: "public", table }, payload => {
      try { onRemoteChange(table, payload); } catch (e) { console.error("realtime:", table, e); }
    });
  }
  sbChannel.subscribe();
}

function stopRealtime() {
  if (sbChannel) { sb.removeChannel(sbChannel); sbChannel = null; }
}
```

- [ ] **Step 3: Arrancar y detener Realtime**

- Al final de `sbLoad` (después del bloque de migraciones con `sbSync()`), agregar `startRealtime();`. Esto cubre el login y la carga inicial, porque ambos llaman `sbLoad`.
- En el logout, dentro de `.finally(() => {`, antes de `sbUser = null;`, agregar `stopRealtime();`.
- Subir la versión en `index.html`: `app.js?v=99` → `?v=100`.

- [ ] **Step 4: Verificar en staging (cambio remoto simulado)**

1. Recargar Guvia (override de staging) y abrir **Cotizaciones**.
2. Claude ejecuta en staging, simulando a n8n:
```bash
node -e "const {connect}=require('./tools/db/lib');(async()=>{const c=await connect('staging');await c.query('begin');await c.query(\"set local role service_role\");const r=await c.query(\"update public.quotes set comments = comments || ' [realtime-test]' where id = (select id from public.quotes order by date desc limit 1) returning code\");await c.query('commit');console.log('editada',r.rows[0]);await c.end()})()"
```
3. Expected: sin recargar, en Guvia el comentario de esa cotización termina en `[realtime-test]` (`read_page`), sin errores de consola, y `read_network_requests` **no** muestra un POST que re-suba esa fila.
4. Limpiar: repetir el comando con `comments = replace(comments, ' [realtime-test]', '')`.
5. Huella de staging vs `baseline-prod.json` → `Huellas IDÉNTICAS ✔`.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "Apply Supabase Realtime changes in Guvia without overwriting local edits"
```

---

### Task 7: Ensayo completo de reversión en staging + runbook

**Files:**
- Create: `docs/integracion/REVERSION.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el procedimiento probado que se usará si Dante pide "volver a como estaba".

- [ ] **Step 1: Escribir `docs/integracion/REVERSION.md`**

```markdown
# Reversión total de la integración Guvia ⇄ Kommo

Objetivo: dejar Guvia, Supabase y Kommo como estaban en el tag `pre-integracion-kommo`, sin perder datos
(incluidos los ingresados después). Ejecutar en orden. No saltar la verificación final.

1. **Detener la sincronización**
   - Supabase SQL: `update public.integration_settings set kommo_sync_enabled = false;`
   - n8n: desactivar todos los flujos con prefijo `GUVIA ·`.
2. **Respaldo previo a revertir:** `node tools/db/backup.js prod` (guarda también lo ingresado después).
3. **App:** volver a la versión del tag.
   - Inmediato: en Vercel → Deployments → el deploy del commit del tag → "Promote to Production".
   - Definitivo en Git: `git checkout pre-integracion-kommo -- app.js index.html` → `git rm sync-diff.js` →
     commit "Revert Guvia app to pre-integracion-kommo" → push.
   - La app vieja funciona igual con o sin la migración 001: solo sube sus columnas conocidas e ignora las nuevas.
4. **Base de datos:** `node tools/db/migrate.js prod supabase/migrations/001_kommo_sync_base.down.sql --confirm-prod`
5. **Kommo** (lo hace Dante en la interfaz; IDs en `docs/integracion/kommo-ids.json`):
   a. Eliminar el webhook de n8n (Ajustes → Integraciones → Webhooks).
   b. Desactivar el bot "[Guvia] Notificación de cobro".
   c. Mover los leads de la etapa "Cotizar" (5 embudos) a la etapa que Dante elija; luego eliminar la etapa.
   d. Mover o cerrar los leads del embudo "Clientes · Cobranzas"; luego eliminar el embudo.
   e. Campos nuevos: ocultarlos o eliminarlos (decide Dante; solo contienen datos de la integración).
6. **Verificación:**
   - `node tools/db/fingerprint.js prod backups/<stamp-baseline>-prod/columns.json backups/after-rollback.json`
   - Comparar con el respaldo del paso 2 (`compare`): deben ser IDÉNTICAS (los datos nuevos se conservan).
   - Revisar que Dashboard, Ventas, Cobranzas y Caja muestren lo mismo que antes de revertir.
   - Kommo: `get_pipelines` sin "Cotizar" ni "Clientes · Cobranzas"; `get_webhooks` sin la URL de n8n.

**Último recurso** (solo si lo anterior falla): restaurar las tablas desde `backups/<stamp>-prod/*.json`.
Antes, exportar lo ingresado después de la integración con `backup.js`.
```

- [ ] **Step 2: Ensayar en staging**

1. `node tools/db/fingerprint.js staging backups/<stamp>-prod/columns.json backups/pre-rollback-staging.json`
2. `node tools/db/migrate.js staging supabase/migrations/001_kommo_sync_base.down.sql`
3. Con la BD ya revertida, recargar Guvia (versión actual, override de staging). Expected: carga sin errores de consola y guarda una edición. Esto prueba que app y BD se pueden revertir en cualquier orden. La app del tag es compatible por diseño, porque solo usa sus columnas conocidas.
4. `node tools/db/fingerprint.js staging backups/<stamp>-prod/columns.json backups/post-rollback-staging.json` y `compare` con el paso 1. Expected: `Huellas IDÉNTICAS ✔` (o solo la edición del paso 3; revertirla y comparar de nuevo).
5. Re-aplicar: `node tools/db/migrate.js staging supabase/migrations/001_kommo_sync_base.up.sql`.

- [ ] **Step 3: Commit**

```bash
git add docs/integracion/REVERSION.md
git commit -m "Add tested full-rollback runbook for the Kommo integration"
```

---

### Task 8: Estructura en Kommo (la crea Dante, la verifica Claude)

**Files:**
- Create: `docs/integracion/kommo-ids.json`

**Interfaces:**
- Produces: `kommo-ids.json`, usado por los flujos de n8n en la Fase 1:
```json
{
  "pipelines": {
    "kommo_crm":   { "id": 10934876, "cotizar": 0, "propuesta": 83882932,  "clientes": 96565252 },
    "ghl":         { "id": 13543851, "cotizar": 0, "propuesta": 104873507, "clientes": 104499243 },
    "ux_ui":       { "id": 13543843, "cotizar": 0, "propuesta": 104499211, "clientes": 104499207 },
    "web":         { "id": 10710592, "cotizar": 0, "propuesta": 82122992,  "clientes": 104875143 },
    "campanas":    { "id": 9972207,  "cotizar": 0, "propuesta": 76554923,  "clientes": 100440715 },
    "cobranzas":   { "id": 0, "pendiente": 0, "facturado": 0, "vencido": 0, "won": 142, "lost": 143 }
  },
  "lead_fields": {
    "tipo_servicio": 2793708, "ppto": 2795409, "compra_cliente": 2794077, "fecha_venta": 2798081,
    "historial_compras": 2798929, "tipo_cliente": 2795405, "adquisicion": 2793706,
    "detalle_servicio": 0, "valor_contrato": 0, "estado_pago": 0, "n_cuota": 0,
    "factura": 0, "fecha_vencimiento": 0, "id_guvia": 0
  },
  "company_fields": { "ruc": 2799289, "email": 2792048, "phone": 2792046, "historial_compras": 0 }
}
```
Los `0` se reemplazan por los IDs reales en el Step 3.

- [ ] **Step 1: Guía para Dante (en Kommo, solo agregar)**

1. **Etapa "Cotizar"** en Kommo CRM, Go High Level, Diseño UX/UI, Diseño & Desarrollo Web y Campañas Publicitarias. Ubicarla justo antes de "Propuesta Enviada/Negociación".
2. **Embudo nuevo "Clientes · Cobranzas"** con las etapas `Pendiente`, `Facturado (por cobrar)` y `Vencido`. Logrado con éxito y Ventas perdidas ya vienen por defecto.
3. **Campos de lead nuevos** (Ajustes → Campos → Leads):
   - `Detalle de servicio`: Lista, con la opción inicial "Por definir".
   - `Valor del contrato`: Número.
   - `Estado de pago`: Lista (Pendiente, Facturado, Vencido, Pagado).
   - `N° de cuota`: Texto.
   - `Factura`: Texto.
   - `Fecha de vencimiento`: Fecha.
   - `ID Guvia`: Texto.
4. **Campo de empresa nuevo:** `Historial de compras` (Área de texto).
5. **Bot "[Guvia] Notificación de cobro"** en *Logrado con éxito* del embudo "Clientes · Cobranzas": un solo paso, el widget de Telegram NOVA, con el mismo texto que el bot actual (`🔔 Nueva venta por: S/ [[lead.sale]] el día: [[lead.cf_Fecha de venta]] …`), dirigido a "Dante Trujillo".
6. **NO** crear webhooks todavía.

- [ ] **Step 2: Verificar que no se tocó nada existente**

Llamar `mcp__kommo__get_pipelines`, `mcp__kommo__get_custom_fields` (leads y companies) y `mcp__kommo__get_webhooks`. Comparar con `backups/<stamp>-prod/kommo-structure.json`.
Expected:
- Todos los embudos, etapas y campos previos siguen con el mismo ID y nombre.
- Solo aparecen los elementos nuevos.
- Los webhooks son los mismos 7.

- [ ] **Step 3: Registrar los IDs**

Completar `docs/integracion/kommo-ids.json` con los IDs reales de la respuesta del Step 2.

- [ ] **Step 4: Commit**

```bash
git add docs/integracion/kommo-ids.json
git commit -m "Record Kommo IDs for the Guvia integration structure"
```

---

### Task 9: Aplicar en producción (con confirmación explícita)

**Files:** ninguno nuevo. Despliega los commits de las Tareas 1–8.

**Interfaces:**
- Consumes: todo lo anterior y `docs/integracion/REVERSION.md`.

- [ ] **Step 1: Respaldo y huella frescos de producción**

Run:
```bash
node tools/db/backup.js prod
node tools/db/fingerprint.js prod backups/<stamp-baseline>-prod/columns.json backups/pre-001-prod.json
```

- [ ] **Step 2: Pedir confirmación a Dante**

Mensaje: "Voy a aplicar la migración 001 en la base REAL (solo agrega columnas, tablas y triggers; probada y revertida en staging). ¿Confirmas?" **Esperar un "sí" explícito.**

- [ ] **Step 3: Aplicar y verificar al instante**

Run:
```bash
node tools/db/migrate.js prod supabase/migrations/001_kommo_sync_base.up.sql --confirm-prod
node tools/db/fingerprint.js prod backups/<stamp-baseline>-prod/columns.json backups/post-001-prod.json
node tools/db/fingerprint.js compare backups/pre-001-prod.json backups/post-001-prod.json
```
Expected: `Huellas IDÉNTICAS ✔`. **Si difieren:** ejecutar de inmediato `001_kommo_sync_base.down.sql --confirm-prod`, avisar a Dante y detenerse.

- [ ] **Step 4: Pedir confirmación y publicar la app**

Mensaje: "¿Confirmas que suba los cambios de Guvia a GitHub para que Vercel los publique?" Tras el "sí":
```bash
git push origin master
git push origin pre-integracion-kommo
```

- [ ] **Step 5: Verificación en producción (Dante con su sesión)**

1. Dante abre Guvia en producción.
2. Compara el Dashboard, Ventas y Cobranzas con las capturas de la Tarea 2. Expected: mismos números.
3. Dante edita un comentario de una cotización y guarda. En el navegador de Dante, la pestaña de red muestra un POST a `/rest/v1/quotes` con 1 fila.
4. Run: `node tools/db/fingerprint.js prod ... backups/post-deploy-prod.json` y `compare` con `pre-001-prod.json`. Expected: solo difiere `quotes` por esa edición, o idénticas si Dante la revierte.
5. `integration_settings` sin filas, es decir, la sincronización sigue **apagada**.

- [ ] **Step 6: Cierre de la Fase 0**

Informar a Dante: qué quedó listo, que nada visible cambió, que la sincronización está apagada, y que la Fase 1 (flujos de n8n) es lo siguiente.

---

## Notas para la Fase 1 (descubiertas al planear)

- **Cobranzas que desaparecen sin borrarse en la nube:** `syncQuoteSideEffects` quita del estado las cobranzas de una cotización que deja de estar Ganado, pero **no** las borra en Supabase (no usa `markDeleted`). Por eso el outbox no recibirá un `DELETE`. En la Fase 1, n8n debe tratar "la cotización salió de Ganado" (evento de `quotes`) como la anulación de sus tarjetas de cobro.
- **Primer guardado tras cargar:** puede subir filas con diferencias de normalización (campos que no existen en el objeto local). Es inocuo, pero conviene que la Fase 1 active el kill switch **después** de un ciclo de uso normal, para no encolar ese primer ajuste.
