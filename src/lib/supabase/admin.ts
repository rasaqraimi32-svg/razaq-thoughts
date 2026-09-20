import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import { getAdminAccess } from "./admin-access";

/** Request-local check; use again in every future privileged Server Action. */
export const requireAdmin = cache(async () => {
  const access = await getAdminAccess(await createClient());
  if (access.status !== "admin") redirect("/admin/login");
  return access;
});
