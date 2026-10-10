# Integración Guvia ⇄ Kommo ⇄ Gmail — Diseño

**Fecha:** 2026-10-09 · **Autor:** Dante Trujillo (con Claude) · **Estado:** borrador para revisión

## 1. Objetivo

Automatizar el proceso comercial de Bandu, que hoy es manual, conectando:

- **Kommo CRM** (cuenta `bandu`): donde llegan y se trabajan los leads.
- **Guvia** (este repo; Supabase `avjthwvppogqezlljksz`): donde se cotiza, se gestionan cobranzas y se reconocen ventas.
- **Gmail corporativo** (Google Workspace): desde donde se envían las cotizaciones.

Orquestación con **n8n** (instancia en Railway `primary-production-fe4e2`, credencial `Bandu_credencial`).

**Éxito =** un lead pasa de Kommo a cotización en Guvia sin re-tipear datos, la cotización sale en PDF con plantilla y queda como borrador en Gmail, y cada cuota cobrada aparece como venta en Kommo y en Guvia en el mismo mes y con el mismo monto.

## 2. Restricciones (no negociables)

1. **Nada existente se rompe ni cambia de comportamiento.** Solo se **agregan** cosas: etapas, campos, embudo, columnas opcionales, tablas y flujos.
2. **Sin reprocesar historia.** Solo aplica a leads movidos a "Cotizar" desde la activación. Las cotizaciones, cobranzas y ventas actuales de Guvia no se tocan.
3. Los bots actuales de Kommo ("Duplicación de Lead (Venta Ganada)" ×5, AXIA, NPS, recordatorios) **no se modifican**.
4. Hay un **interruptor general** (kill switch) que apaga toda la sincronización al instante.
5. Todo se prueba con leads `[PRUEBA]` antes de activarse.

## 3. Hallazgos del análisis (estado actual)

### Kommo
- 5 embudos comerciales con etapas equivalentes: **Kommo CRM** (10934876), **Go High Level** (13543851), **Diseño UX/UI** (13543843), **Diseño & Desarrollo Web** (10710592), **Campañas Publicitarias** (9972207). Ganado = 142, Perdido = 143.
- Etapas relevantes por embudo:

  | Embudo | Propuesta Enviada | Clientes |
  |---|---|---|
  | Kommo CRM | 83882932 | 96565252 |
  | Go High Level | 104873507 | 104499243 |
  | Diseño UX/UI | 104499211 | 104499207 |
  | Web | 82122992 | 104875143 |
  | Campañas | 76554923 | 100440715 |

- **Campos de lead que se reutilizan:** `Tipo de Servicio` 2793708 (select, 15 opciones), `PPTO` 2795409, `Compra de cliente` 2794077, `Fecha de venta` 2798081, `Historial de compras` 2798929, `Tipo de cliente` 2795405, `Adquisición` 2793706, `País/Ciudad` 2793710, `Fecha de adquisión` 2798047.
- **Campos de empresa:** `RUC` 2799289, `Email` 2792048, `Phone` 2792046.
- **Patrón de venta actual:** al mover un lead a *Logrado con éxito*, el bot "Duplicación de Lead (Venta Ganada)" espera 5 s, crea un lead hijo "Auto Acuerdo" en 142 copiando precio, empresa, etiquetas y campos, y antepone una línea a `Historial de compras` con el formato *"{lead} realizó compra por: S/{precio} el día: {fecha}, con PPTO {ppto}. El siguiente producto/servicio: {compra}."*. Luego notifica por Telegram (widget NOVA), limpia precio/PPTO/Compra/Tipo a `0`/`...` y devuelve el lead original a **Clientes**.
- Los webhooks actuales son solo `add_message` (AXIA) y TikTok. No existe ningún webhook de cambio de etapa.

### Guvia
- App JS sin framework (`app.js`) en Vercel con datos en Supabase. El navegador mantiene todo el estado y lo **sube completo (upsert de todas las filas)** en cada sincronización. Los borrados son explícitos (`pendingDeletes`).
- **Cotización:** `Por cotizar → Cotizado → Ganado | Perdido`. Tiene una sola línea (`service` + `subtotal`), además de `hasIgv`, `currency` (PEN/USD) y `cuotas` (1–3).
- **Al pasar a Ganado,** `syncQuoteSideEffects` (en el navegador) genera las **cobranzas**: una por cuota con monto `total × fracción` (con IGV si aplica). Cobranza: `Pendiente → Facturado → Pagado | Vencido`.
- **Venta en Guvia = cuota en estado Pagado**, reconocida en el mes de `paidDate` (`recognizedSales()`, vista Ventas).
- **Servicios:** lista simple de nombres (`state.services`). **Categorías** propias de Guvia (`CRM`, `Diseño`, …).
- **Tipo de cambio:** ya existe `api/tipocambio.js` (SUNAT vía apis.net.pe).

## 4. Arquitectura

```
Kommo ──webhook (cambio de etapa / empresa / contacto)──► n8n ──service key──► Supabase (Guvia)
Guvia (navegador) ──upsert──► Supabase ──trigger → kommo_outbox──► webhook BD ──► n8n ──API v4──► Kommo
Guvia "Enviar cotización" ──► Vercel /api/enviar-cotizacion (verifica sesión) ──► n8n
      n8n ──► Gotenberg (Railway, HTML→PDF) ──► Supabase Storage ──► Gmail (borrador) + Kommo (nota)
```

- **n8n es el único que habla con Kommo y con Gmail.** Las claves (service key de Supabase, token de Kommo, OAuth de Gmail) viven solo como credenciales de n8n o variables de entorno de Vercel. Nunca en el navegador.
- **Bandeja de salida (outbox) en Postgres.** Como Guvia sube todas las filas en cada sincronización, un webhook directo sobre `quotes`/`collections` se dispararía con cada guardado. Por eso, un **trigger** compara `OLD` y `NEW` y solo inserta en `kommo_outbox` cuando cambian campos relevantes (estado, montos, cuotas, fechas, factura) o cuando se borra una fila. n8n consume `kommo_outbox`.
- **Kill switch:** fila `settings.kommo_sync_enabled`. Todos los flujos de n8n la leen primero y no hacen nada si está en `false`.

## 5. Modelo de datos (solo agregados, todo opcional/nullable)

**Columnas nuevas**
- `clients`: `kommo_company_id`, `kommo_contact_id`.
- `leads`: `kommo_lead_id`, `kommo_pipeline_id`.
- `quotes`:
  - `kommo_lead_id`, `service_id` (→ catálogo).
  - `items jsonb`, `discount_label`, `discount_amount`, `valid_days`, `terms jsonb`.
  - `pdf_path`, `sent_at`, `gmail_draft_id`.
- `collections`: `kommo_lead_id` (tarjeta de cuota), `fx_rate`, `fx_source` (`SUNAT`|`Kambista`|`SUNAT-fallback`), `amount_pen`.
- `clients`, `leads`, `quotes`, `collections`: `updated_at` (default `now()` + trigger) y `sync_source` (`guvia`|`kommo`).

**Tablas nuevas**
- `service_catalog`:
  - `id`, `user_id`, `name` (detalle), `kommo_category` (valor de `Tipo de Servicio`), `kommo_enum_id` (opción en "Detalle de servicio"), `active`.
  - `template jsonb`: ítems, descuento, moneda, IGV, cuotas, consideraciones, cronograma, validez.
- `kommo_outbox`: `id`, `entity`, `entity_id`, `op`, `payload jsonb`, `status` (`pending`|`done`|`error`), `attempts`, `error`, `created_at`.
- `sync_log`: `id`, `direction`, `entity`, `entity_id`, `kommo_id`, `result`, `detail`, `created_at`. Es la auditoría visible.

**Compatibilidad:** una cotización sin `items` usa su `subtotal` como hoy. Una con `items` calcula `subtotal = Σ ítems − descuento`. `calcQuote`, las cobranzas, las detracciones y Caja no cambian de fórmula.

## 6. Cambios en Kommo (solo agregados)

1. **Etapa "Cotizar"** en los 5 embudos comerciales, justo antes de "Propuesta Enviada/Negociación".
2. **Embudo nuevo "Clientes · Cobranzas"** con las etapas: `Pendiente` → `Facturado (por cobrar)` → `Vencido` → **`Logrado con éxito` (142)** · `Ventas perdidas` (143).
3. **Campos de lead nuevos:**
   - `Detalle de servicio` (select, sincronizado con el catálogo).
   - `Valor del contrato` (numérico).
   - `Estado de pago` (select: Pendiente/Facturado/Vencido/Pagado).
   - `N° de cuota` (texto, p. ej. "1/2").
   - `Factura` (texto).
   - `Fecha de vencimiento` (fecha).
   - `ID Guvia` (texto).
4. **Campo de empresa nuevo:** `Historial de compras` (textarea).
5. **Bot mínimo** en *Logrado con éxito* del embudo de Cobranzas: **solo** la notificación de Telegram (NOVA), con el mismo texto que el bot actual.
6. **Un webhook de cuenta** hacia n8n con los eventos: cambio de etapa de lead, actualización de empresa y actualización de contacto.

## 7. Flujos

### F1 — Lead → "Cotizar" → Guvia
1. El webhook recibe el cambio de etapa. Si no es una etapa "Cotizar", termina.
2. n8n lee el lead con su empresa y contacto principal.
3. **Cliente:**
   - Busca en `clients` por `kommo_company_id`, luego por RUC, luego por email.
   - Si lo encuentra, lo vincula. Si no, lo crea:
     - **Con empresa:** razón social + RUC + email + teléfono de la empresa; contacto = nombre del contacto.
     - **Sin empresa:** Persona Natural con los datos del contacto (`Tipo de cliente`).
4. **Lead en Guvia:** lo crea o actualiza (`kommo_lead_id`), con `service`, `source` ← `Adquisición` y `owner`.
5. **Cotización:** si el lead ya tiene una cotización activa (no Ganado/Perdido), no crea otra. Si no, crea una en **Por cotizar** con `leadId`, cliente y `service_id` ← `Detalle de servicio`, y la prellena con su plantilla.
6. Agrega una nota en Kommo: "Cotización creada en Guvia · <enlace>". Registra el resultado en `sync_log`.

### F2 — Ganado / Perdido de la oportunidad (bidireccional)
- **Guvia → Kommo:** cuando `quotes.status` cambia a Ganado:
  - El lead original pasa a **Clientes** de su embudo y se llenan `Valor del contrato` (total con IGV, en PEN), `PPTO` y `Detalle de servicio`.
  - **No se mueve a 142**, para no contar el total dos veces ni disparar el bot de duplicación.
- **Guvia → Kommo:** cuando pasa a Perdido, el lead va a 143.
- **Kommo → Guvia:** si un lead vinculado entra a Clientes o a 142 por acción manual, la cotización pasa a Ganado (`wonDate` = hoy). Si entra a 143, pasa a Perdido. Las cobranzas las genera Guvia cuando se abre, por su lógica actual (ver §10).
- **Venta manual en Kommo:** si se movió a 142 a mano con precio, el bot actual crea su "Auto Acuerdo" como siempre. n8n marca la cotización como Ganado y vincula la **cuota 1** a ese "Auto Acuerdo" (`collections.kommo_lead_id` = id del hijo) en lugar de crearle una tarjeta. Cuando la cuota 1 se paga en Guvia, solo se actualizan `Estado de pago` y `Factura` de ese hijo: no se crea otra venta.

### F3 — Ciclo de las cuotas (Guvia manda; Kommo refleja)
| Evento en Guvia | Efecto en Kommo (embudo "Clientes · Cobranzas") |
|---|---|
| Se crea la cobranza (cotización Ganado) | Tarjeta `PPTO {código} · Pago {n}/{N} · {cliente}` en **Pendiente**, vinculada a la empresa y al contacto, con monto estimado, `Fecha de vencimiento`, `N° de cuota`, `PPTO`, `Detalle de servicio`, `Tipo de Servicio` e `ID Guvia`. |
| Pasa a **Facturado** | Etapa **Facturado (por cobrar)** + `Factura`. |
| Pasa a **Vencido** | Etapa **Vencido**. |
| Pasa a **Pagado** | Etapa **Logrado con éxito**; precio = monto final; `Fecha de venta` = `paidDate`; `Estado de pago` = Pagado. Se antepone una línea a `Historial de compras` del lead original **y** de la empresa, con el formato del bot actual. Telegram lo envía el bot mínimo. |
| Cambia el monto (cotización editada) | Se actualiza el precio de las tarjetas que no están pagadas. |
| Se borra la cobranza | La tarjeta va a **Ventas perdidas** con la nota "Cobro anulado en Guvia". Nunca se borra. |

- **Monto en Kommo:** total de la cuota **con IGV** si `hasIgv`, o el monto tal cual si no. Siempre **en soles**.
- **Tipo de cambio (cuotas en USD):**
  - **Con IGV:** TC **SUNAT venta** del día de pago.
  - **Sin IGV:** TC de **Kambista** del día de pago. Si Kambista falla, se usa SUNAT y se registra `fx_source = SUNAT-fallback`.
  - **Mientras la cuota está pendiente:** el monto es estimado con el TC del día de creación.
  - **Nota en la tarjeta:** "Original USD {monto} · TC {tc} ({fuente}) = S/ {monto}".
- **Kommo → Guvia en cuotas:** no aplica. Las tarjetas de cuota son un reflejo, porque la factura y la contabilidad viven en Guvia.

### F4 — Datos de contacto (bidireccional, gana el último cambio)
Se sincronizan razón social, RUC, email y teléfono entre `clients` y la empresa de Kommo, y el nombre del contacto entre `clients.contact` y el contacto principal. Se compara `updated_at` y solo se escribe si el valor es distinto.

### F5 — Catálogo de servicios → Kommo
Al crear o renombrar un servicio en `service_catalog`, n8n agrega o renombra su opción en `Detalle de servicio`. **Nunca borra opciones.** Un servicio desactivado se renombra con el prefijo "(inactivo)".

### F6 — Enviar cotización
1. En Guvia, el botón **"Enviar cotización"** llama a `/api/enviar-cotizacion` (Vercel). Ese endpoint verifica el JWT de Supabase del usuario y reenvía a n8n con un secreto.
2. n8n:
   1. Arma el HTML de la plantilla con los datos de la cotización.
   2. Llama a Gotenberg y obtiene el PDF.
   3. Guarda el PDF en Supabase Storage (`quotes/{id}/{código}.pdf`, privado).
   4. Crea un **borrador** en Gmail: para = email del cliente; asunto "Propuesta económica {código} · {servicio} · {cliente}"; cuerpo = plantilla de correo de Configuración; PDF adjunto. **No lo envía.**
   5. Agrega en Kommo una nota con el PDF adjunto (o con enlace, si el adjunto falla).
   6. Llena `PPTO`, `Detalle de servicio` y precio (total con IGV, en PEN).
   7. Mueve el lead a **Propuesta Enviada/Negociación**.
3. En Guvia, la cotización pasa a **Cotizado** y se guardan `pdf_path`, `sent_at` y `gmail_draft_id`. Se muestra el botón **"Abrir borrador en Gmail"**.

## 8. Plantilla PDF

- **Estilo:** el de la referencia "Creators Latam N.º 131" (una página, sans, acento con degradado, tarjetas, bloque de inversión destacado, secciones numeradas, pie oscuro), con la marca Bandu.
- **Contenido:** el de la cotización actual BANDU+PPTO+0375.
  - **Encabezado:** código PPTO, fecha de emisión y fecha fin de validez.
  - **Datos de Bandu:** razón social, RUC, quién cotiza, correo y celular.
  - **Tarjetas:** Cliente (razón social y RUC) · Servicio · Modelo de pago (N cuotas).
  - **Ítems:** servicio, descripción y beneficios, P.U., costo fijo, cantidad, meses, subtotal y observaciones.
  - **Totales:** subtotal, descuento con nombre, subtotal neto, IGV 18% y total. Si es USD, la equivalencia referencial en soles.
  - **Consideraciones y términos:** validez, cronograma de pagos, información bancaria según moneda (cuenta, CCI, detracciones), aceptación con firma y sello, y pie con datos de contacto.
- **Generación:** la misma plantilla HTML sirve para la vista previa en vivo en Guvia y para el PDF en Gotenberg, así lo que ves es lo que sale.

## 9. Cambios en Guvia (la app)

1. **Sincronización segura:**
   - Solo se suben las filas modificadas localmente (*dirty tracking*), en vez de la tabla completa.
   - Suscripción **Realtime** de Supabase para recibir lo que escribe n8n sin recargar.
   - Se mantiene la protección actual de borrados.
2. **Catálogo de servicios** en Configuración, que reemplaza la lista simple. Los nombres actuales se migran como entradas sin plantilla.
3. **Editor de cotización:**
   - Ítems, descuento y términos prellenados desde la plantilla.
   - Vista previa del PDF.
   - Opción **"Guardar como plantilla"**.
4. **Botón "Enviar cotización"** y **"Abrir borrador en Gmail"**.
5. **Indicadores de Kommo:**
   - Enlace "Ver en Kommo" en clientes, leads, cotizaciones y cobranzas.
   - Panel simple de `sync_log` con los últimos eventos y errores.
6. **Configuración:** plantilla de correo, datos de Bandu para el PDF e interruptor de sincronización.

## 10. Decisiones y riesgos

- **Las cobranzas se siguen generando en el navegador** (`syncQuoteSideEffects`), para no tocar esa lógica. Consecuencia: si la cotización se gana desde Kommo, las tarjetas de cuota aparecen cuando Guvia se abre. Es un retraso aceptable. Mover esa lógica a la base de datos queda como mejora futura.
- **Kambista no tiene API pública oficial.** Se usa el endpoint de su calculadora web, con caída a SUNAT. Hay que verificarlo al inicio (spike).
- **Adjuntos en notas de Kommo:** requieren subir el archivo a Kommo Drive. Si se complica, se usa una nota con enlace firmado de larga duración.
- **Bucles:** cada flujo compara antes de escribir, el outbox ignora cambios con `sync_source = kommo`, y el webhook de Kommo ignora los leads hijos "Auto Acuerdo" y las tarjetas del embudo de Cobranzas.
- **Concurrencia en Kommo:** n8n procesa los eventos de un mismo lead en serie (cola por `kommo_lead_id`).
- **Acceso:** el proyecto Supabase de Guvia no está en la cuenta conectada a Claude; hay que conectarlo para implementar.

## 11. Fases de entrega

| Fase | Contenido | Resultado visible |
|---|---|---|
| **0. Base segura** | Sincronización por filas modificadas + Realtime; columnas y tablas nuevas; triggers del outbox; `sync_log`; kill switch. En Kommo: etapa Cotizar, campos, embudo Cobranzas y bot de Telegram, todo sin webhook activo. | Nada cambia para el usuario. |
| **1. Sincronización** | F1, F2, F3, F4 en n8n + indicadores en Guvia. | Lead → Cotizar → Guvia; ganado ⇄; cuotas como tarjetas; ventas al pagar. |
| **2. Catálogo y PDF** | `service_catalog`, F5, ítems, plantillas, vista previa, Gotenberg. | Cotizar desde plantilla; PDF con el nuevo diseño. |
| **3. Envío** | F6: borrador en Gmail, nota en Kommo, cambio de etapa. | Un clic → borrador listo para enviar. |

Cada fase se valida con leads `[PRUEBA]` y un cliente de prueba antes de activar la siguiente.

## 12. Pruebas

- **Por flujo de n8n:** ejecución con datos de prueba (pin data) y luego con un lead `[PRUEBA]` real.
- **Escenarios obligatorios:**
  - Cliente nuevo vs. existente (por RUC y por email).
  - Persona natural sin empresa.
  - Cotización en PEN con IGV / en USD con IGV (SUNAT) / en USD sin IGV (Kambista).
  - 1, 2 y 3 cuotas.
  - Ganado en Guvia vs. en Kommo.
  - Venta manual en Kommo + pago posterior en Guvia (sin duplicado).
  - Edición de monto después de ganada.
  - Cobranza anulada.
  - Kill switch apagado.
- **Regresión en Guvia:** totales de Dashboard, Ventas, Cobranzas, Caja y Contabilidad idénticos antes y después de la Fase 0, con los datos reales.
