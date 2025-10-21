import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 72 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const publishedDashboard = pgTable("PublishedDashboard", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  title: text("title").notNull(),
  description: text("description"),
  html: text("html").notNull(),
  script: text("script").notNull(),
  cardId: varchar("cardId", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  accessToken: varchar("accessToken", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  expiresAt: timestamp("expiresAt"),
  maxViews: text("maxViews"),
  currentViews: text("currentViews").notNull().default("0"),
  streams: jsonb("streams"),
  config: jsonb("config"),
  status: varchar("status", { enum: ["active", "expired", "revoked", "paused"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  lastAccessedAt: timestamp("lastAccessedAt"),
});

export type PublishedDashboard = InferSelectModel<typeof publishedDashboard>;

export const publishedDashboardAccess = pgTable("PublishedDashboardAccess", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  dashboardId: uuid("dashboardId")
    .notNull()
    .references(() => publishedDashboard.id),
  accessedAt: timestamp("accessedAt").notNull().defaultNow(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  referer: text("referer"),
  country: varchar("country", { length: 2 }),
  city: varchar("city", { length: 100 }),
  sessionId: varchar("sessionId", { length: 255 }),
  durationSeconds: text("durationSeconds"),
});

export type PublishedDashboardAccess = InferSelectModel<typeof publishedDashboardAccess>;

// ============================================================================
// Jeeves On Duty - AI Butler System
// ============================================================================

export const jeevesState = pgTable("JeevesState", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  enabled: boolean("enabled").notNull().default(false),
  ingestionEnabled: boolean("ingestionEnabled").notNull().default(true), // Controls FCU data ingestion worker
  analysisInterval: varchar("analysisInterval", { length: 20 }).notNull().default("5min"), // Format: "Nmin" or "Nhour" (e.g., "1hour", "3hour", "6hour", "24hour")
  lastAnalysisAt: timestamp("lastAnalysisAt"),
  nextAnalysisAt: timestamp("nextAnalysisAt"),
  lastExecutionStartedAt: timestamp("lastExecutionStartedAt"), // Lock for preventing concurrent runs
  monitoredStreams: jsonb("monitoredStreams").notNull().default([]),
  totalDiscoveries: text("totalDiscoveries").notNull().default("0"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type JeevesState = InferSelectModel<typeof jeevesState>;

export const jeevesDiscovery = pgTable("JeevesDiscovery", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  discoveredAt: timestamp("discoveredAt").notNull().defaultNow(),
  title: text("title").notNull(),
  category: text("category"),
  severity: varchar("severity", { length: 20 }).notNull().default("normal"),
  confidence: text("confidence"), // Stored as text to avoid precision issues
  aiReasoning: text("aiReasoning").notNull(),
  aiEvidence: jsonb("aiEvidence").notNull(),
  aiHypothesis: text("aiHypothesis"),
  aiRecommendations: jsonb("aiRecommendations"),
  dashboardId: uuid("dashboardId").references(() => publishedDashboard.id),
  dashboardSlug: varchar("dashboardSlug", { length: 255 }),
  visualReportUrl: text("visualReportUrl"),
  personaDashboards: jsonb("personaDashboards").notNull().default([]), // Array of persona-specific dashboards
  intendedRecipients: jsonb("intendedRecipients").notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  metadata: jsonb("metadata"),
});

export type JeevesDiscovery = InferSelectModel<typeof jeevesDiscovery>;

export const jeevesNotification = pgTable("JeevesNotification", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  discoveryId: uuid("discoveryId")
    .notNull()
    .references(() => jeevesDiscovery.id),
  personaName: text("personaName").notNull(),
  format: text("format"),
  subject: text("subject"),
  bodyHtml: text("bodyHtml").notNull(),
  bodyText: text("bodyText"),
  summaryOneLiner: text("summaryOneLiner"),
  embedDashboardUrl: text("embedDashboardUrl"),
  embedChartImages: jsonb("embedChartImages"),
  embedDataTable: jsonb("embedDataTable"),
  sentAt: timestamp("sentAt").notNull().defaultNow(),
  viewedAt: timestamp("viewedAt"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  feedback: jsonb("feedback"),
});

export type JeevesNotification = InferSelectModel<typeof jeevesNotification>;

export const jeevesLearning = pgTable("JeevesLearning", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  discoveryId: uuid("discoveryId").references(() => jeevesDiscovery.id),
  notificationId: uuid("notificationId").references(() => jeevesNotification.id),
  personaName: text("personaName"),
  actionTaken: text("actionTaken"),
  outcome: text("outcome"),
  feedbackScore: text("feedbackScore"), // -1, 0, or 1 as text
  learnedPattern: text("learnedPattern"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type JeevesLearning = InferSelectModel<typeof jeevesLearning>;

export const jeevesActivityLog = pgTable("JeevesActivityLog", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  executionId: uuid("executionId").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  level: varchar("level", { length: 20 }).notNull().default("info"),
  message: text("message").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
});

export type JeevesActivityLog = InferSelectModel<typeof jeevesActivityLog>;
