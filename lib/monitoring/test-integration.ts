/**
 * Integration Test for Stream Analysis System
 * Verify all components work together correctly
 */

import { testStreamAnalysisSystem } from './stream-analysis';

/**
 * Run comprehensive integration tests
 */
export async function runIntegrationTests(): Promise<void> {
  console.log('🔄 Starting Stream Analysis System Integration Tests...\n');

  try {
    const testResult = await testStreamAnalysisSystem();

    if (testResult.success) {
      console.log('✅ Integration Tests PASSED!');
      console.log('\n📊 Test Results:');

      if (testResult.results.availableStreams) {
        console.log(`   Available Streams: ${testResult.results.availableStreams.join(', ')}`);
      }

      if (testResult.results.dataRetrieval) {
        const data = testResult.results.dataRetrieval;
        console.log(`   Data Retrieval: ${data.dataPoints} points from ${data.sensorType} (quality: ${data.quality.toFixed(3)})`);
      }

      if (testResult.results.statisticalAnalysis) {
        const stats = testResult.results.statisticalAnalysis;
        console.log(`   Statistical Analysis: mean=${stats.mean.toFixed(3)}, std=${stats.std.toFixed(3)} (confidence: ${stats.confidence.toFixed(3)})`);
      }

      if (testResult.results.qualityAssessment) {
        const quality = testResult.results.qualityAssessment;
        console.log(`   Quality Assessment: Grade ${quality.grade} (${quality.overallScore.toFixed(3)}) with ${quality.issueCount} issues`);
      }

      if (testResult.results.multiStreamAnalysis) {
        const corr = testResult.results.multiStreamAnalysis;
        console.log(`   Multi-Stream Analysis: correlation=${corr.correlation.toFixed(3)} (${corr.strength})`);
      }

    } else {
      console.log('❌ Integration Tests FAILED!');
      console.log('\n🔍 Errors:');
      testResult.errors.forEach(error => {
        console.log(`   - ${error}`);
      });

      if (Object.keys(testResult.results).length > 0) {
        console.log('\n📊 Partial Results:');
        console.log(JSON.stringify(testResult.results, null, 2));
      }
    }

  } catch (error) {
    console.log('💥 Integration Tests CRASHED!');
    console.log(`Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log('\n🏁 Integration Tests Complete');
}

/**
 * Manual test runner for development
 */
export function printTestInstructions(): void {
  console.log(`
🧪 Stream Analysis System Test Instructions

To test the system manually:

1. Import the main module:
   import { testStreamAnalysisSystem } from './lib/monitoring/stream-analysis';

2. Run the test:
   const result = await testStreamAnalysisSystem();
   console.log(result);

3. Expected output structure:
   {
     success: boolean,
     results: {
       availableStreams: string[],
       dataRetrieval: { streamId, sensorType, dataPoints, quality },
       statisticalAnalysis: { method, mean, std, confidence },
       qualityAssessment: { overallScore, grade, issueCount },
       multiStreamAnalysis?: { correlation, strength }
     },
     errors: string[]
   }

4. If successful, you should see:
   - Available stream IDs
   - Data retrieval working
   - Statistical analysis results
   - Quality assessment grades
   - Multi-stream correlation (if multiple streams available)

🎯 This confirms the entire Step 3 implementation is working correctly!
`);
}

// Auto-run test instructions when imported
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  printTestInstructions();
}