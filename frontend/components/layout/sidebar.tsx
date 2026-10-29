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
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useIsAdmin } from "@/contexts/auth-context";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import useSWR from "swr";
import api from "@/lib/api";
import { formatBytes } from "@/lib/utils";

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
  const { data: publicSettings } = useSWR("public-settings", () => api.getPublicSettings());
  const { data: usage } = useSWR(publicSettings?.branding.disableUsedPercentage ? null : "disk-usage", () => api.getUsage(), { refreshInterval: 60000 });
  const instanceName = publicSettings?.branding.name || "File Browser";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCollapsed(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    if (item.adminOnly && !isAdmin) return null;
    if (item.href === "/settings/shares" && !(user?.perm.share && user?.perm.download)) return null;

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
          "flex h-screen min-h-0 flex-col border-r bg-sidebar transition-all duration-300",
          collapsed ? "w-16 shrink-0" : "w-48 shrink-0 lg:w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link to="/files/" className="flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="truncate font-semibold">{instanceName}</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
        <nav className="min-h-0 flex-1 overflow-y-auto space-y-1 p-2">
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
          {!publicSettings?.branding.disableUsedPercentage && usage && usage.total > 0 && (
            <StorageUsage used={usage.used} total={usage.total} collapsed={collapsed} />
          )}
          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={toggleTheme}
                aria-label="Toggle theme"
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
                aria-label="Log out"
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

// Warns in amber from 75% and red from 90% full.
function StorageUsage({ used, total, collapsed }: { used: number; total: number; collapsed: boolean }) {
  const percent = Math.min(100, Math.round((used / total) * 100));
  const tone = percent >= 90 ? "bg-destructive" : percent >= 75 ? "bg-warning" : "bg-primary";
  const summary = `${formatBytes(used)} of ${formatBytes(total)}`;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="mx-auto mb-1 flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground"
            aria-label={`Storage: ${summary} used (${percent}%)`}
          >
            <HardDrive className="h-4 w-4" />
            <Progress value={percent} className="h-1 w-6 bg-muted" indicatorClassName={tone} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Storage: {summary} used ({percent}%)</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="mb-1 space-y-2 rounded-lg px-3 py-2">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <HardDrive className="h-4 w-4 shrink-0" />
        <span className="flex-1">Storage</span>
        <span className="text-xs font-medium tabular-nums text-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-1.5 bg-muted" indicatorClassName={tone} aria-label="Disk usage" />
      <p className="truncate text-xs tabular-nums text-muted-foreground">{summary}</p>
    </div>
  );
}
