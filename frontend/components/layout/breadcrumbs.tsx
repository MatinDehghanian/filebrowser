"use client";

import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { encodePath } from "@/lib/paths";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
  path: string;
  className?: string;
}

export function Breadcrumbs({ path, className }: BreadcrumbsProps) {
  const parts = path.split("/").filter(Boolean);
  
  const breadcrumbs = parts.map((part, index) => {
    const href = "/files/" + parts.slice(0, index + 1).map(encodeURIComponent).join("/") + "/";
    return { label: part, href };
  });

  return (
    <nav className={cn("flex items-center overflow-x-auto px-4 pb-3", className)}>
      <ol className="flex items-center gap-1 pt-5 text-sm">
        <li>
          <Link
            to="/files/"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
