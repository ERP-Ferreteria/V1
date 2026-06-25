# Guía de despliegue — Ferremax

Tres piezas desplegables:

| Pieza | Qué es | Dónde conviene | Necesita |
|---|---|---|---|
| `mvp/` | Demo clickable (white-label en navegador) | **Vercel** (estático) | — |
| `apps/api` | Backend SaaS multi-tenant | **Render** / Railway / Fly | PostgreSQL |
| `apps/web-*` | Storefront + Admin (en construcción) | Vercel | API desplegado |

---

## 1. Correr todo en local (un comando)

```bash
docker compose up --build
```

Levanta PostgreSQL + API en `http://localhost:4000`, sincroniza el esquema,
aplica RLS y siembra el tenant demo. Probar:

```bash
# Login del owner demo
curl -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"slug":"el-tornillo","email":"admin@eltornillo.com","password":"demo1234"}'
```

Devuelve `accessToken` → usarlo como `Authorization: Bearer <token>` contra `/api/*`.

---

## 2. Frontend (MVP) en Vercel

1. vercel.com → **Add New → Project → Import** el repo `ERP-Ferreteria/V1`.
2. **Root Directory → `mvp`** (lo demás se autodetecta: Vite).
3. **Deploy** → URL `https://<algo>.vercel.app`.
4. Cada `git push` a `main` redepliega solo.

> Si Vercel no ve el repo: un **owner** de la org `ERP-Ferreteria` debe autorizar
> la GitHub App de Vercel a nivel organización (una vez).

---

## 3. Backend (`apps/api`) en Render

**Opción A — Blueprint (automático):**
render.com → **New → Blueprint** → conectar el repo → Render lee
[`render.yaml`](render.yaml) y crea la base + el servicio web con secretos generados.

**Opción B — Manual:**
1. Crear un **PostgreSQL** en Render (o Neon/Supabase) y copiar su `DATABASE_URL`.
2. **New → Web Service** → runtime **Docker**, Dockerfile `apps/api/Dockerfile`,
   context = raíz del repo.
3. Variables de entorno: ver [`.env.example`](.env.example)
   (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ROOT_DOMAIN`).
4. Deploy. El arranque hace `db push` + RLS + seed automáticamente.

### Base de datos gestionada (recomendado para producción)
- **Neon** o **Supabase**: Postgres serverless con free tier. Pegar su cadena en
  `DATABASE_URL`. Importante: crear el rol de la app **sin** `BYPASSRLS` para que
  las políticas se apliquen (un superuser ignora RLS).

---

## 4. Conectar el MVP al backend real (modo cloud)

El MVP funciona en **dos modos** (pill "Demo"/"Conectado" en el header):

- **Demo** (default): datos en memoria. Es lo que está deployado hoy.
- **Cloud**: habla con la API real. Se activa con una variable de entorno en Vercel:

```bash
# Project → Settings → Environment Variables
VITE_API_URL = https://ferremax-api.onrender.com   # URL del backend desplegado
```

Con eso, al cargar la app:
- `cargarDesdeBackend()` hidrata catálogo + órdenes desde `/api/inventory/tree` y `/api/orders`.
- El **alta de productos** del /admin crea contra `POST /api/inventory/products`
  (acepta nombres categoria/medida/material y upsertea la jerarquía).
- El cliente API (`mvp/src/api/api.js`) maneja login, token y refresh automático.

> Falta el formulario de login en la UI del MVP (hoy el token se setea vía
> `api.auth.login()`); es el último gancho para el flujo cloud completo.

---

## Checklist de producción

- [ ] Secretos JWT largos y rotados (no los de ejemplo).
- [ ] Rol de DB sin `BYPASSRLS`.
- [ ] `prisma migrate` versionado en vez de `db push` (cuando el esquema se estabilice).
- [ ] Backups automáticos de la base.
- [ ] Dominio + wildcard `*.ferremax.app` apuntando al frontend para subdominios por tenant.
- [ ] CORS restringido al dominio real (hoy `origin: true`).
