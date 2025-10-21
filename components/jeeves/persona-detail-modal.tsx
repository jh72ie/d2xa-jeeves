"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PersonaDetailModalProps {
  personaName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PersonaData {
  memory: {
    summary: string;
    traits: Record<string, any>;
    updatedAt: string;
  } | null;
  recentLogs: Array<{
    id: string;
    kind: string;
    content: string;
    meta: Record<string, any>;
    createdAt: string;
  }>;
  notifications: Array<{
    id: string;
    subject: string;
    format: string;
    sentAt: string;
    viewedAt: string | null;
  }>;
}

export function PersonaDetailModal({ personaName, isOpen, onClose }: PersonaDetailModalProps) {
  const [data, setData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !personaName) {
      setData(null);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch(`/api/personas/${encodeURIComponent(personaName)}/memory`).then(r => r.json()),
      fetch(`/api/personas/${encodeURIComponent(personaName)}/logs`).then(r => r.json()),
      fetch(`/api/jeeves/notifications?personaName=${encodeURIComponent(personaName)}`).then(r => r.json()),
    ])
      .then(([memory, logs, notifications]) => {
        setData({
          memory: memory.memory,
          recentLogs: logs.logs || [],
          notifications: notifications.notifications || [],
        });
      })
      .catch(err => {
        console.error('Failed to load persona data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, personaName]);

  if (!personaName) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            👤 {personaName}
          </DialogTitle>
          <DialogDescription>
            What Jeeves knows about this team member
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="memory" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="memory">🧠 Memory & Traits</TabsTrigger>
              <TabsTrigger value="logs">📝 Interaction Log</TabsTrigger>
              <TabsTrigger value="notifications">📬 Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="memory" className="space-y-4 mt-4">
              {data?.memory ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Personality Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {data.memory.summary}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Last updated: {new Date(data.memory.updatedAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Learned Traits & Preferences</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(data.memory.traits).map(([key, value]) => (
                          <div key={key} className="border-l-2 border-primary/30 pl-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="text-sm">
                              {typeof value === 'object' ? (
                                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                String(value)
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <p>No memory profile yet</p>
                    <p className="text-sm mt-2">
                      Jeeves will build a profile as this persona interacts with the system
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-3 mt-4">
              {data?.recentLogs && data.recentLogs.length > 0 ? (
                data.recentLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{log.kind}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{log.content}</p>
                      {Object.keys(log.meta).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Metadata
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No interaction logs yet
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="space-y-3 mt-4">
              {data?.notifications && data.notifications.length > 0 ? (
                data.notifications.map((notif) => (
                  <Card key={notif.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{notif.format}</Badge>
                          {!notif.viewedAt && (
                            <Badge variant="default" className="text-xs">
                              UNREAD
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notif.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{notif.subject}</p>
                      {notif.viewedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Viewed: {new Date(notif.viewedAt).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No notifications yet
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
