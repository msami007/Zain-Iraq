import "dotenv/config";
import { PrismaClient, UserRole, UserStatus, TenantStatus, Language, ArticleStatus, Visibility, Channel } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

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

const connectionString = getDirectDatabaseUrl(process.env.DATABASE_URL);
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && connectionString.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper to normalize and capitalize
function capitalize(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function main() {
  console.log("Seeding database (non-destructive mode)...");

  // 1. Hash password for all default accounts
  const passwordHash = bcrypt.hashSync("password123", 10);

  // 2. Create/Find Tenants
  let zainTenant = await prisma.tenant.findFirst({
    where: { slug: "zain" }
  });

  if (!zainTenant) {
    zainTenant = await prisma.tenant.create({
      data: {
        name: "Zain Iraq",
        slug: "zain",
        status: TenantStatus.Active,
        branding: { primaryColor: "#8E24AA", logoUrl: "/branding/zain-logo.png" },
      },
    });
    console.log("Zain tenant created.");
  } else {
    console.log("Zain tenant already exists.");
  }

  let oodiTenant = await prisma.tenant.findFirst({
    where: { slug: "oodi" }
  });

  if (!oodiTenant) {
    oodiTenant = await prisma.tenant.create({
      data: {
        name: "OODI",
        slug: "oodi",
        status: TenantStatus.Active,
        branding: { primaryColor: "#FFD600", logoUrl: "/branding/oodi-logo.png" },
      },
    });
    console.log("OODI tenant created.");
  } else {
    console.log("OODI tenant already exists.");
  }

  // 3. Create/Find Users under Zain
  let superAdmin = await prisma.user.findFirst({
    where: { tenant_id: zainTenant.id, email: "Salman@zain.com" }
  });

  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Salman (Super Admin)",
        email: "Salman@zain.com",
        password_hash: passwordHash,
        role: UserRole.SuperAdmin,
        status: UserStatus.Active,
      },
    });
    console.log("Super Admin user created.");
  } else {
    console.log("Super Admin user already exists.");
  }

  // Update Zain tenant created_by field to reference SuperAdmin
  if (zainTenant.created_by !== superAdmin.id) {
    zainTenant = await prisma.tenant.update({
      where: { id: zainTenant.id },
      data: { created_by: superAdmin.id },
    });
  }

  // Update OODI tenant created_by field to reference SuperAdmin
  if (oodiTenant.created_by !== superAdmin.id) {
    oodiTenant = await prisma.tenant.update({
      where: { id: oodiTenant.id },
      data: { created_by: superAdmin.id },
    });
  }

  let admin1Zain = await prisma.user.findFirst({
    where: { tenant_id: zainTenant.id, email: "admin1.zain@zain.com" }
  });

  if (!admin1Zain) {
    admin1Zain = await prisma.user.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Admin One (Zain)",
        email: "admin1.zain@zain.com",
        password_hash: passwordHash,
        role: UserRole.Admin,
        status: UserStatus.Active,
      },
    });
    console.log("Admin One (Zain) created.");
  }

  let admin2Zain = await prisma.user.findFirst({
    where: { tenant_id: zainTenant.id, email: "admin2.zain@zain.com" }
  });

  if (!admin2Zain) {
    admin2Zain = await prisma.user.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Admin Two (Zain)",
        email: "admin2.zain@zain.com",
        password_hash: passwordHash,
        role: UserRole.Admin,
        status: UserStatus.Active,
      },
    });
    console.log("Admin Two (Zain) created.");
  }

  let agent1Zain = await prisma.user.findFirst({
    where: { tenant_id: zainTenant.id, email: "agent1.zain@zain.com" }
  });

  if (!agent1Zain) {
    agent1Zain = await prisma.user.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Agent One (Zain)",
        email: "agent1.zain@zain.com",
        password_hash: passwordHash,
        role: UserRole.Agent,
        status: UserStatus.Active,
      },
    });
    console.log("Agent One (Zain) created.");
  }

  let agent2Zain = await prisma.user.findFirst({
    where: { tenant_id: zainTenant.id, email: "agent2.zain@zain.com" }
  });

  if (!agent2Zain) {
    agent2Zain = await prisma.user.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Agent Two (Zain)",
        email: "agent2.zain@zain.com",
        password_hash: passwordHash,
        role: UserRole.Agent,
        status: UserStatus.Active,
      },
    });
    console.log("Agent Two (Zain) created.");
  }

  // 4. Create/Find Users under OODI
  let adminOodi = await prisma.user.findFirst({
    where: { tenant_id: oodiTenant.id, email: "admin.oodi@oodi.com" }
  });

  if (!adminOodi) {
    adminOodi = await prisma.user.create({
      data: {
        tenant_id: oodiTenant.id,
        name: "Admin (OODI)",
        email: "admin.oodi@oodi.com",
        password_hash: passwordHash,
        role: UserRole.Admin,
        status: UserStatus.Active,
      },
    });
    console.log("Admin (OODI) created.");
  }

  let agentOodi = await prisma.user.findFirst({
    where: { tenant_id: oodiTenant.id, email: "agent.oodi@oodi.com" }
  });

  if (!agentOodi) {
    agentOodi = await prisma.user.create({
      data: {
        tenant_id: oodiTenant.id,
        name: "Agent (OODI)",
        email: "agent.oodi@oodi.com",
        password_hash: passwordHash,
        role: UserRole.Agent,
        status: UserStatus.Active,
      },
    });
    console.log("Agent (OODI) created.");
  }

  // 5. Create/Find Teams
  let mobileTeamZain = await prisma.team.findFirst({
    where: { tenant_id: zainTenant.id, name: "Zain Mobile Team" }
  });

  if (!mobileTeamZain) {
    mobileTeamZain = await prisma.team.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Zain Mobile Team",
      },
    });
  }

  let broadbandTeamZain = await prisma.team.findFirst({
    where: { tenant_id: zainTenant.id, name: "Zain Broadband Team" }
  });

  if (!broadbandTeamZain) {
    broadbandTeamZain = await prisma.team.create({
      data: {
        tenant_id: zainTenant.id,
        name: "Zain Broadband Team",
      },
    });
  }

  let teamOodi = await prisma.team.findFirst({
    where: { tenant_id: oodiTenant.id, name: "OODI Customer Support" }
  });

  if (!teamOodi) {
    teamOodi = await prisma.team.create({
      data: {
        tenant_id: oodiTenant.id,
        name: "OODI Customer Support",
      },
    });
  }

  // Assign agents to teams if not already assigned
  const userTeam1Exists = await prisma.userTeam.findFirst({
    where: { user_id: agent1Zain.id, team_id: mobileTeamZain.id }
  });
  if (!userTeam1Exists) {
    await prisma.userTeam.create({
      data: {
        user_id: agent1Zain.id,
        team_id: mobileTeamZain.id,
        tenant_id: zainTenant.id,
      },
    });
  }

  const userTeam2Exists = await prisma.userTeam.findFirst({
    where: { user_id: agent2Zain.id, team_id: broadbandTeamZain.id }
  });
  if (!userTeam2Exists) {
    await prisma.userTeam.create({
      data: {
        user_id: agent2Zain.id,
        team_id: broadbandTeamZain.id,
        tenant_id: zainTenant.id,
      },
    });
  }

  const userTeamOodiExists = await prisma.userTeam.findFirst({
    where: { user_id: agentOodi.id, team_id: teamOodi.id }
  });
  if (!userTeamOodiExists) {
    await prisma.userTeam.create({
      data: {
        user_id: agentOodi.id,
        team_id: teamOodi.id,
        tenant_id: oodiTenant.id,
      },
    });
  }

  console.log("Teams and mapping verified.");

  // 6. Seed categories and articles for Zain from JSON file
  const jsonPath = path.join(process.cwd(), "15f6d41e-b794-41fd-8748-82622bcff852-result.json");
  if (fs.existsSync(jsonPath)) {
    console.log("JSON data file found. Seeding Zain articles from JSON...");
    const rawData = fs.readFileSync(jsonPath, "utf8");
    const data = JSON.parse(rawData);

    for (const page of data.pages) {
      if (!page.url || page.url.includes("/signin") || page.url.includes("/login")) {
        continue;
      }

      try {
        const urlObj = new URL(page.url);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);

        // Extract language
        let lang: Language = Language.en;
        if (pathParts[0] === "ar") {
          lang = Language.ar;
        }

        if (pathParts[0] === "en" || pathParts[0] === "ar" || pathParts[0] === "ku") {
          pathParts.shift();
        }

        if (pathParts.length === 0) {
          continue;
        }

        let categorySlug = "general-support";
        let categoryName = "General Support";
        let articleSlug = "";

        if (pathParts.length === 1) {
          categorySlug = "general-support";
          categoryName = "General Support";
          articleSlug = pathParts[0];
        } else {
          categorySlug = pathParts[0];
          categoryName = capitalize(categorySlug.replace(/-/g, " "));
          articleSlug = pathParts.slice(1).join("-");
        }

        const markdownBody = page.scrape?.results?.markdown?.data?.[0];
        if (!markdownBody || markdownBody.trim().length === 0) {
          continue;
        }

        let title = "";
        const firstHeadingMatch = markdownBody.match(/^#\s+(.+)$/m);
        if (firstHeadingMatch) {
          title = firstHeadingMatch[1].trim();
        } else {
          title = capitalize(articleSlug.replace(/-/g, " "));
        }

        title = title.substring(0, 190);

        // Create or find category
        let category = await prisma.category.findFirst({
          where: { tenant_id: zainTenant.id, slug: categorySlug }
        });

        if (!category) {
          category = await prisma.category.create({
            data: {
              tenant_id: zainTenant.id,
              name: categoryName,
              slug: categorySlug
            }
          });
        }

        // Create article if not exists
        let article = await prisma.article.findFirst({
          where: { tenant_id: zainTenant.id, slug: articleSlug }
        });

        if (!article) {
          article = await prisma.article.create({
            data: {
              tenant_id: zainTenant.id,
              title: title,
              slug: articleSlug,
              category_id: category.id,
              language: lang,
              status: ArticleStatus.Published,
              visibility: Visibility.PUBLIC,
              owner_id: admin1Zain.id,
              author_id: admin1Zain.id,
              published_at: new Date()
            }
          });

          // Create version
          const version = await prisma.articleVersion.create({
            data: {
              article_id: article.id,
              version_no: 1,
              body: markdownBody,
              editor_id: admin1Zain.id
            }
          });

          await prisma.article.update({
            where: { id: article.id },
            data: { current_version_id: version.id }
          });

          // Create variant
          await prisma.articleVariant.create({
            data: {
              article_id: article.id,
              channel: Channel.default,
              short_answer: `Support details for ${title}.`,
              detailed_steps: markdownBody
            }
          });
        }
      } catch (err: any) {
        console.error(`Error seeding page ${page.url}:`, err.message);
      }
    }
    console.log("Zain articles seeding checked from JSON file.");
  } else {
    console.warn("JSON file not found. Seeding a fallback Zain article...");
    let categoryZain = await prisma.category.findFirst({
      where: { tenant_id: zainTenant.id, slug: "general-support" }
    });

    if (!categoryZain) {
      categoryZain = await prisma.category.create({
        data: {
          tenant_id: zainTenant.id,
          name: "General Support",
          slug: "general-support",
        },
      });
    }

    let articleFallback = await prisma.article.findFirst({
      where: { tenant_id: zainTenant.id, slug: "sim-activation-guide" }
    });

    if (!articleFallback) {
      await prisma.article.create({
        data: {
          tenant_id: zainTenant.id,
          title: "Zain SIM Card Activation Guide",
          slug: "sim-activation-guide",
          category_id: categoryZain.id,
          status: ArticleStatus.Published,
          owner_id: admin1Zain.id,
          author_id: admin1Zain.id,
        },
      });
    }
  }

  // 7. Seed sample article for OODI if not exists
  let categoryOodi = await prisma.category.findFirst({
    where: { tenant_id: oodiTenant.id, slug: "app-settings" }
  });

  if (!categoryOodi) {
    categoryOodi = await prisma.category.create({
      data: {
        tenant_id: oodiTenant.id,
        name: "App Settings",
        slug: "app-settings",
      },
    });
  }

  let articleOodi = await prisma.article.findFirst({
    where: { tenant_id: oodiTenant.id, slug: "esim-setup" }
  });

  if (!articleOodi) {
    await prisma.article.create({
      data: {
        tenant_id: oodiTenant.id,
        title: "OODI Digital eSIM Setup",
        slug: "esim-setup",
        category_id: categoryOodi.id,
        status: ArticleStatus.Published,
        owner_id: adminOodi.id,
        author_id: adminOodi.id,
      },
    });
  }

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
