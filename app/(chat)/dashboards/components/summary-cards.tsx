"use client";

import { BarChart3, Activity, Eye, Calendar } from "lucide-react";

interface SummaryCardsProps {
  summary: {
    totalDashboards: number;
    activeDashboards: number;
    totalViews: number;
  };
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      title: "Total Dashboards",
      value: summary.totalDashboards,
      icon: BarChart3,
      description: "Published dashboards",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Today",
      value: summary.activeDashboards,
      icon: Activity,
      description: "Currently accessible",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Views",
      value: summary.totalViews,
      icon: Eye,
      description: "All time views",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Published This Week",
      value: 0, // TODO: Calculate this
      icon: Calendar,
      description: "New this week",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {card.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </div>
            <div className={`p-3 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}