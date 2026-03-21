"use client";

import { useState, useEffect } from "react";
import { Copy, Link2, Trash2, Eye, EyeOff, QrCode, Download } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ShareQrDialog } from "@/components/share/share-qr-dialog";
import api from "@/lib/api";
import type { FileItem, Share } from "@/types";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | undefined;
}

export function ShareDialog({ open, onOpenChange, item }: ShareDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expires, setExpires] = useState("");
  const [unit, setUnit] = useState<"hours" | "days">("days");
  const [isCreating, setIsCreating] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  // Fetch existing shares
  const { data: shares, mutate } = useSWR<Share[]>(
    open && item ? `shares:${item.path}` : null,
    () => api.getShares(item!.path),
    { revalidateOnFocus: false }
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPassword("");
      setShowPassword(false);
      setExpires("");
      setUnit("days");
    }
  }, [open]);

  const handleCreateShare = async () => {
    if (!item) return;

    setIsCreating(true);

    try {
      const options: { password?: string; expires?: string; unit?: string } = {};
      if (password) options.password = password;
      if (expires) {
        options.expires = expires;
        options.unit = unit;
      }

      await api.createShare(item.path, options);
      toast.success("Share link created");
      mutate();
      setPassword("");
      setExpires("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create share"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteShare = async (hash: string) => {
    try {
      await api.deleteShare(hash);
      toast.success("Share link deleted");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete share"
      );
    }
  };

  const copyShareLink = (hash: string) => {
    const url = `${window.location.origin}/share/${hash}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const copyDirectDownloadLink = (share: Share) => {
    const isProtected = Boolean(share.token || share.password);
    if (isProtected) {
      toast.error("Direct download is disabled for password-protected shares");
      return;
    }

    const downloadPath = api.getPublicDownloadUrl(share.hash, "", false, share.token);
    const url = `${window.location.origin}${downloadPath}`;
    navigator.clipboard.writeText(url);
    toast.success("Direct download link copied");
  };

  const openShareQr = (hash: string) => {
    setQrUrl(`${window.location.origin}/share/${hash}`);
    setIsQrOpen(true);
  };

  const getExpiryText = (share: Share) => {
    if (!share.expire || share.expire === 0) return "Never expires";
    
    const now = Date.now() / 1000;
    const remaining = share.expire - now;
    
    if (remaining <= 0) return "Expired";
    
    if (remaining < 3600) {
      const minutes = Math.ceil(remaining / 60);
      return `Expires in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }
    
    if (remaining < 86400) {
      const hours = Math.ceil(remaining / 3600);
      return `Expires in ${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    
    const days = Math.ceil(remaining / 86400);
    return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &quot;{item.name}&quot;</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Share */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Create Share Link</h4>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="expires">Expires (optional)</Label>
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                  placeholder="Leave empty for no expiry"
                />
              </div>
              <div className="w-28 space-y-2">
                <Label>&nbsp;</Label>
                <Select
                  value={unit}
                  onValueChange={(v) => setUnit(v as "hours" | "days")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleCreateShare}
              disabled={isCreating}
              className="w-full"
            >
              <Link2 className="mr-2 h-4 w-4" />
              {isCreating ? "Creating..." : "Create Share Link"}
            </Button>
          </div>

          {/* Existing Shares */}
          {shares && shares.length > 0 && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium">
                  Existing Links ({shares.length})
                </h4>
                
                <div className="space-y-2">
                  {shares.map((share) => {
                    const isProtected = Boolean(share.token || share.password);

                    return (
                      <div
                        key={share.hash}
                        className="flex items-center gap-2 rounded-md border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-mono">
                            {share.hash}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getExpiryText(share)}
                            {isProtected && " • Password protected"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyShareLink(share.hash)}
                          title="Copy share page link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!isProtected && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyDirectDownloadLink(share)}
                            title="Copy direct download link"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openShareQr(share.hash)}
                          title="Show QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteShare(share.hash)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <ShareQrDialog
        open={isQrOpen}
        onOpenChange={setIsQrOpen}
        url={qrUrl}
        title="Share Link QR Code"
      />
    </Dialog>
  );
}
