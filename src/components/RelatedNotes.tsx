"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Link2 } from "lucide-react";

interface RelatedNote {
  id: string;
  title: string;
  tags?: string[];
  summary?: string;
  updated_at: string;
  similarity: number;
}

export default function RelatedNotes({ noteId }: { noteId: string }) {
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const fetchRelated = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/related`);
      const data = await res.json();
      setRelated(data.related || []);
    } catch (error) {
      console.error("Error fetching related notes:", error);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchRelated();
  }, [fetchRelated]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      await fetch(`/api/notes/${noteId}/related/compute`, { method: "POST" });
      await fetchRelated();
    } catch (error) {
      console.error("Error computing related:", error);
    } finally {
      setComputing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            相关笔记
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCompute}
            disabled={computing}
          >
            {computing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            {computing ? "计算中..." : "重新计算"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {related.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">暂无相关笔记</p>
            <Button variant="outline" size="sm" onClick={handleCompute} disabled={computing}>
              {computing ? "计算中..." : "计算相关笔记"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {related.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <div className="p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm truncate flex-1">{note.title}</h4>
                    <Badge variant="outline" className="text-xs flex-shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                      {(note.similarity * 100).toFixed(0)}% 相关
                    </Badge>
                  </div>
                  {note.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{note.summary}</p>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {note.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
