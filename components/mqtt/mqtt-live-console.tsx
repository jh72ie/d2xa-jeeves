"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseMQTTMessage, getFCUHealthSummary, type FCUStatus, type ParsedMQTTMessage } from "@/lib/mqtt/fcu-parser";

interface MQTTMessage {
  id: string;
  topic: string;
  payload: any;
  timestamp: string;
  receivedAt: string;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function MQTTLiveConsole() {
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAutoScroll]);

  // Connect to SSE stream
  useEffect(() => {
    if (isPaused) return;

    setStatus("connecting");
    setError(null);

    const eventSource = new EventSource("/api/mqtt/stream");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[MQTT Console] Connected to stream");
      setStatus("connected");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "message") {
          const message: MQTTMessage = {
            id: data.id || `msg_${Date.now()}`,
            topic: data.topic,
            payload: data.payload,
            timestamp: data.timestamp,
            receivedAt: new Date().toISOString(),
          };

          setMessages((prev) => {
            const updated = [...prev, message];
            // Keep last 100 messages
            return updated.slice(-100);
          });

          setMessageCount((prev) => prev + 1);
        } else if (data.type === "status") {
          console.log("[MQTT Console] Status update:", data);
        }
      } catch (err) {
        console.error("[MQTT Console] Failed to parse message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[MQTT Console] Stream error:", err);
      setStatus("error");
      setError("Connection lost. Reconnecting...");

      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isPaused]);

  const clearMessages = () => {
    setMessages([]);
    setMessageCount(0);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused && eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
              {getStatusText(status)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {messageCount} messages received
              </Badge>
              <Badge variant="outline">
                {messages.length} in buffer
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {error ? (
                <span className="text-red-500">{error}</span>
              ) : (
                <span>
                  Broker: 4ce6f772...hivemq.cloud | Topic: dt/csg/nbc/hvac/fcu/fcunbs01001/measuredvalue
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMessages}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAutoScroll(!isAutoScroll)}
              >
                Auto-scroll: {isAutoScroll ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Display */}
      <Card>
        <CardHeader>
          <CardTitle>Live Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {isPaused ? (
                  <p>Paused - Click Resume to continue</p>
                ) : status === "connecting" ? (
                  <p>Connecting to MQTT broker...</p>
                ) : status === "error" ? (
                  <p className="text-red-500">Connection error - check console</p>
                ) : (
                  <p>Waiting for messages...</p>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {msg.topic.split("/").pop()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.receivedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {msg.topic}
                        </div>
                      </div>
                    </div>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(msg.payload, null, 2)}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
