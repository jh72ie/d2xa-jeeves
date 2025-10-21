"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import type { JeevesNotification } from "@/lib/db/schema";
import { toast } from "@/components/toast";

interface NotificationCardProps {
  notification: JeevesNotification;
  onDelete?: () => void;
}

export function NotificationCard({ notification, onDelete }: NotificationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(
    notification.feedback ? true : false
  );

  const handleDelete = async () => {
    if (!confirm("Delete this notification? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/jeeves/notifications/${notification.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }

      toast({
        type: "success",
        description: "Notification deleted"
      });

      // Call the parent's onDelete callback to remove from UI
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        type: "error",
        description: "Failed to delete notification"
      });
      setIsDeleting(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    setIsSubmittingFeedback(true);

    try {
      const response = await fetch("/api/jeeves/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: notification.id,
          helpful,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setFeedbackSubmitted(true);
      toast({
        type: "success",
        description: helpful
          ? "Thanks! Jeeves will send more like this"
          : "Thanks! Jeeves will adjust future notifications"
      });
    } catch (error) {
      console.error("Feedback error:", error);
      toast({
        type: "error",
        description: "Failed to submit feedback"
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const isUnread = !notification.viewedAt;

  return (
    <Card className={isUnread ? "border-blue-500 border-2" : ""}>
      <CardContent className="pt-4 pb-4">
        {/* Header - Always visible */}
        <div
          className="flex items-start justify-between mb-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 flex-1">
            <Badge variant="outline">{notification.personaName}</Badge>
            {notification.format && (
              <Badge variant="secondary" className="text-xs">
                {notification.format}
              </Badge>
            )}
            {isUnread && (
              <Badge variant="default" className="text-xs animate-pulse">
                NEW
              </Badge>
            )}
            <button className="ml-auto text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          <span className="text-xs text-muted-foreground ml-4">
            {new Date(notification.sentAt).toLocaleString()}
          </span>
        </div>

        {/* Subject */}
        {notification.subject && (
          <h4 className="font-semibold text-lg mb-2">{notification.subject}</h4>
        )}

        {/* One-liner summary - Always visible */}
        {notification.summaryOneLiner && (
          <p className="text-sm text-muted-foreground mb-3">
            {notification.summaryOneLiner}
          </p>
        )}

        {/* Expanded content - ONLY when expanded */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Full HTML body (strip out dashboard links - we'll add one below) */}
            <div
              className="prose prose-sm max-w-none dark:prose-invert [&_a[href*='/d/']]:hidden"
              dangerouslySetInnerHTML={{ __html: notification.bodyHtml }}
            />
          </div>
        )}

        {/* Single unified dashboard button - ONLY if dashboard exists */}
        {notification.embedDashboardUrl && (
          <div className="mt-3">
            <Button size="sm" variant="default" asChild>
              <a
                href={notification.embedDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                📊 Open Interactive Dashboard
                <ExternalLink size={14} />
              </a>
            </Button>
          </div>
        )}

        {/* Feedback and Delete buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t items-center">
          <div className="flex gap-2 flex-1">
            {feedbackSubmitted ? (
              <div className="text-sm text-muted-foreground">
                ✓ Feedback submitted. Thank you!
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFeedback(true)}
                  disabled={isSubmittingFeedback}
                >
                  👍 Helpful
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFeedback(false)}
                  disabled={isSubmittingFeedback}
                >
                  👎 Not helpful
                </Button>
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
