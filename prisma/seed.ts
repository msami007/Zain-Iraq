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

  // Assign agents and admins to teams if not already assigned
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

  const adminTeam1Exists = await prisma.userTeam.findFirst({
    where: { user_id: admin1Zain.id, team_id: mobileTeamZain.id }
  });
  if (!adminTeam1Exists) {
    await prisma.userTeam.create({
      data: {
        user_id: admin1Zain.id,
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

  const adminTeam2Exists = await prisma.userTeam.findFirst({
    where: { user_id: admin2Zain.id, team_id: broadbandTeamZain.id }
  });
  if (!adminTeam2Exists) {
    await prisma.userTeam.create({
      data: {
        user_id: admin2Zain.id,
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

  // 8. Seed chat_cases for Zain (Task 42 — Day 3 QA)
  const existingCases = await prisma.chatCase.count({ where: { tenant_id: zainTenant.id } });
  if (existingCases === 0) {
    const sampleCases = [
      {
        customer_name: "Zainab Jaafar", subject: "Cannot login to Zain app", priority: "high",
        query_text: "I cannot login to my Zain app, it says network timeout",
        context: { channel: "web-chat", device: "iPhone 14", os: "iOS 17" },
      },
      {
        customer_name: "Ali Hussein", subject: "Check prepaid balance", priority: "normal",
        query_text: "How do I check my Zain Iraq prepaid balance?",
        context: { channel: "web-chat", device: "Samsung Galaxy S23", os: "Android 14" },
      },
      {
        customer_name: "Mariam Abbas", subject: "Activate international roaming", priority: "high",
        query_text: "I want to activate international roaming on my SIM before I travel tomorrow",
        context: { channel: "web-chat", device: "iPhone 13", os: "iOS 16" },
      },
      {
        customer_name: "Ahmed Al-Rashid", subject: "SIM card not working", priority: "high",
        query_text: "My SIM shows no service after restarting. I need help urgently.",
        context: { channel: "web-chat", device: "Xiaomi Mi 12", os: "Android 13" },
      },
      {
        customer_name: "Fatima Al-Saadi", subject: "Data package not activated", priority: "normal",
        query_text: "I purchased a 10GB data package but it has not been activated on my line",
        context: { channel: "whatsapp", device: "Samsung A53", os: "Android 13" },
      },
      {
        customer_name: "Omar Khalil", subject: "Transfer balance to family member", priority: "normal",
        query_text: "Can I transfer credit from my prepaid account to another Zain number?",
        context: { channel: "web-chat", device: "Huawei P50", os: "HarmonyOS" },
      },
    ];

    for (const c of sampleCases) {
      await prisma.chatCase.create({
        data: {
          tenant_id: zainTenant.id,
          customer_name: c.customer_name,
          subject: c.subject,
          query_text: c.query_text,
          priority: c.priority,
          status: "waiting" as any,
          context: c.context,
          wait_started_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
        },
      });
    }
    console.log("Seeded 6 chat cases for Zain.");

    // Also seed 2 cases for OODI isolation test
    await prisma.chatCase.create({
      data: {
        tenant_id: oodiTenant.id,
        customer_name: "Hassan Mahmoud",
        subject: "eSIM not working on new iPhone",
        query_text: "I set up eSIM with OODI but it shows no signal on my new iPhone 15",
        priority: "high",
        status: "waiting" as any,
        context: { channel: "app", device: "iPhone 15", os: "iOS 17" },
        wait_started_at: new Date(Date.now() - 600000),
      },
    });
    console.log("Seeded 1 chat case for OODI.");
  } else {
    console.log(`Chat cases already seeded (${existingCases} found).`);
  }

  // 9. Seed knowledge_gaps for Zain (Task 42 — Day 3 QA)
  const existingGaps = await prisma.knowledgeGap.count({ where: { tenant_id: zainTenant.id } });
  if (existingGaps === 0) {
    const sampleGaps = [
      { query_text: "turkey roaming package cost", occurrences: 12, channel: Channel.agent },
      { query_text: "cancel data subscription mid-month refund", occurrences: 8, channel: Channel.default },
      { query_text: "esim setup android not supported", occurrences: 5, channel: Channel.chatbot },
      { query_text: "family share plan add member", occurrences: 3, channel: Channel.agent },
      { query_text: "bills pay online bank transfer", occurrences: 7, channel: Channel.default },
    ];

    for (const g of sampleGaps) {
      await prisma.knowledgeGap.create({
        data: {
          tenant_id: zainTenant.id,
          query_text: g.query_text,
          occurrences: g.occurrences,
          channel: g.channel,
          language: Language.en,
          status: "NEW" as any,
          reported_by: agent1Zain.id,
        },
      });
    }

    // Arabic language gap
    await prisma.knowledgeGap.create({
      data: {
        tenant_id: zainTenant.id,
        query_text: "كيف أشحن رصيد زين",
        occurrences: 15,
        channel: Channel.whatsapp,
        language: Language.ar,
        status: "NEW" as any,
        reported_by: agent2Zain.id,
      },
    });
    console.log("Seeded knowledge gaps for Zain.");
  } else {
    console.log(`Knowledge gaps already seeded (${existingGaps} found).`);
  }

  // 10. Seed Arabic article variant (Task 40 — RTL/Arabic seed content)
  const firstZainArticle = await prisma.article.findFirst({
    where: { tenant_id: zainTenant.id, status: ArticleStatus.Published },
    include: { variants: true },
  });

  if (firstZainArticle) {
    const hasArabicVariant = firstZainArticle.variants.some(v => v.channel === Channel.default);
    if (!hasArabicVariant || firstZainArticle.language !== Language.ar) {
      // Create or update an Arabic article to demonstrate RTL support
      let arabicArticle = await prisma.article.findFirst({
        where: { tenant_id: zainTenant.id, language: Language.ar }
      });

      if (!arabicArticle) {
        const arabicCat = await prisma.category.findFirst({
          where: { tenant_id: zainTenant.id }
        });
        if (arabicCat) {
          arabicArticle = await prisma.article.create({
            data: {
              tenant_id: zainTenant.id,
              title: "دليل تفعيل شريحة زين",
              slug: "dalil-tafeel-shareha-zain",
              category_id: arabicCat.id,
              language: Language.ar,
              status: ArticleStatus.Published,
              owner_id: admin1Zain.id,
              author_id: admin1Zain.id,
              visibility: "PUBLIC",
            },
          });

          await prisma.articleVariant.create({
            data: {
              article_id: arabicArticle.id,
              channel: Channel.default,
              short_answer: "لتفعيل شريحة زين، أدخل الشريحة في الجهاز وأعد تشغيله. ستستلم رسالة تأكيد خلال دقيقتين.",
              detailed_steps: "1. أدخل شريحة زين في فتحة SIM في جهازك\n2. أعد تشغيل الهاتف\n3. انتظر ظهور شبكة زين العراق\n4. سيتم إرسال رسالة تأكيد التفعيل\n5. في حال عدم ظهور الشبكة، تواصل مع خدمة العملاء",
            },
          });

          await prisma.articleVariant.create({
            data: {
              article_id: arabicArticle.id,
              channel: Channel.agent,
              short_answer: "تفعيل الشريحة: أعد إدخال الشريحة وأعد التشغيل. إذا استمرت المشكلة، افحص رقم IMEI.",
              detailed_steps: "1. أعد إدخال الشريحة بشكل صحيح\n2. أعد تشغيل الجهاز\n3. تحقق من إعدادات شبكة الناقل (تلقائي)\n4. إذا لم تظهر الشبكة، اتصل بقسم التقنية لفحص IMEI",
              copy_ready_macro: "عزيزي العميل، شكراً لتواصلك مع خدمة عملاء زين العراق. لتفعيل شريحتك، يرجى إعادة إدخال الشريحة وإعادة تشغيل الجهاز. سيتم الاتصال بكم خلال ساعة إذا استمرت المشكلة. مع تحيات فريق زين.",
            },
          });

          // Assign to team
          const firstTeam = await prisma.team.findFirst({ where: { tenant_id: zainTenant.id } });
          if (firstTeam) {
            await prisma.articleTeam.create({
              data: { article_id: arabicArticle.id, team_id: firstTeam.id, tenant_id: zainTenant.id },
            }).catch(() => {});
          }

          console.log("Arabic seed article created for RTL demo.");
        }
      } else {
        console.log("Arabic article already exists.");
      }
    }
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
