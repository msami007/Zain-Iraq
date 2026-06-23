import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirectPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const role = session.user.role;
  if (role === "SuperAdmin") {
    redirect("/superadmin");
  } else if (role === "Admin") {
    redirect("/admin");
  } else {
    redirect("/agent");
  }
}
