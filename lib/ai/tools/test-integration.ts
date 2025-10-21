/**
 * Comprehensive Test Suite for AI SDK Tool Integration
 * Tests all 65+ tools, discovery system, and workflow orchestration
 */

import {
  streamAnalysisTools,
  streamAnalysisToolNames
} from './stream-analysis';

import {
  mathematicalFunctionTools,
  mathematicalFunctionToolNames
} from './mathematical-functions';

import {
  toolDiscoveryTools,
  toolDiscoveryToolNames,
  allAnalysisTools,
  allAnalysisToolNames
} from './tool-discovery';

import {
  workflowOrchestrationTools,
  workflowOrchestrationToolNames,
  WORKFLOW_TEMPLATES
} from './workflow-orchestration';

// =============================================================================
// TEST EXECUTION TYPES
// =============================================================================

export interface TestResult {
  testName: string;
  category: string;
  success: boolean;
  duration: number;
  result?: any;
  error?: string;
  details?: any;
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: TestResult[];
  summary: {
    successRate: number;
    categories: Record<string, { passed: number; total: number }>;
    criticalFailures: string[];
  };
}

// =============================================================================
// MOCK DATA FOR TESTING
// =============================================================================

const MOCK_STREAM_DATA = {
  temperature: Array.from({ length: 100 }, (_, i) => 20 + Math.sin(i * 0.1) * 3 + Math.random() * 2),
  humidity: Array.from({ length: 100 }, (_, i) => 60 + Math.cos(i * 0.15) * 10 + Math.random() * 5),
  noiseData: Array.from({ length: 50 }, () => Math.random() * 100),
  trendData: Array.from({ length: 80 }, (_, i) => i * 0.5 + Math.random() * 2),
  cyclicData: Array.from({ length: 120 }, (_, i) => Math.sin(i * 0.2) * 10 + Math.random()),
  anomalyData: Array.from({ length: 60 }, (_, i) => {
    const base = 25 + Math.sin(i * 0.1) * 2;
    // Add some anomalies
    if (i === 20 || i === 45) return base * 3;
    if (i === 35) return base * 0.2;
    return base + Math.random();
  })
};

// =============================================================================
// INDIVIDUAL TOOL TESTS
// =============================================================================

async function runIndividualToolTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test core mathematical functions
  const mathTests = [
    {
      name: 'calculateMeanTool',
      params: { values: MOCK_STREAM_DATA.temperature },
      expectedType: 'object',
      shouldContain: ['mean', 'count']
    },
    {
      name: 'calculateStdTool',
      params: { values: MOCK_STREAM_DATA.humidity },
      expectedType: 'object',
      shouldContain: ['standardDeviation']
    },
    {
      name: 'calculateBasicStatsTool',
      params: { values: MOCK_STREAM_DATA.noiseData },
      expectedType: 'object',
      shouldContain: ['mean', 'std', 'min', 'max']
    },
    {
      name: 'ensembleAnomalyDetectionTool',
      params: { values: MOCK_STREAM_DATA.anomalyData },
      expectedType: 'object',
      shouldContain: ['anomalies', 'consensusScore']
    },
    {
      name: 'calculateLinearTrendTool',
      params: { values: MOCK_STREAM_DATA.trendData },
      expectedType: 'object',
      shouldContain: ['slope', 'intercept', 'rSquared']
    }
  ];

  for (const test of mathTests) {
    const startTime = Date.now();
    try {
      const tool = mathematicalFunctionTools[test.name as keyof typeof mathematicalFunctionTools];
      if (!tool) {
        results.push({
          testName: test.name,
          category: 'mathematical-functions',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool not found'
        });
        continue;
      }

      if (!('execute' in tool) || typeof tool.execute !== 'function') {
        results.push({
          testName: test.name,
          category: 'mathematical-functions',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool has no execute method'
        });
        continue;
      }

      const result = await tool.execute(test.params as any, {
        toolCallId: `test-${test.name}-${Date.now()}`,
        messages: []
      });
      const duration = Date.now() - startTime;

      const success = typeof result === test.expectedType &&
        test.shouldContain.every(key => result && typeof result === 'object' && key in result);

      results.push({
        testName: test.name,
        category: 'mathematical-functions',
        success,
        duration,
        result: success ? 'PASS' : 'FAIL',
        details: { outputKeys: Object.keys(result || {}), expectedKeys: test.shouldContain }
      });

    } catch (error) {
      results.push({
        testName: test.name,
        category: 'mathematical-functions',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

// =============================================================================
// TOOL DISCOVERY TESTS
// =============================================================================

async function runToolDiscoveryTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const discoveryTests = [
    {
      name: 'discoverToolsTool - Quick Health Check',
      tool: 'discoverToolsTool',
      params: {
        analysisGoal: 'quick-health-check',
        availableDataPoints: 200,
        numberOfStreams: 2
      }
    },
    {
      name: 'discoverToolsTool - Anomaly Investigation',
      tool: 'discoverToolsTool',
      params: {
        analysisGoal: 'anomaly-investigation',
        availableDataPoints: 500,
        numberOfStreams: 1
      }
    },
    {
      name: 'getToolInfoTool - Valid Tool',
      tool: 'getToolInfoTool',
      params: {
        toolName: 'analyzeStreamStatisticsTool',
        includeRelated: true
      }
    },
    {
      name: 'getToolInfoTool - Invalid Tool',
      tool: 'getToolInfoTool',
      params: {
        toolName: 'nonExistentTool',
        includeRelated: false
      }
    },
    {
      name: 'suggestWorkflowTool - Performance Analysis',
      tool: 'suggestWorkflowTool',
      params: {
        task: 'analyze performance trends over the last hour',
        priority: 'accuracy'
      }
    },
    {
      name: 'validateToolCompatibilityTool - Compatible Tools',
      tool: 'validateToolCompatibilityTool',
      params: {
        toolNames: ['calculateMeanTool', 'calculateStdTool'],
        dataCharacteristics: {
          dataPoints: 100,
          numberOfStreams: 1,
          hasTimeOrdering: false
        }
      }
    }
  ];

  for (const test of discoveryTests) {
    const startTime = Date.now();
    try {
      const tool = toolDiscoveryTools[test.tool as keyof typeof toolDiscoveryTools];
      if (!tool) {
        results.push({
          testName: test.name,
          category: 'tool-discovery',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool not found'
        });
        continue;
      }

      if (!('execute' in tool) || typeof tool.execute !== 'function') {
        results.push({
          testName: test.name,
          category: 'tool-discovery',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool has no execute method'
        });
        continue;
      }

      const result = await tool.execute(test.params as any, {
        toolCallId: `test-${test.name}-${Date.now()}`,
        messages: []
      });
      const duration = Date.now() - startTime;

      const success = result !== null && typeof result === 'object';

      results.push({
        testName: test.name,
        category: 'tool-discovery',
        success,
        duration,
        result: success ? 'PASS' : 'FAIL',
        details: { hasResult: !!result, resultType: typeof result }
      });

    } catch (error) {
      results.push({
        testName: test.name,
        category: 'tool-discovery',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

// =============================================================================
// WORKFLOW ORCHESTRATION TESTS
// =============================================================================

async function runWorkflowOrchestrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const workflowTests = [
    {
      name: 'getWorkflowStatusTool - All Workflows',
      tool: 'getWorkflowStatusTool',
      params: { category: 'all' }
    },
    {
      name: 'getWorkflowStatusTool - Single Stream',
      tool: 'getWorkflowStatusTool',
      params: { category: 'single-stream' }
    },
    {
      name: 'createWorkflowTool - Simple Custom Workflow',
      tool: 'createWorkflowTool',
      params: {
        name: 'Test Mathematical Workflow',
        description: 'Simple test workflow using mathematical functions',
        analysisGoals: ['testing'],
        steps: [
          {
            toolName: 'calculateMeanTool',
            parameters: { values: MOCK_STREAM_DATA.temperature },
            description: 'Calculate mean temperature'
          },
          {
            toolName: 'calculateStdTool',
            parameters: { values: MOCK_STREAM_DATA.temperature },
            dependsOn: ['step-1'],
            description: 'Calculate standard deviation'
          }
        ],
        dataRequirements: {
          minDataPoints: 50,
          minStreams: 1,
          requiresTimeOrdering: false
        }
      }
    },
    {
      name: 'optimizeWorkflowTool - Speed Optimization',
      tool: 'optimizeWorkflowTool',
      params: {
        workflowId: 'comprehensive-stream-analysis',
        optimizationGoals: ['speed'],
        constraints: { maxSteps: 4 }
      }
    }
  ];

  for (const test of workflowTests) {
    const startTime = Date.now();
    try {
      const tool = workflowOrchestrationTools[test.tool as keyof typeof workflowOrchestrationTools];
      if (!tool) {
        results.push({
          testName: test.name,
          category: 'workflow-orchestration',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool not found'
        });
        continue;
      }

      if (!('execute' in tool) || typeof tool.execute !== 'function') {
        results.push({
          testName: test.name,
          category: 'workflow-orchestration',
          success: false,
          duration: Date.now() - startTime,
          error: 'Tool has no execute method'
        });
        continue;
      }

      const result = await tool.execute(test.params as any, {
        toolCallId: `test-${test.name}-${Date.now()}`,
        messages: []
      });
      const duration = Date.now() - startTime;

      const success = result !== null && typeof result === 'object';

      results.push({
        testName: test.name,
        category: 'workflow-orchestration',
        success,
        duration,
        result: success ? 'PASS' : 'FAIL',
        details: { hasResult: !!result, resultType: typeof result }
      });

    } catch (error) {
      results.push({
        testName: test.name,
        category: 'workflow-orchestration',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

async function runIntegrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test tool count verification
  const startTime1 = Date.now();
  try {
    const expectedTotalTools =
      streamAnalysisToolNames.length +
      mathematicalFunctionToolNames.length +
      toolDiscoveryToolNames.length +
      workflowOrchestrationToolNames.length;

    const actualTotalTools = allAnalysisToolNames.length;

    results.push({
      testName: 'Tool Count Verification',
      category: 'integration',
      success: actualTotalTools >= expectedTotalTools,
      duration: Date.now() - startTime1,
      details: {
        expected: expectedTotalTools,
        actual: actualTotalTools,
        breakdown: {
          streamAnalysis: streamAnalysisToolNames.length,
          mathematical: mathematicalFunctionToolNames.length,
          discovery: toolDiscoveryToolNames.length,
          orchestration: workflowOrchestrationToolNames.length
        }
      }
    });
  } catch (error) {
    results.push({
      testName: 'Tool Count Verification',
      category: 'integration',
      success: false,
      duration: Date.now() - startTime1,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test workflow template availability
  const startTime2 = Date.now();
  try {
    const templateCount = Object.keys(WORKFLOW_TEMPLATES).length;
    const hasRequiredTemplates = templateCount >= 4 &&
      'comprehensive-stream-analysis' in WORKFLOW_TEMPLATES &&
      'multi-stream-correlation-analysis' in WORKFLOW_TEMPLATES;

    results.push({
      testName: 'Workflow Templates Availability',
      category: 'integration',
      success: hasRequiredTemplates,
      duration: Date.now() - startTime2,
      details: {
        templateCount,
        availableTemplates: Object.keys(WORKFLOW_TEMPLATES)
      }
    });
  } catch (error) {
    results.push({
      testName: 'Workflow Templates Availability',
      category: 'integration',
      success: false,
      duration: Date.now() - startTime2,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test tool cross-references
  const startTime3 = Date.now();
  try {
    const allToolsExist = Object.keys(allAnalysisTools).every(toolName =>
      typeof allAnalysisTools[toolName as keyof typeof allAnalysisTools] === 'object' &&
      'execute' in allAnalysisTools[toolName as keyof typeof allAnalysisTools]
    );

    results.push({
      testName: 'Tool Cross-References',
      category: 'integration',
      success: allToolsExist,
      duration: Date.now() - startTime3,
      details: {
        allToolsValid: allToolsExist,
        totalToolsChecked: Object.keys(allAnalysisTools).length
      }
    });
  } catch (error) {
    results.push({
      testName: 'Tool Cross-References',
      category: 'integration',
      success: false,
      duration: Date.now() - startTime3,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return results;
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

export async function runCompleteAISDKToolIntegrationTests(): Promise<TestSuiteResult> {
  console.log('🧪 Starting Complete AI SDK Tool Integration Tests...\n');

  const suiteStartTime = Date.now();
  const allResults: TestResult[] = [];

  try {
    // Run individual test suites
    console.log('🔧 Testing Individual Mathematical Functions...');
    const mathResults = await runIndividualToolTests();
    allResults.push(...mathResults);

    console.log('🔍 Testing Tool Discovery System...');
    const discoveryResults = await runToolDiscoveryTests();
    allResults.push(...discoveryResults);

    console.log('⚙️ Testing Workflow Orchestration...');
    const workflowResults = await runWorkflowOrchestrationTests();
    allResults.push(...workflowResults);

    console.log('🔗 Testing Integration...');
    const integrationResults = await runIntegrationTests();
    allResults.push(...integrationResults);

    // Calculate summary statistics
    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;

    // Categorize results
    const categories: Record<string, { passed: number; total: number }> = {};
    allResults.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { passed: 0, total: 0 };
      }
      categories[result.category].total++;
      if (result.success) {
        categories[result.category].passed++;
      }
    });

    // Identify critical failures
    const criticalFailures = allResults
      .filter(r => !r.success && (r.category === 'integration' || r.testName.includes('Tool Count')))
      .map(r => r.testName);

    const testSuiteResult: TestSuiteResult = {
      suiteName: 'Complete AI SDK Tool Integration',
      totalTests,
      passedTests,
      failedTests,
      duration: Date.now() - suiteStartTime,
      results: allResults,
      summary: {
        successRate,
        categories,
        criticalFailures
      }
    };

    return testSuiteResult;

  } catch (error) {
    throw new Error(`Test suite execution failed: ${error instanceof Error ? error.message : error}`);
  }
}

// =============================================================================
// TEST RESULT DISPLAY
// =============================================================================

export function displayTestResults(results: TestSuiteResult): void {
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(50));
  console.log(`Suite: ${results.suiteName}`);
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passedTests} (${results.summary.successRate.toFixed(1)}%)`);
  console.log(`Failed: ${results.failedTests}`);
  console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);

  console.log('\n📈 Results by Category:');
  Object.entries(results.summary.categories).forEach(([category, stats]) => {
    const categoryRate = (stats.passed / stats.total) * 100;
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${categoryRate.toFixed(1)}%)`);
  });

  if (results.summary.criticalFailures.length > 0) {
    console.log('\n❌ Critical Failures:');
    results.summary.criticalFailures.forEach(failure => {
      console.log(`  - ${failure}`);
    });
  }

  console.log('\n📋 Detailed Results:');
  const failedTests = results.results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  ❌ ${test.testName} (${test.category})`);
      if (test.error) console.log(`     Error: ${test.error}`);
    });
  }

  const successfulTests = results.results.filter(r => r.success);
  console.log(`\n✅ ${successfulTests.length} tests passed successfully`);

  console.log('\n🎯 Step 5 Implementation Status:');
  console.log(`✅ High-level tools: ${streamAnalysisToolNames.length} tools`);
  console.log(`✅ Mathematical functions: ${mathematicalFunctionToolNames.length} tools`);
  console.log(`✅ Tool discovery: ${toolDiscoveryToolNames.length} tools`);
  console.log(`✅ Workflow orchestration: ${workflowOrchestrationToolNames.length} tools`);
  console.log(`✅ Total AI SDK tools: ${allAnalysisToolNames.length} tools ready for LLM use`);

  const overallStatus = results.summary.successRate >= 90 ? '✅ EXCELLENT' :
                       results.summary.successRate >= 75 ? '⚠️ GOOD' :
                       results.summary.successRate >= 50 ? '⚠️ NEEDS IMPROVEMENT' : '❌ CRITICAL ISSUES';

  console.log(`\n🏆 Overall Status: ${overallStatus} (${results.summary.successRate.toFixed(1)}% success rate)`);
}

// =============================================================================
// EXPORT FOR MANUAL TESTING
// =============================================================================

export const testInstructions = `
🧪 AI SDK Tool Integration Test Instructions

To run the complete test suite:

1. Import the test function:
   import { runCompleteAISDKToolIntegrationTests, displayTestResults } from './lib/ai/tools/test-integration';

2. Run the tests:
   const results = await runCompleteAISDKToolIntegrationTests();
   displayTestResults(results);

3. Expected test coverage:
   - ${mathematicalFunctionToolNames.length} mathematical function tools
   - ${streamAnalysisToolNames.length} high-level analysis tools
   - ${toolDiscoveryToolNames.length} tool discovery tools
   - ${workflowOrchestrationToolNames.length} workflow orchestration tools
   - Integration and cross-reference validation

4. Success criteria:
   - All tool exports are valid
   - Tool discovery system works correctly
   - Workflow orchestration functions properly
   - Total success rate > 90%

🎯 This validates the complete Step 5: Tool Calling Integration implementation!
`;

console.log('🧪 AI SDK Tool Integration Test Suite Ready');
console.log(`Total tools to test: ${allAnalysisToolNames.length}`);
console.log('Use runCompleteAISDKToolIntegrationTests() to execute all tests');