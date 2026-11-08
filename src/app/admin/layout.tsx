import type { ReactNode } from "react";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { AdminNavigation } from "@/features/admin/admin-navigation";
import { FlashHost } from "@/components/admin/flash";
import "./admin.css";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdmin();
  return (
    <div className="ad-shell" aria-label="Administration MARKETFOOT">
      <aside className="ad-side">
        <Link className="ad-brand" href="/admin"><b>Marketfoot</b><small>SuperAdmin</small></Link>
        <AdminNavigation />
        <p className="ad-side-foot">Accès administrateur</p>
      </aside>
      <div className="ad-main">{children}</div>
      <FlashHost />
    </div>
  );
}
