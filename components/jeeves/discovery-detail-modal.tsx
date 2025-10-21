"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Send, Loader2 } from "lucide-react";
import type { JeevesDiscovery } from "@/lib/db/schema";
import { AnalysisTrail } from "./analysis-trail";

interface DiscoveryDetailModalProps {
  discovery: JeevesDiscovery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function DiscoveryDetailModal({
  discovery,
  open,
  onOpenChange,
}: DiscoveryDetailModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset chat when discovery changes
  useEffect(() => {
    if (discovery) {
      setMessages([
        {
          role: "assistant",
          content: `I'm here to answer questions about this discovery: **${discovery.title}**\n\nWhat would you like to know?`,
        },
      ]);
    }
  }, [discovery?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!discovery) return null;

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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);

    try {
      // Call chat API with discovery context
      const response = await fetch("/api/jeeves/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discoveryId: discovery.id,
          messages: newMessages,
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Plain text streaming - append chunks directly
          const chunk = decoder.decode(value, { stream: true });
          assistantMessage += chunk;

          // Update message with accumulated content
          setMessages([
            ...newMessages,
            { role: "assistant", content: assistantMessage },
          ]);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{getSeverityIcon(discovery.severity)}</span>
            {discovery.title}
          </DialogTitle>
        </DialogHeader>

        {/* Discovery Details - Scrollable */}
        <ScrollArea className="flex-1 max-h-[50vh] overflow-y-auto pr-4">
          <div className="space-y-4">
            {/* Metadata Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getSeverityColor(discovery.severity)}>
                {discovery.severity}
              </Badge>
              {discovery.category && (
                <Badge variant="secondary">{discovery.category}</Badge>
              )}
              {confidence > 0 && (
                <Badge variant="outline">{confidence.toFixed(0)}% confidence</Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(discovery.discoveredAt).toLocaleString()}
              </span>
            </div>

            {/* Dashboard Link */}
            {discovery.visualReportUrl && (
              <Button size="sm" variant="outline" asChild className="w-full">
                <a
                  href={discovery.visualReportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  📊 View Dashboard
                  <ExternalLink size={14} />
                </a>
              </Button>
            )}

            {/* Reasoning */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                JEEVES' REASONING
              </div>
              <p className="text-sm leading-relaxed">{discovery.aiReasoning}</p>
            </div>

            {/* Hypothesis */}
            {discovery.aiHypothesis && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  HYPOTHESIS
                </div>
                <p className="text-sm leading-relaxed">{discovery.aiHypothesis}</p>
              </div>
            )}

            {/* Recommendations */}
            {discovery.aiRecommendations && Array.isArray(discovery.aiRecommendations) && discovery.aiRecommendations.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  RECOMMENDATIONS
                </div>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {discovery.aiRecommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Analysis Trail */}
            {discovery.aiEvidence && (discovery.aiEvidence as any).toolUsageTrail && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  ANALYSIS TRAIL
                </div>
                <AnalysisTrail trail={(discovery.aiEvidence as any).toolUsageTrail} />
              </div>
            )}

            {/* Recipients */}
            {recipients.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  NOTIFIED TEAM MEMBERS
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipients.map((recipient: any, index: number) => (
                    <Badge key={index} variant="outline">
                      {recipient.personaName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Chat Interface */}
        <div className="border-t pt-4 mt-4 space-y-3 flex-shrink-0">
          <div className="text-sm font-semibold text-muted-foreground">
            💬 Chat with Jeeves
          </div>

          {/* Chat Messages */}
          <ScrollArea
            ref={scrollRef}
            className="h-48 border rounded-lg p-3 bg-muted/30"
          >
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Jeeves about this discovery... (Shift+Enter for new line)"
              className="resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="self-end"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
