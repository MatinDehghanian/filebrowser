"use client";

import { Link, useLocation } from "react-router-dom";
import {
  FolderOpen,
  Settings,
  Users,
  Share2,
  Globe,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useIsAdmin } from "@/contexts/auth-context";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const mainNavItems: NavItem[] = [
  { href: "/files/", label: "Files", icon: FolderOpen },
];

const settingsNavItems: NavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: Settings },
  { href: "/settings/shares", label: "Shares", icon: Share2 },
  { href: "/settings/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/settings/global", label: "Global Settings", icon: Globe, adminOnly: true },
];

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    if (item.adminOnly && !isAdmin) return null;

    const isActive = pathname.startsWith(item.href);
    const Icon = item.icon;

    const linkContent = (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link to="/files/" className="flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="font-semibold">File Browser</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("h-8 w-8", collapsed && "mx-auto")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          <Separator className="my-4" />

          <div className={cn("px-3 py-2", collapsed && "text-center")}>
            {!collapsed && (
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Settings
              </h3>
            )}
          </div>

          {settingsNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t p-2">
          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={toggleTheme}
                className={cn(
                  "w-full justify-start gap-3",
                  collapsed && "justify-center"
                )}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 shrink-0" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0" />
                )}
                {!collapsed && <span>Toggle Theme</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Toggle Theme</TooltipContent>}
          </Tooltip>

          <Separator className="my-2" />

          {/* User Info */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2",
              collapsed && "justify-center px-0"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user?.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAdmin ? "Administrator" : "User"}
                </p>
              </div>
            )}
          </div>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={logout}
                className={cn(
                  "w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive",
                  collapsed && "justify-center"
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Logout</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
