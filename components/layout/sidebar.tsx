"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Filter,
  Settings,
  Activity,
  Search,
  Shield,
  FileSearch,
  FileDown,
  SlidersHorizontal,
  ToggleLeft,
  Wallet,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPermissionKey } from "@/lib/admin/constants";
import { hasAdminPermission } from "@/lib/admin/permission-utils";

interface NavItem {
  section: "Overview" | "Operations" | "Revenue" | "Security" | "Configuration";
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  anyPermissions?: AdminPermissionKey[];
}

const navItems: NavItem[] = [
  {
    section: "Overview",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    anyPermissions: ["dashboard.view"],
  },
  {
    section: "Overview",
    label: "Search",
    href: "/admin/search",
    icon: Search,
    anyPermissions: ["users.view"],
  },
  {
    section: "Operations",
    label: "Users",
    href: "/admin/users",
    icon: Users,
    anyPermissions: ["users.view"],
  },
  {
    section: "Operations",
    label: "Segments",
    href: "/admin/segments",
    icon: Filter,
    anyPermissions: ["users.view"],
  },
  {
    section: "Operations",
    label: "Review Queue",
    href: "/admin/reviews",
    icon: AlertTriangle,
    anyPermissions: ["review_queue.manage"],
  },
  {
    section: "Revenue",
    label: "Subscriptions",
    href: "/admin/subscriptions",
    icon: ShieldCheck,
    anyPermissions: ["subscriptions.view"],
  },
  {
    section: "Revenue",
    label: "Finance",
    href: "/admin/finance",
    icon: Wallet,
    anyPermissions: ["finance.view", "finance.manage"],
  },
  {
    section: "Security",
    label: "Admins",
    href: "/admin/admins",
    icon: Shield,
    anyPermissions: ["admins.view"],
  },
  {
    section: "Security",
    label: "Product Activity",
    href: "/admin/activity-logs",
    icon: Activity,
    anyPermissions: ["activity_logs.view"],
  },
  {
    section: "Security",
    label: "Audit Logs",
    href: "/admin/audit-logs",
    icon: FileSearch,
    anyPermissions: ["audit_logs.view"],
  },
  {
    section: "Configuration",
    label: "Exports",
    href: "/admin/exports",
    icon: FileDown,
    anyPermissions: ["exports.view", "exports.manage"],
  },
  {
    section: "Configuration",
    label: "Feature Flags",
    href: "/admin/feature-flags",
    icon: ToggleLeft,
    anyPermissions: ["feature_flags.view", "feature_flags.manage"],
  },
  {
    section: "Configuration",
    label: "Internal Settings",
    href: "/admin/internal-settings",
    icon: SlidersHorizontal,
    anyPermissions: ["internal_settings.view", "internal_settings.manage"],
  },
  {
    section: "Configuration",
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  roleKeys?: string[];
  permissions?: AdminPermissionKey[];
}

export function Sidebar({ roleKeys = [], permissions = [] }: SidebarProps) {
  const pathname = usePathname();
  const permissionContext = {
    roleKeys,
    permissions: new Set(permissions),
  };
  const visibleItems = navItems.filter((item) => {
    if (!item.anyPermissions?.length) return true;
    return item.anyPermissions.some((permission) =>
      hasAdminPermission(permissionContext, permission)
    );
  });
  const sections = Array.from(new Set(visibleItems.map((item) => item.section)));

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-neutral-200 bg-white">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-neutral-200 px-5">
        <span className="text-sm font-semibold tracking-tight text-neutral-900">
          Centmond Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section} className="mb-3 last:mb-0">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {section}
            </div>
            <div className="flex flex-col gap-0.5">
              {visibleItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="h-3 w-3" />}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-neutral-200 p-3">
        <p className="px-3 py-1 text-xs text-neutral-400">v1.0.0</p>
      </div>
    </aside>
  );
}
