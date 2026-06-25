-- ════════════════════════════════════════════════════════════════════
--  Row-Level Security — defensa en profundidad multi-tenant
--  Aunque un controlador olvide filtrar por tenantId, Postgres bloquea
--  el acceso cruzado. La app setea app.current_tenant por request/transacción
--  (ver apps/api/src/core/prisma.ts).
--  Ejecutar DESPUÉS de `prisma migrate` con un rol que NO sea superuser
--  (los superuser ignoran RLS).
-- ════════════════════════════════════════════════════════════════════

-- Rol de aplicación: NO bypass de RLS.
-- CREATE ROLE app_user NOLOGIN;  GRANT app_user TO ferremax_api;
-- ALTER ROLE ferremax_api NOBYPASSRLS;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'Tenant','TenantBranding','Subscription','User','Role','RefreshToken',
    'FunctionalCategory','Supplier','Product','Order'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Política directa: tablas con columna tenantId.
CREATE POLICY tenant_isolation ON "TenantBranding"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "Subscription"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "Role"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "FunctionalCategory"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "Supplier"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "Product"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_isolation ON "Order"
  USING ("tenantId" = current_setting('app.current_tenant', true)::uuid);

-- Tenant: cada inquilino solo se ve a sí mismo (el panel SaaS usa una conexión admin aparte).
CREATE POLICY tenant_self ON "Tenant"
  USING (id = current_setting('app.current_tenant', true)::uuid);

-- Hijas sin tenantId directo: heredan vía la FK al padre ya aislado.
CREATE POLICY tenant_via_user ON "RefreshToken"
  USING (EXISTS (SELECT 1 FROM "User" u
                 WHERE u.id = "RefreshToken"."userId"
                   AND u."tenantId" = current_setting('app.current_tenant', true)::uuid));

-- Índice parcial recomendado para el reporte "Artículos a Comprar".
CREATE INDEX IF NOT EXISTS idx_product_restock
  ON "Product" ("tenantId")
  WHERE active = TRUE;
