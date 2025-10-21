"use client";

import { useState } from "react";
import { NotificationCard } from "./notification-card";
import type { JeevesNotification } from "@/lib/db/schema";

interface NotificationsListProps {
  initialNotifications: JeevesNotification[];
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const handleDelete = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  if (notifications.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-lg mb-2">No notifications yet</p>
        <p className="text-sm">
          Jeeves will send personalized notifications when discoveries are made
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDelete={() => handleDelete(notification.id)}
        />
      ))}
    </div>
  );
}
