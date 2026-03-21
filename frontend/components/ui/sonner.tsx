"use client";

import { Toaster as Sonner } from "react-hot-toast";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        className: "bg-background text-foreground border border-border shadow-lg",
        duration: 4000,
        style: {
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
