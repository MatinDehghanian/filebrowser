"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ShareQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export function ShareQrDialog({
  open,
  onOpenChange,
  url,
  title = "Share QR Code",
}: ShareQrDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !url) {
      setQrDataUrl("");
      return;
    }

    setIsLoading(true);

    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
    })
      .then((value) => {
        setQrDataUrl(value);
      })
      .catch(() => {
        toast.error("Failed to generate QR code");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, url]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex min-h-[320px] items-center justify-center rounded-md border bg-muted/10 p-4">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            ) : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Share QR code" className="h-72 w-72" />
            ) : (
              <p className="text-sm text-muted-foreground">QR code unavailable</p>
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground">{url}</p>

          <Button onClick={handleCopyLink} className="w-full" variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}