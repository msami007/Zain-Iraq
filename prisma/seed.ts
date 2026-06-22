import { PrismaClient, UserRole, UserStatus, TenantStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

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

const pool = new pg.Pool({
  connectionString: getDirectDatabaseUrl(process.env.DATABASE_URL),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Clean existing records (in reverse dependency order)
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.chatCase.deleteMany();
  await prisma.searchQuery.deleteMany();
  await prisma.guestLink.deleteMany();
  await prisma.articleFeedback.deleteMany();
  await prisma.knowledgeGap.deleteMany();
  await prisma.articleStatusHistory.deleteMany();
  await prisma.articleVersion.deleteMany();
  await prisma.articleVariant.deleteMany();
  await prisma.articleTag.deleteMany();
  await prisma.articleTeam.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.userTeam.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 2. Hash password for all default accounts
  const passwordHash = bcrypt.hashSync("password123", 10);

  // 3. Create Tenants
  const zainTenant = await prisma.tenant.create({
    data: {
      name: "Zain Iraq",
      slug: "zain",
      status: TenantStatus.Active,
      branding: { primaryColor: "#8E24AA", logoUrl: "/branding/zain-logo.png" },
    },
  });

  const oodiTenant = await prisma.tenant.create({
    data: {
      name: "OODI",
      slug: "oodi",
      status: TenantStatus.Active,
      branding: { primaryColor: "#FFD600", logoUrl: "/branding/oodi-logo.png" },
    },
  });

  console.log("Tenants created: Zain and OODI.");

  // 4. Create Users under Zain
  const superAdmin = await prisma.user.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Salman (Super Admin)",
      email: "Salman@zain.com",
      password_hash: passwordHash,
      role: UserRole.SuperAdmin,
      status: UserStatus.Active,
    },
  });

  // Update Zain tenant created_by field to reference SuperAdmin
  await prisma.tenant.update({
    where: { id: zainTenant.id },
    data: { created_by: superAdmin.id },
  });

  // Update OODI tenant created_by field to reference SuperAdmin
  await prisma.tenant.update({
    where: { id: oodiTenant.id },
    data: { created_by: superAdmin.id },
  });

  const admin1Zain = await prisma.user.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Admin One (Zain)",
      email: "admin1.zain@zain.com",
      password_hash: passwordHash,
      role: UserRole.Admin,
      status: UserStatus.Active,
    },
  });

  const admin2Zain = await prisma.user.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Admin Two (Zain)",
      email: "admin2.zain@zain.com",
      password_hash: passwordHash,
      role: UserRole.Admin,
      status: UserStatus.Active,
    },
  });

  const agent1Zain = await prisma.user.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Agent One (Zain)",
      email: "agent1.zain@zain.com",
      password_hash: passwordHash,
      role: UserRole.Agent,
      status: UserStatus.Active,
    },
  });

  const agent2Zain = await prisma.user.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Agent Two (Zain)",
      email: "agent2.zain@zain.com",
      password_hash: passwordHash,
      role: UserRole.Agent,
      status: UserStatus.Active,
    },
  });

  console.log("Zain users created.");

  // 5. Create Users under OODI
  const adminOodi = await prisma.user.create({
    data: {
      tenant_id: oodiTenant.id,
      name: "Admin (OODI)",
      email: "admin.oodi@oodi.com",
      password_hash: passwordHash,
      role: UserRole.Admin,
      status: UserStatus.Active,
    },
  });

  const agentOodi = await prisma.user.create({
    data: {
      tenant_id: oodiTenant.id,
      name: "Agent (OODI)",
      email: "agent.oodi@oodi.com",
      password_hash: passwordHash,
      role: UserRole.Agent,
      status: UserStatus.Active,
    },
  });

  console.log("OODI users created.");

  // 6. Create default teams/categories for demo/testing
  const mobileTeamZain = await prisma.team.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Zain Mobile Team",
    },
  });

  const broadbandTeamZain = await prisma.team.create({
    data: {
      tenant_id: zainTenant.id,
      name: "Zain Broadband Team",
    },
  });

  const teamOodi = await prisma.team.create({
    data: {
      tenant_id: oodiTenant.id,
      name: "OODI Customer Support",
    },
  });

  // Assign agents to teams
  await prisma.userTeam.create({
    data: {
      user_id: agent1Zain.id,
      team_id: mobileTeamZain.id,
      tenant_id: zainTenant.id,
    },
  });

  await prisma.userTeam.create({
    data: {
      user_id: agent2Zain.id,
      team_id: broadbandTeamZain.id,
      tenant_id: zainTenant.id,
    },
  });

  await prisma.userTeam.create({
    data: {
      user_id: agentOodi.id,
      team_id: teamOodi.id,
      tenant_id: oodiTenant.id,
    },
  });

  // 7. Seed sample categories and articles to demonstrate tenant isolation
  const categoryZain = await prisma.category.create({
    data: {
      tenant_id: zainTenant.id,
      name: "General Support",
      slug: "general-support",
    },
  });

  await prisma.article.create({
    data: {
      tenant_id: zainTenant.id,
      title: "Zain SIM Card Activation Guide",
      slug: "sim-activation-guide",
      category_id: categoryZain.id,
      status: "Published",
      owner_id: admin1Zain.id,
      author_id: admin1Zain.id,
    },
  });

  const categoryOodi = await prisma.category.create({
    data: {
      tenant_id: oodiTenant.id,
      name: "App Settings",
      slug: "app-settings",
    },
  });

  await prisma.article.create({
    data: {
      tenant_id: oodiTenant.id,
      title: "OODI Digital eSIM Setup",
      slug: "esim-setup",
      category_id: categoryOodi.id,
      status: "Published",
      owner_id: adminOodi.id,
      author_id: adminOodi.id,
    },
  });

  console.log("Teams seeded and mapped.");
  console.log("Database seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
