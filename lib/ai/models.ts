export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Stream Analyst",
    description: "Advanced model for telemetry analysis with visual insights",
  },
  {
    id: "chat-model-reasoning",
    name: "Deep Analyst",
    description:
      "Uses advanced reasoning for complex stream analysis and diagnostics",
  },
];
