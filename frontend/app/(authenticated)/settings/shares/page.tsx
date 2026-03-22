"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Trash2, ExternalLink, FolderOpen, File, Download } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import type { ApiError, Share } from "@/types";

export default function SharesSettingsPage() {
  const {
    data: shares,
    error,
    mutate,
    isLoading,
  } = useSWR("all-shares", () => api.getAllShares());
  const [deleteShare, setDeleteShare] = useState<Share | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    const apiError = error as ApiError;
    toast.error(apiError.message || "Failed to load active shares");
  }, [error]);

  const handleDelete = async () => {
    if (!deleteShare) return;

    try {
      await api.deleteShare(deleteShare.hash);
      toast.success("Share deleted successfully");
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete share"
      );
    } finally {
      setDeleteShare(null);
    }
  };

  const copyShareLink = (hash: string) => {
    const url = `${window.location.origin}/share/${hash}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.error("Failed to copy link"));
  };

  const copyDirectDownloadLink = (share: Share) => {
    const isProtected = Boolean(share.token || share.password);
    if (isProtected) {
      toast.error("Direct download is disabled for password-protected shares");
      return;
    }

    const downloadPath = api.getPublicDownloadUrl(share.hash, "", false, share.token);
    const url = `${window.location.origin}${downloadPath}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Direct download link copied"))
      .catch(() => toast.error("Failed to copy link"));
  };

  const getExpiryStatus = (share: Share) => {
    if (!share.expire || share.expire === 0) {
      return { text: "Never", variant: "secondary" as const };
    }

    const now = Date.now() / 1000;
    const remaining = share.expire - now;

    if (remaining <= 0) {
      return { text: "Expired", variant: "destructive" as const };
    }

    if (remaining < 3600) {
      const minutes = Math.ceil(remaining / 60);
      return { text: `${minutes}m`, variant: "outline" as const };
    }

    if (remaining < 86400) {
      const hours = Math.ceil(remaining / 3600);
      return { text: `${hours}h`, variant: "outline" as const };
    }

    const days = Math.ceil(remaining / 86400);
    return { text: `${days}d`, variant: "secondary" as const };
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Shares</h1>
        <p className="text-muted-foreground">
          Manage your shared files and folders
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Shares</CardTitle>
          <CardDescription>
            All your shared links in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <h3 className="font-medium text-destructive">
                Failed to load active shares
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as ApiError).message || "Please try again."}
              </p>
              <Button className="mt-4" variant="outline" onClick={() => mutate()}>
                Retry
              </Button>
            </div>
          ) : !shares || shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ExternalLink className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium">No shares yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share files or folders to see them here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Protected</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Auth (ok/failed)</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => {
                  const expiryStatus = getExpiryStatus(share);
                  const isDir = share.path.endsWith("/");
                  const isProtected = Boolean(share.token || share.password);
                  
                  return (
                    <TableRow key={share.hash}>
                      <TableCell>
                        <Link
                          to={`/files${share.path}`}
                          className="flex items-center gap-2 text-sm hover:underline"
                        >
                          {isDir ? (
                            <FolderOpen className="h-4 w-4 text-primary" />
                          ) : (
                            <File className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate max-w-[200px]">
                            {share.path}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {share.hash.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        {isProtected ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>{share.visitCount ?? 0}</TableCell>
                      <TableCell>{share.downloadCount ?? 0}</TableCell>
                      <TableCell>
                        {isProtected
                          ? `${share.authSuccessCount ?? 0} / ${share.authFailureCount ?? 0}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={expiryStatus.variant}>
                          {expiryStatus.text}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
                            onClick={() => setDeleteShare(share)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteShare} onOpenChange={() => setDeleteShare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Share</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this share link? Anyone with the
              link will no longer be able to access the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
