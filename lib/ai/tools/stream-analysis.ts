import { z } from "zod";
import { tool } from "ai";

// Import all stream analysis functions
import {
  getStreamRecentData,
  getStreamTimeWindow,
  getStreamInfo,
  getMultipleStreams,
  listAvailableStreams
} from "@/lib/monitoring/stream-tools";

import {
  analyzeStreamStatistics,
  analyzeStreamTrend,
  analyzeStreamAnomalies,
  analyzeStreamPatterns,
  analyzeStreamAutocorrelation,
  analyzeStreamMovingAverage
} from "@/lib/monitoring/analysis-tools";

import {
  correlateTwoStreams,
  correlateMultipleStreams,
  testStreamCausality,
  detectSynchronizedStreamEvents,
  analyzeCascadingStreamFailures
} from "@/lib/monitoring/multi-stream-tools";

import {
  assessStreamDataQuality,
  monitorStreamHealth,
  compareStreamQualityPeriods
} from "@/lib/monitoring/quality-tools";

// =============================================================================
// DATA RETRIEVAL TOOLS
// =============================================================================

export const getStreamRecentDataTool = tool({
  description: `Get recent data points from a specific stream with rich context and quality assessment.

CRITICAL RULES:
1. ALWAYS use listAvailableStreamsTool FIRST to get exact stream names
2. NEVER invent or guess stream names - use EXACT names from the list
3. Stream names are case-sensitive and must match exactly
4. Always check the valueType field before interpreting data:
   - valueType: 'binary' (0/1 only - use status display, NOT counters)
   - valueType: 'percentage' (0-100% - use bar/gauge charts)
   - valueType: 'continuous' (temperature, etc - use line charts)

NEVER treat binary occupancy (0/1) as a people counter!`,
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool (e.g., 'fcu-01_04-spacetemp', 'fcu-01_04-heatoutput'). Do NOT guess or modify names!"),
    count: z.number().optional().default(100).describe("Number of recent data points to retrieve")
  }),
  execute: async ({ streamId, count }) => {
    return await getStreamRecentData({ streamId, count });
  }
});

export const getStreamTimeWindowTool = tool({
  description: `Get stream data for a specific time window with context and quality metrics.

CRITICAL RULES:
1. ALWAYS use listAvailableStreamsTool FIRST to get exact stream names
2. NEVER invent or guess stream names - use EXACT names from the list
3. Always check the valueType field before interpreting data:
   - valueType: 'binary' (0/1 only - use status display, NOT counters)
   - valueType: 'percentage' (0-100% - use bar/gauge charts)
   - valueType: 'continuous' (temperature, etc - use line charts)

NEVER treat binary occupancy (0/1) as a people counter!`,
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool. Do NOT guess names!"),
    fromMinutesAgo: z.number().describe("Start time in minutes ago"),
    toMinutesAgo: z.number().optional().default(0).describe("End time in minutes ago (0 = now)")
  }),
  execute: async ({ streamId, fromMinutesAgo, toMinutesAgo }) => {
    const to = new Date(Date.now() - toMinutesAgo * 60_000);
    const from = new Date(Date.now() - fromMinutesAgo * 60_000);
    return await getStreamTimeWindow({ streamId, from, to });
  }
});

export const getStreamInfoTool = tool({
  description: `Get comprehensive metadata and characteristics for a specific stream.

CRITICAL: Use EXACT stream names from listAvailableStreamsTool! Do NOT guess or invent names!

Includes critical valueType metadata:
- valueType: 'binary' (0/1 only - NOT a counter!)
- valueType: 'percentage' (0-100% range)
- valueType: 'continuous' (temperature, etc)

Always check valueType before creating dashboards!`,
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool. Do NOT guess names!")
  }),
  execute: async ({ streamId }) => {
    return await getStreamInfo(streamId);
  }
});

export const getMultipleStreamsTool = tool({
  description: `Load multiple streams simultaneously for cross-stream analysis.

CRITICAL: Use EXACT stream names from listAvailableStreamsTool! Do NOT guess or invent stream names!`,
  inputSchema: z.object({
    streamIds: z.array(z.string()).describe("Array of EXACT stream identifiers from listAvailableStreamsTool"),
    count: z.number().optional().default(200).describe("Number of data points per stream"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for data retrieval")
  }),
  execute: async ({ streamIds, count, timeRange }) => {
    const params: any = { streamIds, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await getMultipleStreams(params);
  }
});

export const listAvailableStreamsTool = tool({
  description: `Discover all available streams in the system with their characteristics.

CRITICAL: Each stream includes valueType metadata to prevent hallucinations!
- valueType: 'binary' (0/1 only - use status display, NOT counters)
- valueType: 'percentage' (0-100% - use bar/gauge charts)
- valueType: 'continuous' (temperature, etc - use line charts)

NEVER treat binary occupancy (0/1) as a people counter!`,
  inputSchema: z.object({
    includeMetadata: z.boolean().optional().default(true).describe("Include detailed metadata for each stream")
  }),
  execute: async ({ includeMetadata }) => {
    return await listAvailableStreams();
  }
});

// =============================================================================
// SINGLE STREAM ANALYSIS TOOLS
// =============================================================================

export const analyzeStreamStatisticsTool = tool({
  description: "Perform comprehensive statistical analysis of a stream (mean, std, distribution, etc.)",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(200).describe("Number of data points to analyze"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId, count, timeRange }) => {
    const params: any = { streamId, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeStreamStatistics(params);
  }
});

export const analyzeStreamTrendTool = tool({
  description: "Analyze trend patterns in stream data (linear trends, direction, strength)",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(200).describe("Number of data points to analyze"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId, count, timeRange }) => {
    const params: any = { streamId, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeStreamTrend(params);
  }
});

export const analyzeStreamAnomaliesTool = tool({
  description: "Detect anomalies in stream data using multiple sophisticated methods",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(300).describe("Number of data points to analyze"),
    methods: z.array(z.enum(['z-score', 'modified-z-score', 'iqr', 'lof', 'ensemble'])).optional()
      .describe("Anomaly detection methods to use"),
    threshold: z.number().optional().describe("Detection threshold"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId, count, methods, threshold, timeRange }) => {
    const params: any = { streamId, count, methods, threshold };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeStreamAnomalies(params);
  }
});

export const analyzeStreamPatternsTool = tool({
  description: "Detect patterns, cycles, and repeating structures in stream data",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(400).describe("Number of data points to analyze"),
    patternTypes: z.array(z.enum(['peaks', 'cycles', 'repeating', 'seasonal'])).optional()
      .describe("Types of patterns to detect"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId, count, patternTypes, timeRange }) => {
    const params: any = { streamId, count, patternTypes };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeStreamPatterns(params);
  }
});

export const analyzeStreamAutocorrelationTool = tool({
  description: "Analyze autocorrelation to find periodic patterns and self-similarity",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(300).describe("Number of data points to analyze"),
    maxLag: z.number().optional().default(50).describe("Maximum lag to analyze")
  }),
  execute: async ({ streamId, count, maxLag }) => {
    return await analyzeStreamAutocorrelation({ streamId, count, maxLag });
  }
});

export const analyzeStreamMovingAverageTool = tool({
  description: "Calculate moving averages and smooth trends in stream data",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(200).describe("Number of data points to analyze"),
    window: z.number().optional().default(10).describe("Moving average window size"),
    type: z.enum(['simple', 'exponential']).optional().default('simple').describe("Moving average method"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId, count, window, type, timeRange }) => {
    const params: any = { streamId, count, window, type };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeStreamMovingAverage(params);
  }
});

// =============================================================================
// MULTI-STREAM ANALYSIS TOOLS
// =============================================================================

export const correlateTwoStreamsTool = tool({
  description: "Calculate correlation between two streams with lag analysis",
  inputSchema: z.object({
    streamId1: z.string().describe("First stream identifier"),
    streamId2: z.string().describe("Second stream identifier"),
    count: z.number().optional().default(200).describe("Number of data points to analyze"),
    maxLag: z.number().optional().describe("Maximum lag for cross-correlation analysis"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId1, streamId2, count, maxLag, timeRange }) => {
    const params: any = { streamId1, streamId2, count, maxLag };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await correlateTwoStreams(params);
  }
});

export const correlateMultipleStreamsTool = tool({
  description: "Generate correlation matrix for multiple streams to find relationships",
  inputSchema: z.object({
    streamIds: z.array(z.string()).describe("Array of stream identifiers to correlate"),
    count: z.number().optional().default(200).describe("Number of data points per stream"),
    significanceThreshold: z.number().optional().default(0.3).describe("Minimum correlation for significance"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamIds, count, significanceThreshold, timeRange }) => {
    const params: any = { streamIds, count, significanceThreshold };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await correlateMultipleStreams(params);
  }
});

export const testStreamCausalityTool = tool({
  description: "Test for Granger causality between two streams (does one stream predict another?)",
  inputSchema: z.object({
    streamId1: z.string().describe("First stream identifier (potential cause)"),
    streamId2: z.string().describe("Second stream identifier (potential effect)"),
    maxLag: z.number().optional().default(10).describe("Maximum lag to test for causality"),
    count: z.number().optional().default(300).describe("Number of data points to analyze"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamId1, streamId2, maxLag, count, timeRange }) => {
    const params: any = { streamId1, streamId2, maxLag, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await testStreamCausality(params);
  }
});

export const detectSynchronizedStreamEventsTool = tool({
  description: "Detect synchronized events across multiple streams (system-wide incidents)",
  inputSchema: z.object({
    streamIds: z.array(z.string()).describe("Array of stream identifiers to analyze"),
    timeWindow: z.number().optional().default(3).describe("Time window for event synchronization"),
    threshold: z.number().optional().default(2.0).describe("Anomaly threshold for event detection"),
    count: z.number().optional().default(500).describe("Number of data points per stream"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamIds, timeWindow, threshold, count, timeRange }) => {
    const params: any = { streamIds, timeWindow, threshold, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await detectSynchronizedStreamEvents(params);
  }
});

export const analyzeCascadingStreamFailuresTool = tool({
  description: "Analyze cascading failure patterns (how issues propagate between streams)",
  inputSchema: z.object({
    streamIds: z.array(z.string()).describe("Array of stream identifiers to analyze"),
    maxDelay: z.number().optional().default(10).describe("Maximum delay for cascade propagation"),
    count: z.number().optional().default(400).describe("Number of data points per stream"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis")
  }),
  execute: async ({ streamIds, maxDelay, count, timeRange }) => {
    const params: any = { streamIds, maxDelay, count };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await analyzeCascadingStreamFailures(params);
  }
});

// =============================================================================
// QUALITY ASSESSMENT TOOLS
// =============================================================================

export const assessStreamDataQualityTool = tool({
  description: "Comprehensive data quality assessment with A-F grading and actionable recommendations",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    count: z.number().optional().default(500).describe("Number of data points to assess"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for assessment"),
    expectedRange: z.object({
      min: z.number(),
      max: z.number()
    }).optional().describe("Expected value range for the sensor"),
    expectedSamplingRate: z.number().optional().describe("Expected sampling rate (samples per second)")
  }),
  execute: async ({ streamId, count, timeRange, expectedRange, expectedSamplingRate }) => {
    const params: any = { streamId, count, expectedRange, expectedSamplingRate };
    if (timeRange) {
      params.timeRange = {
        from: new Date(Date.now() - timeRange.fromMinutesAgo * 60_000),
        to: new Date(Date.now() - (timeRange.toMinutesAgo || 0) * 60_000)
      };
    }
    return await assessStreamDataQuality(params);
  }
});

export const monitorStreamHealthTool = tool({
  description: "Monitor data health trends over time with change detection",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    timeRangeMinutes: z.number().default(120).describe("Time range in minutes for health monitoring"),
    windowSize: z.number().optional().default(100).describe("Size of sliding window for trend analysis")
  }),
  execute: async ({ streamId, timeRangeMinutes, windowSize }) => {
    const to = new Date();
    const from = new Date(Date.now() - timeRangeMinutes * 60_000);
    return await monitorStreamHealth({ streamId, timeRange: { from, to }, windowSize });
  }
});

export const compareStreamQualityPeriodsTool = tool({
  description: "Compare data quality between two different time periods",
  inputSchema: z.object({
    streamId: z.string().describe("EXACT stream identifier from listAvailableStreamsTool - do NOT guess!"),
    period1Minutes: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number()
    }).describe("First time period for comparison"),
    period2Minutes: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number()
    }).describe("Second time period for comparison")
  }),
  execute: async ({ streamId, period1Minutes, period2Minutes }) => {
    const period1 = {
      from: new Date(Date.now() - period1Minutes.fromMinutesAgo * 60_000),
      to: new Date(Date.now() - period1Minutes.toMinutesAgo * 60_000)
    };
    const period2 = {
      from: new Date(Date.now() - period2Minutes.fromMinutesAgo * 60_000),
      to: new Date(Date.now() - period2Minutes.toMinutesAgo * 60_000)
    };
    return await compareStreamQualityPeriods({ streamId, period1, period2 });
  }
});

// =============================================================================
// TOOL COLLECTION EXPORT
// =============================================================================

export const streamAnalysisTools = {
  // Data Retrieval Tools (5)
  getStreamRecentDataTool,
  getStreamTimeWindowTool,
  getStreamInfoTool,
  getMultipleStreamsTool,
  listAvailableStreamsTool,

  // Single Stream Analysis Tools (6)
  analyzeStreamStatisticsTool,
  analyzeStreamTrendTool,
  analyzeStreamAnomaliesTool,
  analyzeStreamPatternsTool,
  analyzeStreamAutocorrelationTool,
  analyzeStreamMovingAverageTool,

  // Multi-Stream Analysis Tools (5)
  correlateTwoStreamsTool,
  correlateMultipleStreamsTool,
  testStreamCausalityTool,
  detectSynchronizedStreamEventsTool,
  analyzeCascadingStreamFailuresTool,

  // Quality Assessment Tools (3)
  assessStreamDataQualityTool,
  monitorStreamHealthTool,
  compareStreamQualityPeriodsTool
};

export const streamAnalysisToolNames = Object.keys(streamAnalysisTools);

console.log(`🔧 Stream Analysis AI Tools: ${streamAnalysisToolNames.length} high-level tools ready for LLM use`);