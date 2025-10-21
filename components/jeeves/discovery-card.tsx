"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ExternalLink } from "lucide-react";
import type { JeevesDiscovery } from "@/lib/db/schema";
import { DiscoveryDetailModal } from "./discovery-detail-modal";

interface DiscoveryCardProps {
  discovery: JeevesDiscovery;
}

export function DiscoveryCard({ discovery }: DiscoveryCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "normal":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "normal":
        return "🔵";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  const recipients = Array.isArray(discovery.intendedRecipients)
    ? discovery.intendedRecipients
    : [];

  const confidence = discovery.confidence
    ? parseFloat(discovery.confidence as string) * 100
    : 0;

  return (
    <>
      <Card
        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getSeverityIcon(discovery.severity)}</span>
                <h3 className="text-xl font-semibold">{discovery.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Discovered {new Date(discovery.discoveredAt).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-col gap-2 items-end ml-4">
              <Badge variant={getSeverityColor(discovery.severity)}>
                {discovery.severity}
              </Badge>
              {confidence > 0 && (
                <Badge variant="outline">
                  {confidence.toFixed(0)}% confidence
                </Badge>
              )}
            </div>
          </div>

          {/* Category */}
          {discovery.category && (
            <Badge variant="secondary" className="mb-3">{discovery.category}</Badge>
          )}

          {/* Reasoning Preview */}
          <p className="text-sm mb-4 leading-relaxed line-clamp-2">
            {discovery.aiReasoning}
          </p>

          {/* Click to View */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <MessageSquare size={16} />
              Click to view details and chat with Jeeves
            </span>
            {recipients.length > 0 && (
              <span>{recipients.length} notified</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <DiscoveryDetailModal
        discovery={discovery}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
