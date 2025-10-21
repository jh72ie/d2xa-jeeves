import { z } from "zod";
import { tool } from "ai";

// Import tool collections
import { streamAnalysisTools, streamAnalysisToolNames } from "./stream-analysis";
import { mathematicalFunctionTools, mathematicalFunctionToolNames } from "./mathematical-functions";

// =============================================================================
// TOOL DISCOVERY AND RECOMMENDATION SYSTEM
// =============================================================================

export interface ToolMetadata {
  name: string;
  category: 'data-retrieval' | 'statistics' | 'time-series' | 'patterns' | 'anomalies' | 'correlation' | 'quality';
  subcategory: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
  dataRequirements: {
    minPoints: number;
    maxPoints?: number;
    requiresTimeOrder: boolean;
    requiresMultipleStreams: boolean;
  };
  outputType: 'numeric' | 'analysis' | 'detection' | 'visualization';
  useCases: string[];
  relatedTools: string[];
  prerequisites?: string[];
}

export const TOOL_CATALOG: Record<string, ToolMetadata> = {
  // Data Retrieval Tools
  'getStreamRecentDataTool': {
    name: 'getStreamRecentDataTool',
    category: 'data-retrieval',
    subcategory: 'basic-access',
    complexity: 'basic',
    dataRequirements: { minPoints: 1, requiresTimeOrder: false, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['initial-exploration', 'data-inspection', 'quick-overview'],
    relatedTools: ['getStreamInfoTool', 'analyzeStreamStatisticsTool']
  },

  'getStreamTimeWindowTool': {
    name: 'getStreamTimeWindowTool',
    category: 'data-retrieval',
    subcategory: 'time-based',
    complexity: 'basic',
    dataRequirements: { minPoints: 1, requiresTimeOrder: true, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['historical-analysis', 'specific-period', 'time-range-investigation'],
    relatedTools: ['analyzeStreamTrendTool', 'detectChangePointsTool']
  },

  'listAvailableStreamsTool': {
    name: 'listAvailableStreamsTool',
    category: 'data-retrieval',
    subcategory: 'discovery',
    complexity: 'basic',
    dataRequirements: { minPoints: 0, requiresTimeOrder: false, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['system-discovery', 'stream-inventory', 'initial-setup'],
    relatedTools: ['getStreamInfoTool', 'correlateMultipleStreamsTool']
  },

  // Statistical Analysis Tools
  'analyzeStreamStatisticsTool': {
    name: 'analyzeStreamStatisticsTool',
    category: 'statistics',
    subcategory: 'descriptive',
    complexity: 'basic',
    dataRequirements: { minPoints: 10, requiresTimeOrder: false, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['data-summary', 'distribution-analysis', 'baseline-establishment'],
    relatedTools: ['calculateBasicStatsTool', 'testNormalityTool'],
    prerequisites: ['getStreamRecentDataTool']
  },

  'analyzeStreamTrendTool': {
    name: 'analyzeStreamTrendTool',
    category: 'time-series',
    subcategory: 'trend-analysis',
    complexity: 'intermediate',
    dataRequirements: { minPoints: 20, requiresTimeOrder: true, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['trend-detection', 'performance-monitoring', 'forecasting-prep'],
    relatedTools: ['calculateLinearTrendTool', 'detectChangePointsTool'],
    prerequisites: ['getStreamTimeWindowTool']
  },

  // Anomaly Detection Tools
  'analyzeStreamAnomaliesTool': {
    name: 'analyzeStreamAnomaliesTool',
    category: 'anomalies',
    subcategory: 'detection',
    complexity: 'intermediate',
    dataRequirements: { minPoints: 50, requiresTimeOrder: false, requiresMultipleStreams: false },
    outputType: 'detection',
    useCases: ['anomaly-detection', 'outlier-identification', 'quality-control'],
    relatedTools: ['ensembleAnomalyDetectionTool', 'assessStreamDataQualityTool'],
    prerequisites: ['analyzeStreamStatisticsTool']
  },

  // Pattern Detection Tools
  'analyzeStreamPatternsTool': {
    name: 'analyzeStreamPatternsTool',
    category: 'patterns',
    subcategory: 'detection',
    complexity: 'advanced',
    dataRequirements: { minPoints: 100, requiresTimeOrder: true, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['pattern-recognition', 'cyclical-analysis', 'behavior-identification'],
    relatedTools: ['detectCyclicPatternsTool', 'findPeaksTool'],
    prerequisites: ['analyzeStreamTrendTool']
  },

  // Multi-Stream Analysis Tools
  'correlateMultipleStreamsTool': {
    name: 'correlateMultipleStreamsTool',
    category: 'correlation',
    subcategory: 'multi-stream',
    complexity: 'advanced',
    dataRequirements: { minPoints: 50, requiresTimeOrder: false, requiresMultipleStreams: true },
    outputType: 'analysis',
    useCases: ['relationship-analysis', 'system-correlation', 'cross-impact-study'],
    relatedTools: ['testStreamCausalityTool', 'detectSynchronizedStreamEventsTool'],
    prerequisites: ['listAvailableStreamsTool']
  },

  // Quality Assessment Tools
  'assessStreamDataQualityTool': {
    name: 'assessStreamDataQualityTool',
    category: 'quality',
    subcategory: 'assessment',
    complexity: 'intermediate',
    dataRequirements: { minPoints: 100, requiresTimeOrder: true, requiresMultipleStreams: false },
    outputType: 'analysis',
    useCases: ['quality-monitoring', 'data-validation', 'reliability-assessment'],
    relatedTools: ['monitorStreamHealthTool', 'compareStreamQualityPeriodsTool'],
    prerequisites: ['getStreamRecentDataTool']
  }
};

export const ANALYSIS_SCENARIOS = {
  'quick-health-check': {
    description: 'Quick assessment of stream health and current status',
    recommendedTools: ['listAvailableStreamsTool', 'getStreamRecentDataTool', 'analyzeStreamStatisticsTool', 'assessStreamDataQualityTool'],
    minDataPoints: 50,
    timeEstimate: 'fast',
    recommendedSteps: 8
  },

  'anomaly-investigation': {
    description: 'Investigate anomalies and unusual patterns in data',
    recommendedTools: ['getStreamTimeWindowTool', 'analyzeStreamAnomaliesTool', 'analyzeStreamTrendTool', 'detectChangePointsTool'],
    minDataPoints: 100,
    timeEstimate: 'medium',
    recommendedSteps: 12
  },

  'performance-analysis': {
    description: 'Analyze performance trends and patterns over time',
    recommendedTools: ['getStreamTimeWindowTool', 'analyzeStreamTrendTool', 'analyzeStreamPatternsTool', 'monitorStreamHealthTool'],
    minDataPoints: 200,
    timeEstimate: 'medium',
    recommendedSteps: 10
  },

  'system-correlation': {
    description: 'Analyze relationships and correlations between multiple streams',
    recommendedTools: ['listAvailableStreamsTool', 'correlateMultipleStreamsTool', 'testStreamCausalityTool', 'detectSynchronizedStreamEventsTool'],
    minDataPoints: 100,
    timeEstimate: 'slow',
    recommendedSteps: 15
  },

  'root-cause-analysis': {
    description: 'Deep investigation to find root causes of issues',
    recommendedTools: ['detectSynchronizedStreamEventsTool', 'analyzeCascadingStreamFailuresTool', 'testStreamCausalityTool', 'analyzeStreamPatternsTool'],
    minDataPoints: 300,
    timeEstimate: 'slow',
    recommendedSteps: 20
  },

  'data-exploration': {
    description: 'Comprehensive exploration of unknown or new data',
    recommendedTools: ['listAvailableStreamsTool', 'getStreamInfoTool', 'analyzeStreamStatisticsTool', 'analyzeStreamPatternsTool'],
    minDataPoints: 100,
    timeEstimate: 'medium',
    recommendedSteps: 12
  }
};

// =============================================================================
// TOOL DISCOVERY AI TOOLS
// =============================================================================

export const discoverToolsTool = tool({
  description: "Get tool recommendations based on analysis goals and data characteristics",
  inputSchema: z.object({
    analysisGoal: z.enum([
      'quick-health-check',
      'anomaly-investigation',
      'performance-analysis',
      'system-correlation',
      'root-cause-analysis',
      'data-exploration',
      'custom'
    ]).describe("Primary analysis goal"),
    availableDataPoints: z.number().optional().describe("Approximate number of data points available"),
    numberOfStreams: z.number().optional().default(1).describe("Number of streams to analyze"),
    timeOrdered: z.boolean().optional().default(true).describe("Whether data has temporal ordering"),
    customDescription: z.string().optional().describe("Custom description if goal is 'custom'")
  }),
  execute: async ({ analysisGoal, availableDataPoints, numberOfStreams, timeOrdered, customDescription }) => {
    let scenario = ANALYSIS_SCENARIOS[analysisGoal as keyof typeof ANALYSIS_SCENARIOS];

    if (analysisGoal === 'custom' && customDescription) {
      // For custom scenarios, provide general recommendations
      scenario = {
        description: customDescription,
        recommendedTools: ['listAvailableStreamsTool', 'getStreamInfoTool', 'analyzeStreamStatisticsTool'],
        minDataPoints: 50,
        timeEstimate: 'medium',
        recommendedSteps: 10
      };
    }

    if (!scenario) {
      throw new Error(`Unknown analysis scenario: ${analysisGoal}`);
    }

    // Filter tools based on data characteristics
    const suitableTools = scenario.recommendedTools.filter(toolName => {
      const metadata = TOOL_CATALOG[toolName];
      if (!metadata) return true; // Include unknown tools

      // Check data point requirements
      if (availableDataPoints && availableDataPoints < metadata.dataRequirements.minPoints) {
        return false;
      }

      // Check stream requirements
      if (metadata.dataRequirements.requiresMultipleStreams && numberOfStreams < 2) {
        return false;
      }

      // Check time ordering requirements
      if (metadata.dataRequirements.requiresTimeOrder && !timeOrdered) {
        return false;
      }

      return true;
    });

    // Add complexity-based recommendations
    const recommendations = suitableTools.map(toolName => {
      const metadata = TOOL_CATALOG[toolName];
      return {
        toolName,
        category: metadata?.category || 'unknown',
        complexity: metadata?.complexity || 'basic',
        useCases: metadata?.useCases || [],
        reason: `Suitable for ${analysisGoal} scenario`
      };
    });

    return {
      scenario: {
        goal: analysisGoal,
        description: scenario.description,
        estimatedTime: scenario.timeEstimate,
        minDataPoints: scenario.minDataPoints,
        recommendedSteps: scenario.recommendedSteps
      },
      recommendations,
      dataCompatibility: {
        availableDataPoints,
        numberOfStreams,
        timeOrdered,
        sufficient: !availableDataPoints || availableDataPoints >= scenario.minDataPoints
      },
      stepGuidance: {
        recommendedStepLimit: scenario.recommendedSteps,
        usage: `Use stepCountIs(${scenario.recommendedSteps}) or while loop with maxSteps = ${scenario.recommendedSteps}`,
        rationale: `${scenario.recommendedTools.length} tools + follow-up analysis + synthesis`
      },
      nextSteps: suitableTools.slice(0, 3) // First 3 tools as immediate next steps
    };
  }
});

export const getToolInfoTool = tool({
  description: "Get detailed information about a specific analysis tool",
  inputSchema: z.object({
    toolName: z.string().describe("Name of the tool to get information about"),
    includeRelated: z.boolean().optional().default(true).describe("Include related tools information")
  }),
  execute: async ({ toolName, includeRelated }) => {
    const metadata = TOOL_CATALOG[toolName];

    if (!metadata) {
      // Check if it's a mathematical function tool
      if (mathematicalFunctionToolNames.includes(toolName)) {
        return {
          toolName,
          category: 'mathematical-function',
          type: 'low-level',
          description: 'Mathematical function for direct computation',
          usage: 'Typically used by higher-level analysis tools'
        };
      }

      return {
        error: `Tool '${toolName}' not found in catalog`,
        availableTools: [...streamAnalysisToolNames, ...mathematicalFunctionToolNames].slice(0, 10)
      };
    }

    const result: any = {
      toolName: metadata.name,
      category: metadata.category,
      subcategory: metadata.subcategory,
      complexity: metadata.complexity,
      dataRequirements: metadata.dataRequirements,
      outputType: metadata.outputType,
      useCases: metadata.useCases,
      prerequisites: metadata.prerequisites || []
    };

    if (includeRelated && metadata.relatedTools.length > 0) {
      result.relatedTools = metadata.relatedTools.map(relatedName => {
        const relatedMeta = TOOL_CATALOG[relatedName];
        return {
          name: relatedName,
          category: relatedMeta?.category || 'unknown',
          complexity: relatedMeta?.complexity || 'basic'
        };
      });
    }

    return result;
  }
});

export const suggestWorkflowTool = tool({
  description: "Suggest a complete workflow of tools for a specific analysis task",
  inputSchema: z.object({
    task: z.string().describe("Description of the analysis task"),
    streamIds: z.array(z.string()).optional().describe("Specific stream IDs to analyze"),
    timeRange: z.object({
      fromMinutesAgo: z.number(),
      toMinutesAgo: z.number().optional().default(0)
    }).optional().describe("Time range for analysis"),
    priority: z.enum(['speed', 'accuracy', 'comprehensive']).optional().default('accuracy')
      .describe("Analysis priority: speed (fast), accuracy (reliable), comprehensive (thorough)")
  }),
  execute: async ({ task, streamIds, timeRange, priority }) => {
    // Analyze task to determine appropriate scenario
    let suggestedScenario = 'data-exploration';

    if (task.toLowerCase().includes('anomal') || task.toLowerCase().includes('outlier')) {
      suggestedScenario = 'anomaly-investigation';
    } else if (task.toLowerCase().includes('trend') || task.toLowerCase().includes('performance')) {
      suggestedScenario = 'performance-analysis';
    } else if (task.toLowerCase().includes('correlat') || task.toLowerCase().includes('relationship')) {
      suggestedScenario = 'system-correlation';
    } else if (task.toLowerCase().includes('root cause') || task.toLowerCase().includes('failure')) {
      suggestedScenario = 'root-cause-analysis';
    } else if (task.toLowerCase().includes('health') || task.toLowerCase().includes('status')) {
      suggestedScenario = 'quick-health-check';
    }

    const scenario = ANALYSIS_SCENARIOS[suggestedScenario as keyof typeof ANALYSIS_SCENARIOS];

    // Create workflow based on priority
    let workflow: string[] = [];

    if (priority === 'speed') {
      workflow = scenario.recommendedTools.slice(0, 2); // Just the first 2 tools
    } else if (priority === 'comprehensive') {
      workflow = [...scenario.recommendedTools];
      // Add additional tools for comprehensive analysis
      if (suggestedScenario === 'anomaly-investigation') {
        workflow.push('assessStreamDataQualityTool', 'analyzeStreamPatternsTool');
      }
    } else {
      workflow = scenario.recommendedTools; // Standard workflow
    }

    // Add data preparation steps if needed
    if (!workflow.includes('listAvailableStreamsTool') && !streamIds) {
      workflow.unshift('listAvailableStreamsTool');
    }

    if (!workflow.includes('getStreamRecentDataTool') && !workflow.includes('getStreamTimeWindowTool')) {
      const dataRetrievalTool = timeRange ? 'getStreamTimeWindowTool' : 'getStreamRecentDataTool';
      workflow.splice(1, 0, dataRetrievalTool);
    }

    // Generate step-by-step instructions
    const steps = workflow.map((toolName, index) => {
      const metadata = TOOL_CATALOG[toolName];
      return {
        step: index + 1,
        toolName,
        category: metadata?.category || 'unknown',
        purpose: metadata?.useCases[0] || 'analysis',
        expectedOutput: metadata?.outputType || 'analysis',
        dependencies: metadata?.prerequisites || []
      };
    });

    return {
      task,
      suggestedScenario,
      priority,
      workflow: {
        totalSteps: workflow.length,
        estimatedTime: scenario.timeEstimate,
        minDataPoints: scenario.minDataPoints,
        recommendedStepLimit: scenario.recommendedSteps + Math.ceil(workflow.length * 0.3), // Add 30% buffer
        steps
      },
      parameters: {
        streamIds: streamIds || 'to-be-determined',
        timeRange: timeRange || 'recent-data',
        analysisDepth: priority
      },
      stepConfiguration: {
        recommendedLimit: scenario.recommendedSteps + Math.ceil(workflow.length * 0.3),
        aiSdkUsage: `stepCountIs(${scenario.recommendedSteps + Math.ceil(workflow.length * 0.3)})`,
        whileLoopUsage: `maxSteps = ${scenario.recommendedSteps + Math.ceil(workflow.length * 0.3)}`
      },
      executionTips: [
        'Start with data retrieval tools to understand available data',
        'Use statistical analysis to establish baselines before advanced analysis',
        'Consider data quality assessment if results seem unexpected',
        'Use multi-stream tools only when analyzing relationships between systems',
        `Set step limit to ${scenario.recommendedSteps + Math.ceil(workflow.length * 0.3)} for this workflow`
      ]
    };
  }
});

export const validateToolCompatibilityTool = tool({
  description: "Check if tools are compatible with available data and analysis requirements",
  inputSchema: z.object({
    toolNames: z.array(z.string()).describe("List of tool names to validate"),
    dataCharacteristics: z.object({
      dataPoints: z.number().describe("Number of available data points"),
      numberOfStreams: z.number().describe("Number of streams available"),
      hasTimeOrdering: z.boolean().describe("Whether data has temporal ordering"),
      timeSpanMinutes: z.number().optional().describe("Time span of available data in minutes")
    }).describe("Characteristics of available data")
  }),
  execute: async ({ toolNames, dataCharacteristics }) => {
    const validationResults = toolNames.map(toolName => {
      const metadata = TOOL_CATALOG[toolName];

      if (!metadata) {
        return {
          toolName,
          compatible: false,
          reason: 'Tool not found in catalog',
          suggestions: []
        };
      }

      const issues: string[] = [];
      const suggestions: string[] = [];

      // Check data point requirements
      if (dataCharacteristics.dataPoints < metadata.dataRequirements.minPoints) {
        issues.push(`Requires ${metadata.dataRequirements.minPoints} data points, but only ${dataCharacteristics.dataPoints} available`);
        suggestions.push(`Collect more data or use tools requiring fewer data points`);
      }

      // Check maximum data points if specified
      if (metadata.dataRequirements.maxPoints && dataCharacteristics.dataPoints > metadata.dataRequirements.maxPoints) {
        issues.push(`Optimal for ≤${metadata.dataRequirements.maxPoints} data points, but ${dataCharacteristics.dataPoints} available`);
        suggestions.push(`Consider sampling or using tools designed for larger datasets`);
      }

      // Check stream requirements
      if (metadata.dataRequirements.requiresMultipleStreams && dataCharacteristics.numberOfStreams < 2) {
        issues.push('Requires multiple streams, but only one stream available');
        suggestions.push('Use single-stream analysis tools instead');
      }

      // Check time ordering requirements
      if (metadata.dataRequirements.requiresTimeOrder && !dataCharacteristics.hasTimeOrdering) {
        issues.push('Requires time-ordered data, but data lacks temporal ordering');
        suggestions.push('Use statistical tools that do not require time ordering');
      }

      return {
        toolName,
        compatible: issues.length === 0,
        category: metadata.category,
        complexity: metadata.complexity,
        issues: issues.length > 0 ? issues : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        confidence: issues.length === 0 ? 'high' : issues.length === 1 ? 'medium' : 'low'
      };
    });

    const compatibleTools = validationResults.filter(r => r.compatible).map(r => r.toolName);
    const incompatibleTools = validationResults.filter(r => !r.compatible).map(r => r.toolName);

    return {
      dataCharacteristics,
      overallCompatibility: `${compatibleTools.length}/${toolNames.length} tools compatible`,
      compatibleTools,
      incompatibleTools,
      detailedResults: validationResults,
      recommendations: incompatibleTools.length > 0 ? [
        'Consider using alternative tools with lower data requirements',
        'Collect additional data if high-accuracy analysis is needed',
        'Use ensemble approaches with multiple compatible tools'
      ] : [
        'All tools are compatible with your data',
        'You can proceed with the selected analysis workflow'
      ]
    };
  }
});

// =============================================================================
// TOOL DISCOVERY COLLECTION EXPORT
// =============================================================================

export const toolDiscoveryTools = {
  discoverToolsTool,
  getToolInfoTool,
  suggestWorkflowTool,
  validateToolCompatibilityTool
};

export const toolDiscoveryToolNames = Object.keys(toolDiscoveryTools);

// Combined export of all tools
export const allAnalysisTools = {
  ...streamAnalysisTools,
  ...mathematicalFunctionTools,
  ...toolDiscoveryTools
};

export const allAnalysisToolNames = [
  ...streamAnalysisToolNames,
  ...mathematicalFunctionToolNames,
  ...toolDiscoveryToolNames
];

console.log(`🔧 Tool Discovery System: ${toolDiscoveryToolNames.length} discovery tools ready`);
console.log(`🔧 Complete AI Tool Suite: ${allAnalysisToolNames.length} total tools available for LLM use`);