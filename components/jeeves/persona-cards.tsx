"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PersonaDetailModal } from "./persona-detail-modal";

interface Persona {
  name: string;
  email?: string | null;
  sendNotification: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PersonaCardsProps {
  personas: Persona[];
}

interface PersonaStats {
  unreadCount: number;
  totalNotifications: number;
  lastNotificationAt?: string;
  recentDiscoveryCount?: number;
}

export function PersonaCards({ personas }: PersonaCardsProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [personaStats, setPersonaStats] = useState<Record<string, PersonaStats>>({});
  const [loading, setLoading] = useState(true);
  const [personaSettings, setPersonaSettings] = useState<Record<string, { email: string; sendNotification: boolean }>>({});

  useEffect(() => {
    // Initialize persona settings from props
    const settings: Record<string, { email: string; sendNotification: boolean }> = {};
    personas.forEach((persona) => {
      settings[persona.name] = {
        email: persona.email || "",
        sendNotification: persona.sendNotification,
      };
    });
    setPersonaSettings(settings);
  }, [personas]);

  useEffect(() => {
    // Load stats for each persona
    async function loadPersonaStats() {
      const stats: Record<string, PersonaStats> = {};

      await Promise.all(
        personas.map(async (persona) => {
          try {
            const response = await fetch(
              `/api/jeeves/notifications?personaName=${encodeURIComponent(persona.name)}`
            );
            if (response.ok) {
              const data = await response.json();
              stats[persona.name] = {
                unreadCount: data.unreadCount || 0,
                totalNotifications: data.total || 0,
                lastNotificationAt: data.notifications?.[0]?.createdAt,
                recentDiscoveryCount: data.recentDiscoveryCount || 0,
              };
            }
          } catch (error) {
            console.error(`Failed to load stats for ${persona.name}:`, error);
            stats[persona.name] = {
              unreadCount: 0,
              totalNotifications: 0,
            };
          }
        })
      );

      setPersonaStats(stats);
      setLoading(false);
    }

    if (personas.length > 0) {
      loadPersonaStats();

      // Refresh every 30 seconds
      const interval = setInterval(loadPersonaStats, 30000);
      return () => clearInterval(interval);
    }
  }, [personas]);

  const updatePersonaSetting = async (personaName: string, field: "email" | "sendNotification", value: string | boolean) => {
    // Update local state immediately
    setPersonaSettings((prev) => {
      const currentPersona = prev[personaName] || { email: "", sendNotification: false };
      return {
        ...prev,
        [personaName]: {
          ...currentPersona,
          [field]: value,
        },
      };
    });

    // Update in database
    try {
      await fetch(`/api/personas/${encodeURIComponent(personaName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (error) {
      console.error(`Failed to update ${field} for ${personaName}:`, error);
    }
  };

  if (personas.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <p>No personas found</p>
        <p className="text-sm mt-2">
          Personas are created automatically when users interact with the system
        </p>
      </div>
    );
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {personas.map((persona) => {
        const stats = personaStats[persona.name] || {
          unreadCount: 0,
          totalNotifications: 0,
        };

        return (
          <Card
            key={persona.name}
            className="hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden"
            onClick={() => setSelectedPersona(persona.name)}
          >
            {loading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            )}

            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                    {persona.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                    Member since {new Date(persona.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {stats.unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 animate-pulse cursor-pointer hover:scale-110 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation(); // Don't trigger card click
                      const element = document.getElementById('notifications-feed');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    {stats.unreadCount}
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-2">
                {stats.unreadCount > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xl">📬</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {stats.unreadCount} new notification{stats.unreadCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-xl">✅</span>
                    <span>All caught up</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>📊</span>
                  <span>{stats.totalNotifications} total notifications</span>
                </div>

                {stats.lastNotificationAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>🕐</span>
                    <span suppressHydrationWarning>
                      Last: {formatTimeAgo(stats.lastNotificationAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Email and Notification Settings */}
              <div className="mt-4 pt-4 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label htmlFor={`email-${persona.name}`} className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id={`email-${persona.name}`}
                    type="email"
                    placeholder="team@example.com"
                    value={personaSettings[persona.name]?.email ?? ""}
                    onChange={(e) => updatePersonaSetting(persona.name, "email", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`notify-${persona.name}`} className="text-xs text-muted-foreground">
                    Send notifications
                  </Label>
                  <Switch
                    id={`notify-${persona.name}`}
                    checked={personaSettings[persona.name]?.sendNotification || false}
                    onCheckedChange={(checked) => updatePersonaSetting(persona.name, "sendNotification", checked)}
                  />
                </div>
              </div>

              {/* Hover hint */}
              <div className="mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-muted-foreground text-center">
                  Click to view profile & data →
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Persona Detail Modal */}
      <PersonaDetailModal
        personaName={selectedPersona}
        isOpen={!!selectedPersona}
        onClose={() => setSelectedPersona(null)}
      />
    </div>
  );
}
