import { z } from "zod";
import { tool } from "ai";

// Import all available tools
import { allAnalysisTools } from "./tool-discovery";
import { ANALYSIS_SCENARIOS, TOOL_CATALOG } from "./tool-discovery";

// =============================================================================
// WORKFLOW ORCHESTRATION TYPES
// =============================================================================

export interface WorkflowStep {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  dependencies?: string[]; // IDs of steps that must complete before this one
  optional?: boolean; // If true, workflow continues even if this step fails
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  metadata: {
    estimatedDuration: string;
    dataRequirements: {
      minDataPoints: number;
      minStreams: number;
      requiresTimeOrdering: boolean;
    };
    outputTypes: string[];
  };
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  results: Record<string, any>;
  errors: Array<{
    stepId: string;
    error: string;
    timestamp: Date;
  }>;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

// =============================================================================
// PREDEFINED WORKFLOW TEMPLATES
// =============================================================================

export const WORKFLOW_TEMPLATES: Record<string, WorkflowDefinition> = {
  'comprehensive-stream-analysis': {
    id: 'comprehensive-stream-analysis',
    name: 'Comprehensive Stream Analysis',
    description: 'Complete analysis of a single stream including statistics, trends, anomalies, and patterns',
    steps: [
      {
        id: 'get-data',
        toolName: 'getStreamRecentDataTool',
        parameters: { count: 500 }
      },
      {
        id: 'basic-stats',
        toolName: 'analyzeStreamStatisticsTool',
        parameters: { count: 500 },
        dependencies: ['get-data']
      },
      {
        id: 'trend-analysis',
        toolName: 'analyzeStreamTrendTool',
        parameters: { count: 500 },
        dependencies: ['get-data']
      },
      {
        id: 'anomaly-detection',
        toolName: 'analyzeStreamAnomaliesTool',
        parameters: { count: 500, sensitivity: 'medium' },
        dependencies: ['basic-stats']
      },
      {
        id: 'pattern-analysis',
        toolName: 'analyzeStreamPatternsTool',
        parameters: { count: 500 },
        dependencies: ['trend-analysis']
      },
      {
        id: 'quality-assessment',
        toolName: 'assessStreamDataQualityTool',
        parameters: { count: 500 },
        dependencies: ['get-data'],
        optional: true
      }
    ],
    metadata: {
      estimatedDuration: 'medium',
      dataRequirements: {
        minDataPoints: 500,
        minStreams: 1,
        requiresTimeOrdering: true
      },
      outputTypes: ['statistics', 'trends', 'anomalies', 'patterns', 'quality']
    }
  },

  'multi-stream-correlation-analysis': {
    id: 'multi-stream-correlation-analysis',
    name: 'Multi-Stream Correlation Analysis',
    description: 'Analyze relationships and correlations between multiple streams',
    steps: [
      {
        id: 'discover-streams',
        toolName: 'listAvailableStreamsTool',
        parameters: {}
      },
      {
        id: 'load-streams',
        toolName: 'getMultipleStreamsTool',
        parameters: { count: 300 },
        dependencies: ['discover-streams']
      },
      {
        id: 'correlation-matrix',
        toolName: 'correlateMultipleStreamsTool',
        parameters: { count: 300, significanceThreshold: 0.3 },
        dependencies: ['load-streams']
      },
      {
        id: 'causality-testing',
        toolName: 'testStreamCausalityTool',
        parameters: { count: 300, maxLag: 10 },
        dependencies: ['correlation-matrix'],
        optional: true
      },
      {
        id: 'synchronized-events',
        toolName: 'detectSynchronizedStreamEventsTool',
        parameters: { count: 300, timeWindow: 3, threshold: 2.0 },
        dependencies: ['load-streams']
      },
      {
        id: 'cascading-analysis',
        toolName: 'analyzeCascadingStreamFailuresTool',
        parameters: { count: 300, maxDelay: 10 },
        dependencies: ['synchronized-events'],
        optional: true
      }
    ],
    metadata: {
      estimatedDuration: 'slow',
      dataRequirements: {
        minDataPoints: 300,
        minStreams: 2,
        requiresTimeOrdering: true
      },
      outputTypes: ['correlations', 'causality', 'events', 'cascades']
    }
  },

  'anomaly-investigation-workflow': {
    id: 'anomaly-investigation-workflow',
    name: 'Anomaly Investigation Workflow',
    description: 'Deep investigation of anomalies with context and root cause analysis',
    steps: [
      {
        id: 'get-recent-data',
        toolName: 'getStreamRecentDataTool',
        parameters: { count: 400 }
      },
      {
        id: 'quality-check',
        toolName: 'assessStreamDataQualityTool',
        parameters: { count: 400 },
        dependencies: ['get-recent-data']
      },
      {
        id: 'statistical-baseline',
        toolName: 'analyzeStreamStatisticsTool',
        parameters: { count: 400 },
        dependencies: ['get-recent-data']
      },
      {
        id: 'anomaly-detection',
        toolName: 'analyzeStreamAnomaliesTool',
        parameters: { count: 400, methods: ['ensemble'], sensitivity: 'high' },
        dependencies: ['statistical-baseline']
      },
      {
        id: 'trend-changes',
        toolName: 'analyzeStreamTrendTool',
        parameters: { count: 400 },
        dependencies: ['statistical-baseline']
      },
      {
        id: 'change-points',
        toolName: 'detectChangePointsTool',
        parameters: { threshold: 2.0 },
        dependencies: ['trend-changes']
      },
      {
        id: 'pattern-disruption',
        toolName: 'analyzeStreamPatternsTool',
        parameters: { count: 400, patternTypes: ['peaks', 'cycles'] },
        dependencies: ['anomaly-detection'],
        optional: true
      }
    ],
    metadata: {
      estimatedDuration: 'medium',
      dataRequirements: {
        minDataPoints: 400,
        minStreams: 1,
        requiresTimeOrdering: true
      },
      outputTypes: ['anomalies', 'quality', 'trends', 'change-points', 'patterns']
    }
  },

  'system-health-monitoring': {
    id: 'system-health-monitoring',
    name: 'System Health Monitoring',
    description: 'Comprehensive health assessment across all available streams',
    steps: [
      {
        id: 'discover-all-streams',
        toolName: 'listAvailableStreamsTool',
        parameters: {}
      },
      {
        id: 'load-all-streams',
        toolName: 'getMultipleStreamsTool',
        parameters: { count: 200 },
        dependencies: ['discover-all-streams']
      },
      {
        id: 'individual-quality',
        toolName: 'assessStreamDataQualityTool',
        parameters: { count: 200 },
        dependencies: ['load-all-streams']
      },
      {
        id: 'health-trends',
        toolName: 'monitorStreamHealthTool',
        parameters: { timeRangeMinutes: 120 },
        dependencies: ['individual-quality']
      },
      {
        id: 'cross-stream-events',
        toolName: 'detectSynchronizedStreamEventsTool',
        parameters: { count: 200, timeWindow: 5, threshold: 1.5 },
        dependencies: ['load-all-streams']
      },
      {
        id: 'correlation-health',
        toolName: 'correlateMultipleStreamsTool',
        parameters: { count: 200, significanceThreshold: 0.4 },
        dependencies: ['load-all-streams'],
        optional: true
      }
    ],
    metadata: {
      estimatedDuration: 'medium',
      dataRequirements: {
        minDataPoints: 200,
        minStreams: 1,
        requiresTimeOrdering: true
      },
      outputTypes: ['quality', 'health', 'events', 'correlations']
    }
  }
};

// =============================================================================
// WORKFLOW ORCHESTRATION AI TOOLS
// =============================================================================

export const executeWorkflowTool = tool({
  description: "Execute a predefined workflow or custom sequence of analysis tools",
  inputSchema: z.object({
    workflowId: z.string().optional().describe("ID of predefined workflow template"),
    customSteps: z.array(z.object({
      id: z.string(),
      toolName: z.string(),
      parameters: z.record(z.any()),
      dependencies: z.array(z.string()).optional(),
      optional: z.boolean().optional()
    })).optional().describe("Custom workflow steps if not using template"),
    streamId: z.string().optional().describe("Primary stream ID for single-stream workflows"),
    streamIds: z.array(z.string()).optional().describe("Stream IDs for multi-stream workflows"),
    globalParameters: z.record(z.any()).optional().describe("Parameters to apply to all steps"),
    stopOnError: z.boolean().optional().default(false).describe("Whether to stop execution on first error")
  }),
  execute: async ({ workflowId, customSteps, streamId, streamIds, globalParameters, stopOnError }) => {
    // Get workflow definition
    let workflow: WorkflowDefinition;

    if (workflowId && WORKFLOW_TEMPLATES[workflowId]) {
      workflow = WORKFLOW_TEMPLATES[workflowId];
    } else if (customSteps) {
      workflow = {
        id: 'custom-' + Date.now(),
        name: 'Custom Workflow',
        description: 'User-defined custom workflow',
        steps: customSteps,
        metadata: {
          estimatedDuration: 'unknown',
          dataRequirements: {
            minDataPoints: 50,
            minStreams: 1,
            requiresTimeOrdering: false
          },
          outputTypes: ['custom']
        }
      };
    } else {
      throw new Error('Either workflowId or customSteps must be provided');
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution: WorkflowExecution = {
      workflowId: workflow.id,
      executionId,
      status: 'running',
      startTime: new Date(),
      currentStep: workflow.steps[0]?.id,
      results: {},
      errors: [],
      progress: {
        completed: 0,
        total: workflow.steps.length,
        percentage: 0
      }
    };

    try {
      // Execute steps in dependency order
      const completedSteps = new Set<string>();
      const remainingSteps = [...workflow.steps];

      while (remainingSteps.length > 0) {
        // Find steps that can be executed (all dependencies completed)
        const executableSteps = remainingSteps.filter(step =>
          !step.dependencies || step.dependencies.every(dep => completedSteps.has(dep))
        );

        if (executableSteps.length === 0) {
          throw new Error('Circular dependency detected or missing dependencies');
        }

        // Execute the first executable step
        const step = executableSteps[0];
        execution.currentStep = step.id;

        try {
          // Merge global parameters with step parameters
          const parameters = { ...step.parameters };
          if (globalParameters) {
            Object.assign(parameters, globalParameters);
          }

          // Add stream IDs if not already specified
          if (streamId && !parameters.streamId) {
            parameters.streamId = streamId;
          }
          if (streamIds && !parameters.streamIds) {
            parameters.streamIds = streamIds;
          }

          // Get the tool function
          const toolFunction = allAnalysisTools[step.toolName as keyof typeof allAnalysisTools];
          if (!toolFunction) {
            throw new Error(`Tool '${step.toolName}' not found`);
          }

          if (!('execute' in toolFunction) || typeof toolFunction.execute !== 'function') {
            throw new Error(`Tool '${step.toolName}' has no execute method`);
          }

          // Execute the tool
          const result = await toolFunction.execute(parameters as any, {
            toolCallId: `workflow-${execution.executionId}-${step.id}`,
            messages: []
          });
          execution.results[step.id] = {
            toolName: step.toolName,
            parameters,
            result,
            timestamp: new Date(),
            success: true
          };

          completedSteps.add(step.id);
          execution.progress.completed++;
          execution.progress.percentage = (execution.progress.completed / execution.progress.total) * 100;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          execution.errors.push({
            stepId: step.id,
            error: errorMessage,
            timestamp: new Date()
          });

          if (step.optional) {
            // Mark as completed but with error
            execution.results[step.id] = {
              toolName: step.toolName,
              parameters: step.parameters,
              result: null,
              error: errorMessage,
              timestamp: new Date(),
              success: false
            };
            completedSteps.add(step.id);
            execution.progress.completed++;
            execution.progress.percentage = (execution.progress.completed / execution.progress.total) * 100;
          } else if (stopOnError) {
            execution.status = 'failed';
            execution.endTime = new Date();
            throw error;
          } else {
            // Continue with other steps, but mark this as failed
            execution.results[step.id] = {
              toolName: step.toolName,
              parameters: step.parameters,
              result: null,
              error: errorMessage,
              timestamp: new Date(),
              success: false
            };
            completedSteps.add(step.id);
            execution.progress.completed++;
            execution.progress.percentage = (execution.progress.completed / execution.progress.total) * 100;
          }
        }

        // Remove completed step from remaining steps
        const stepIndex = remainingSteps.findIndex(s => s.id === step.id);
        remainingSteps.splice(stepIndex, 1);
      }

      execution.status = 'completed';
      execution.endTime = new Date();

      // Generate summary
      const successfulSteps = Object.values(execution.results).filter(r => r.success);
      const failedSteps = Object.values(execution.results).filter(r => !r.success);

      return {
        execution,
        summary: {
          workflowName: workflow.name,
          totalSteps: workflow.steps.length,
          successfulSteps: successfulSteps.length,
          failedSteps: failedSteps.length,
          duration: execution.endTime.getTime() - execution.startTime.getTime(),
          status: execution.status
        },
        results: execution.results,
        errors: execution.errors
      };

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      throw error;
    }
  }
});

export const createWorkflowTool = tool({
  description: "Create a custom workflow by chaining analysis tools together",
  inputSchema: z.object({
    name: z.string().describe("Name for the custom workflow"),
    description: z.string().describe("Description of what the workflow accomplishes"),
    analysisGoals: z.array(z.string()).describe("List of analysis goals this workflow addresses"),
    steps: z.array(z.object({
      toolName: z.string().describe("Name of the analysis tool to use"),
      parameters: z.record(z.any()).optional().describe("Parameters for the tool"),
      dependsOn: z.array(z.string()).optional().describe("IDs of previous steps this step depends on"),
      optional: z.boolean().optional().default(false).describe("Whether this step is optional"),
      description: z.string().optional().describe("Description of what this step does")
    })).describe("Sequence of analysis steps"),
    dataRequirements: z.object({
      minDataPoints: z.number().default(100),
      minStreams: z.number().default(1),
      requiresTimeOrdering: z.boolean().default(false)
    }).optional().describe("Data requirements for the workflow")
  }),
  execute: async ({ name, description, analysisGoals, steps, dataRequirements }) => {
    // Validate tool names
    const invalidTools = steps.filter(step => !allAnalysisTools[step.toolName as keyof typeof allAnalysisTools]);
    if (invalidTools.length > 0) {
      throw new Error(`Invalid tools: ${invalidTools.map(t => t.toolName).join(', ')}`);
    }

    // Generate step IDs and validate dependencies
    const workflowSteps: WorkflowStep[] = steps.map((step, index) => ({
      id: `step-${index + 1}`,
      toolName: step.toolName,
      parameters: step.parameters || {},
      dependencies: step.dependsOn,
      optional: step.optional
    }));

    // Validate dependencies
    const stepIds = new Set(workflowSteps.map(s => s.id));
    for (const step of workflowSteps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Step '${step.id}' depends on non-existent step '${dep}'`);
          }
        }
      }
    }

    const workflowId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const workflow: WorkflowDefinition = {
      id: workflowId,
      name,
      description,
      steps: workflowSteps,
      metadata: {
        estimatedDuration: steps.length <= 3 ? 'fast' : steps.length <= 6 ? 'medium' : 'slow',
        dataRequirements: dataRequirements || {
          minDataPoints: 100,
          minStreams: 1,
          requiresTimeOrdering: false
        },
        outputTypes: ['custom']
      }
    };

    // Generate execution plan
    const executionPlan = workflowSteps.map((step, index) => {
      const toolMeta = TOOL_CATALOG[step.toolName];
      return {
        stepNumber: index + 1,
        stepId: step.id,
        toolName: step.toolName,
        category: toolMeta?.category || 'unknown',
        complexity: toolMeta?.complexity || 'basic',
        dependencies: step.dependencies || [],
        optional: step.optional || false,
        description: steps[index].description || `Execute ${step.toolName}`
      };
    });

    return {
      workflowId,
      workflow,
      executionPlan,
      analysisGoals,
      validation: {
        valid: true,
        totalSteps: workflowSteps.length,
        estimatedDuration: workflow.metadata.estimatedDuration,
        dataRequirements: workflow.metadata.dataRequirements
      },
      nextSteps: [
        'Use executeWorkflowTool to run this workflow',
        'Ensure required data is available before execution',
        'Consider testing with a subset of data first'
      ]
    };
  }
});

export const getWorkflowStatusTool = tool({
  description: "Get available workflow templates and their descriptions",
  inputSchema: z.object({
    category: z.enum(['all', 'single-stream', 'multi-stream', 'anomaly', 'health']).optional().default('all')
      .describe("Category of workflows to list")
  }),
  execute: async ({ category }) => {
    let workflows = Object.values(WORKFLOW_TEMPLATES);

    // Filter by category
    if (category !== 'all') {
      workflows = workflows.filter(w => {
        switch (category) {
          case 'single-stream':
            return w.metadata.dataRequirements.minStreams === 1;
          case 'multi-stream':
            return w.metadata.dataRequirements.minStreams > 1;
          case 'anomaly':
            return w.name.toLowerCase().includes('anomaly');
          case 'health':
            return w.name.toLowerCase().includes('health');
          default:
            return true;
        }
      });
    }

    const workflowList = workflows.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      steps: w.steps.length,
      estimatedDuration: w.metadata.estimatedDuration,
      dataRequirements: w.metadata.dataRequirements,
      outputTypes: w.metadata.outputTypes
    }));

    return {
      category,
      totalWorkflows: workflowList.length,
      workflows: workflowList,
      usageGuide: {
        singleStream: 'Use single-stream workflows for analyzing individual data sources',
        multiStream: 'Use multi-stream workflows for relationship and correlation analysis',
        anomaly: 'Use anomaly workflows for investigating unusual patterns or outliers',
        health: 'Use health workflows for system monitoring and status assessment'
      }
    };
  }
});

export const optimizeWorkflowTool = tool({
  description: "Optimize a workflow for better performance and reliability",
  inputSchema: z.object({
    workflowId: z.string().describe("ID of workflow to optimize"),
    optimizationGoals: z.array(z.enum(['speed', 'accuracy', 'reliability', 'cost'])).describe("Optimization objectives"),
    constraints: z.object({
      maxSteps: z.number().optional().describe("Maximum number of steps allowed"),
      maxDuration: z.string().optional().describe("Maximum acceptable duration"),
      requiredOutputs: z.array(z.string()).optional().describe("Required output types that must be preserved")
    }).optional().describe("Optimization constraints")
  }),
  execute: async ({ workflowId, optimizationGoals, constraints }) => {
    const originalWorkflow = WORKFLOW_TEMPLATES[workflowId];
    if (!originalWorkflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const optimizations: string[] = [];
    let optimizedSteps = [...originalWorkflow.steps];

    // Speed optimization
    if (optimizationGoals.includes('speed')) {
      // Remove optional steps if not in required outputs
      if (!constraints?.requiredOutputs || constraints.requiredOutputs.length === 0) {
        optimizedSteps = optimizedSteps.filter(step => !step.optional);
        if (optimizedSteps.length < originalWorkflow.steps.length) {
          optimizations.push('Removed optional steps to improve speed');
        }
      }

      // Reduce data point requirements for non-critical steps
      optimizedSteps = optimizedSteps.map(step => {
        const toolMeta = TOOL_CATALOG[step.toolName];
        if (toolMeta && step.parameters.count && step.parameters.count > 200) {
          return {
            ...step,
            parameters: { ...step.parameters, count: Math.max(200, toolMeta.dataRequirements.minPoints) }
          };
        }
        return step;
      });
      optimizations.push('Reduced data sample sizes for faster execution');
    }

    // Reliability optimization
    if (optimizationGoals.includes('reliability')) {
      // Add retry policies to critical steps
      optimizedSteps = optimizedSteps.map(step => {
        if (!step.optional && !step.retryPolicy) {
          return {
            ...step,
            retryPolicy: { maxRetries: 2, retryDelay: 1000 }
          };
        }
        return step;
      });
      optimizations.push('Added retry policies to critical steps');

      // Mark more steps as optional to prevent cascade failures
      optimizedSteps = optimizedSteps.map((step, index) => {
        if (index > optimizedSteps.length / 2 && !step.dependencies) {
          return { ...step, optional: true };
        }
        return step;
      });
      optimizations.push('Made non-critical steps optional to prevent cascade failures');
    }

    // Accuracy optimization
    if (optimizationGoals.includes('accuracy')) {
      // Increase data sample sizes
      optimizedSteps = optimizedSteps.map(step => {
        if (step.parameters.count && step.parameters.count < 500) {
          return {
            ...step,
            parameters: { ...step.parameters, count: Math.min(500, step.parameters.count * 2) }
          };
        }
        return step;
      });
      optimizations.push('Increased data sample sizes for better accuracy');

      // Add quality assessment step if not present
      const hasQualityStep = optimizedSteps.some(step => step.toolName.includes('Quality'));
      if (!hasQualityStep) {
        optimizedSteps.splice(1, 0, {
          id: 'quality-check',
          toolName: 'assessStreamDataQualityTool',
          parameters: { count: 300 },
          dependencies: optimizedSteps[0] ? [optimizedSteps[0].id] : [],
          optional: true
        });
        optimizations.push('Added data quality assessment step');
      }
    }

    // Apply constraints
    if (constraints?.maxSteps && optimizedSteps.length > constraints.maxSteps) {
      // Keep most important steps based on category priority
      const priorityOrder = ['data-retrieval', 'statistics', 'anomalies', 'quality', 'patterns'];
      optimizedSteps.sort((a, b) => {
        const aMeta = TOOL_CATALOG[a.toolName];
        const bMeta = TOOL_CATALOG[b.toolName];
        const aPriority = aMeta ? priorityOrder.indexOf(aMeta.category) : 999;
        const bPriority = bMeta ? priorityOrder.indexOf(bMeta.category) : 999;
        return aPriority - bPriority;
      });
      optimizedSteps = optimizedSteps.slice(0, constraints.maxSteps);
      optimizations.push(`Reduced to ${constraints.maxSteps} most important steps`);
    }

    const optimizedWorkflow: WorkflowDefinition = {
      ...originalWorkflow,
      id: `${originalWorkflow.id}-optimized`,
      name: `${originalWorkflow.name} (Optimized)`,
      steps: optimizedSteps,
      metadata: {
        ...originalWorkflow.metadata,
        estimatedDuration: optimizationGoals.includes('speed') ? 'fast' : originalWorkflow.metadata.estimatedDuration
      }
    };

    return {
      originalWorkflow: {
        id: originalWorkflow.id,
        steps: originalWorkflow.steps.length,
        estimatedDuration: originalWorkflow.metadata.estimatedDuration
      },
      optimizedWorkflow: {
        id: optimizedWorkflow.id,
        steps: optimizedWorkflow.steps.length,
        estimatedDuration: optimizedWorkflow.metadata.estimatedDuration
      },
      optimizations,
      improvements: {
        stepReduction: originalWorkflow.steps.length - optimizedWorkflow.steps.length,
        speedImprovement: optimizationGoals.includes('speed') ? 'Significant' : 'Minimal',
        reliabilityImprovement: optimizationGoals.includes('reliability') ? 'Enhanced' : 'Unchanged',
        accuracyImprovement: optimizationGoals.includes('accuracy') ? 'Improved' : 'Unchanged'
      },
      recommendation: 'Use optimized workflow for production analysis'
    };
  }
});

// =============================================================================
// WORKFLOW ORCHESTRATION COLLECTION EXPORT
// =============================================================================

export const workflowOrchestrationTools = {
  executeWorkflowTool,
  createWorkflowTool,
  getWorkflowStatusTool,
  optimizeWorkflowTool
};

export const workflowOrchestrationToolNames = Object.keys(workflowOrchestrationTools);

console.log(`🔧 Workflow Orchestration: ${workflowOrchestrationToolNames.length} orchestration tools ready`);
console.log(`🔧 Predefined Workflows: ${Object.keys(WORKFLOW_TEMPLATES).length} workflow templates available`);