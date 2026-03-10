"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { logoutAction } from "@/app/login/actions";
import { GlobalSearchForm } from "@/components/admin/search/global-search-form";
import { getRoleLabel } from "@/lib/admin/constants";

interface TopbarProps {
  username?: string;
  role?: string;
}

export function Topbar({ username, role }: TopbarProps) {
  const router = useRouter();

  async function handleSignOut(logoutAll = false) {
    await logoutAction({ logoutAll });
    toast.success(logoutAll ? "Signed out from all admin sessions" : "Signed out successfully");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <GlobalSearchForm compact />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm text-neutral-700">
              {username ?? "Admin"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs text-neutral-500">@{username}</p>
            {role ? <p className="text-xs text-neutral-400">{getRoleLabel(role)}</p> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleSignOut(true)} className="cursor-pointer">
            Sign out all sessions
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSignOut(false)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
