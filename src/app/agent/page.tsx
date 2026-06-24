import { auth } from "@/lib/auth";
import { prisma, getTenantDb } from "@/lib/db";
import { redirect } from "next/navigation";
import AgentDeskWorkspace from "@/components/AgentDeskWorkspace";

export default async function AgentPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const { tenant_id: tenantId, name, email, role, id: userId } = session.user;

  // Enforce access control based on permissions matrix
  if (role !== "Agent" && role !== "Admin" && role !== "SuperAdmin") {
    redirect("/dashboard-redirect");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-zinc-900 font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-650">Organization Setup Required</h1>
          <p className="mt-2 text-zinc-500 font-semibold">The organization associated with your account could not be found.</p>
        </div>
      </div>
    );
  }

  const db = getTenantDb(tenantId);

  // Fetch tenants and categories for the KB search tab
  const allTenants = await prisma.tenant.findMany({ orderBy: { name: "asc" } });
  const allCategories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  const serializedTenants = allTenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    branding: t.branding || {},
  }));

  const serializedCategories = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    tenant_id: c.tenant_id,
  }));

  // Fetch initial cases (waiting and assigned cases)
  const cases = await db.chatCase.findMany({
    orderBy: { wait_started_at: "asc" },
    include: {
      agent: { select: { name: true } },
      resolving_article: { select: { title: true } },
    },
  });

  // Calculate today's search query count for this agent
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySearchesCount = await db.searchQuery.count({
    where: {
      user_id: userId,
      created_at: { gte: today },
    },
  });

  // Calculate helpfulness rate
  const totalFeedbackCount = await db.articleFeedback.count();
  const helpfulFeedbackCount = await db.articleFeedback.count({
    where: { helpful: true },
  });
  const helpfulnessRate = totalFeedbackCount > 0 
    ? Math.round((helpfulFeedbackCount / totalFeedbackCount) * 100) 
    : null;

  const serializedCases = cases.map((c) => ({
    id: c.id,
    customer_name: c.customer_name,
    subject: c.subject,
    query_text: c.query_text,
    status: c.status,
    priority: c.priority,
    assigned_agent_id: c.assigned_agent_id,
    context: c.context || {},
    resolving_article_id: c.resolving_article_id,
    wait_started_at: c.wait_started_at.toISOString(),
    resolved_at: c.resolved_at ? c.resolved_at.toISOString() : null,
    agent: c.agent ? { name: c.agent.name } : null,
    resolving_article: c.resolving_article ? { title: c.resolving_article.title } : null,
  }));

  const dummyCases = serializedCases.length === 0 ? [
    {
      id: "demo-001",
      customer_name: "Ahmed Al-Rashidi",
      subject: "Data bundle not activating after purchase",
      query_text: "I purchased the 5GB monthly data bundle this morning but my phone still shows 0MB remaining. I tried restarting the device twice but nothing changed. The SMS confirmation came through but the data is not working.",
      status: "waiting",
      priority: "high",
      assigned_agent_id: null,
      context: { channel: "call-center", account_type: "postpaid", sim_type: "4G" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
      resolved_at: null,
      agent: null,
      resolving_article: null,
    },
    {
      id: "demo-002",
      customer_name: "Sara Mahmoud",
      subject: "International roaming not working in Turkey",
      query_text: "I traveled to Turkey yesterday and my phone has no signal at all. I have the international roaming package active on my account. My phone shows 'No Service' even though I have a valid roaming plan.",
      status: "waiting",
      priority: "high",
      assigned_agent_id: null,
      context: { channel: "whatsapp", account_type: "prepaid", destination: "Turkey" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
      resolved_at: null,
      agent: null,
      resolving_article: null,
    },
    {
      id: "demo-003",
      customer_name: "Omar Khalid",
      subject: "Bill payment not reflecting on account",
      query_text: "I paid my bill of 25,000 IQD yesterday through the Zain app but my account still shows it as unpaid and my services are restricted. I have the payment receipt and transaction ID.",
      status: "waiting",
      priority: "medium",
      assigned_agent_id: null,
      context: { channel: "call-center", account_type: "postpaid", payment_method: "app" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
      resolved_at: null,
      agent: null,
      resolving_article: null,
    },
    {
      id: "demo-004",
      customer_name: "Fatima Hassan",
      subject: "4G drops to 3G constantly in Baghdad",
      query_text: "For the past 3 days my phone keeps dropping from 4G to 3G every few minutes in the Al-Mansour area. My device supports 4G and it was working fine before.",
      status: "active",
      priority: "medium",
      assigned_agent_id: userId,
      context: { channel: "call-center", account_type: "prepaid", location: "Baghdad - Al-Mansour" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      resolved_at: null,
      agent: { name: name || "You" },
      resolving_article: null,
    },
    {
      id: "demo-005",
      customer_name: "Kareem Saleh",
      subject: "Cannot send international SMS",
      query_text: "I am trying to send an SMS to my family in Germany but I keep getting a 'Message failed to send' error. I can make international calls fine. This started 2 days ago.",
      status: "waiting",
      priority: "low",
      assigned_agent_id: null,
      context: { channel: "whatsapp", account_type: "prepaid", destination: "Germany" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      resolved_at: null,
      agent: null,
      resolving_article: null,
    },
    {
      id: "demo-006",
      customer_name: "Layla Ibrahim",
      subject: "SIM card showing 'Invalid SIM' after phone upgrade",
      query_text: "I got a new iPhone 15 yesterday and inserted my old Zain SIM but the phone says 'Invalid SIM'. I have been a Zain customer for 5 years with a nano SIM.",
      status: "resolved",
      priority: "medium",
      assigned_agent_id: userId,
      context: { channel: "call-center", account_type: "postpaid", device: "iPhone 15" },
      resolving_article_id: null,
      wait_started_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      resolved_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      agent: { name: name || "You" },
      resolving_article: { title: "How to Replace or Upgrade Your SIM Card" },
    },
  ] : serializedCases;

  const brandingColor = (tenant.branding as any)?.primaryColor || "#09090B";

  return (
    <div className="text-zinc-900 font-sans">
      <AgentDeskWorkspace
        initialCases={dummyCases}
        currentUserId={userId}
        tenantId={tenantId}
        todaySearches={todaySearchesCount}
        helpfulnessRate={helpfulnessRate}
        tenants={serializedTenants}
        initialCategories={serializedCategories}
        userRole={role}
        userName={name || undefined}
        userEmail={email || undefined}
        tenantName={tenant.name}
        brandingColor={brandingColor}
      />
    </div>
  );
}
