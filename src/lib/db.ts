import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDirectDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith("prisma+postgres://")) {
    try {
      const urlObj = new URL(url);
      const apiKey = urlObj.searchParams.get("api_key");
      if (apiKey) {
        const decoded = Buffer.from(apiKey, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.databaseUrl) {
          return parsed.databaseUrl;
        }
      }
    } catch (e) {
      console.error("Failed to parse prisma+postgres API key:", e);
    }
  }
  return url;
}

// Create a connection pool and initialize the driver adapter
const pool = new pg.Pool({
  connectionString: getDirectDatabaseUrl(process.env.DATABASE_URL) || "postgresql://postgres:password@localhost:5432/zain_kb",
});
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const TENANT_MODELS = [
  "Team",
  "User",
  "UserTeam",
  "Category",
  "Tag",
  "Article",
  "ArticleTag",
  "ArticleTeam",
  "KnowledgeGap",
  "ArticleFeedback",
  "GuestLink",
  "SearchQuery",
  "ChatCase",
  "Announcement",
  "AuditLog",
];

function isTenantModel(model: string): boolean {
  return TENANT_MODELS.includes(model);
}

// A function to get a Prisma Client instance scoped to a specific tenant_id
export function getTenantDb(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (isTenantModel(model)) {
            // Map findUnique to findFirst to allow appending the tenant_id filter safely
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
            return (prisma as any)[model].findFirst(args);
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).data = { ...(args as any).data, tenant_id: tenantId };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
            (args as any).data = { ...(args as any).data, tenant_id: tenantId };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
            (args as any).data = { ...(args as any).data, tenant_id: tenantId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (isTenantModel(model)) {
            (args as any).where = { ...(args as any).where, tenant_id: tenantId };
          }
          return query(args);
        },
      },
    },
  });
}
