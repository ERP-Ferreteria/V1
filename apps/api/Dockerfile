# API Ferremax — imagen de producción. Context de build = raíz del monorepo.
FROM node:20-alpine

# psql para aplicar las políticas RLS en el arranque.
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Dependencias (capa cacheable).
COPY apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
RUN npm install

# Código del API + esquema Prisma compartido.
WORKDIR /app
COPY packages/db ./packages/db
COPY apps/api ./apps/api
WORKDIR /app/apps/api

# Generar el cliente Prisma desde el esquema compartido.
RUN npx prisma generate --schema ../../packages/db/schema.prisma

EXPOSE 4000

# Arranque: sincroniza schema → aplica RLS → seed (idempotente) → server.
CMD sh -c "\
  npx prisma db push --schema ../../packages/db/schema.prisma --skip-generate --accept-data-loss && \
  psql \"$DATABASE_URL\" -f ../../packages/db/migrations/0001_rls_policies.sql && \
  npx tsx src/scripts/seed.ts || true; \
  npx tsx src/app.ts"
