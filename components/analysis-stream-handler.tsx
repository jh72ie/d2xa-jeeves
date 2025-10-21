'use client';

import { useEffect, useRef } from 'react';
import { useDataStream } from './data-stream-provider';
import { useAnalysisStream } from '@/hooks/use-analysis-stream';

export function AnalysisStreamHandler() {
  const { dataStream } = useDataStream();
  const analysisStore = useAnalysisStream();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    for (const delta of newDeltas) {
      const deltaType = delta.type as string;

      switch (deltaType) {
        case 'data-analysis-start':
          analysisStore.startAnalysis((delta.data as any).estimatedSteps || 20);
          break;

        case 'data-analysis-tool-start':
          analysisStore.startToolExecution((delta.data as any).toolName);
          break;

        case 'data-analysis-tool-call':
          analysisStore.addToolCall(
            (delta.data as any).step,
            (delta.data as any).toolName,
            (delta.data as any).toolCategory,
            (delta.data as any).parameters
          );
          break;

        case 'data-analysis-tool-result':
          analysisStore.addToolResult(
            (delta.data as any).step,
            (delta.data as any).toolName,
            (delta.data as any).duration,
            (delta.data as any).success,
            (delta.data as any).resultSummary,
            (delta.data as any).error
          );
          break;

        case 'data-analysis-progress':
          analysisStore.updateProgress(
            (delta.data as any).step,
            (delta.data as any).elapsedTime,
            (delta.data as any).estimatedRemaining
          );
          break;

        case 'data-analysis-complete':
          analysisStore.completeAnalysis();
          break;

        default:
          // Ignore other event types
          break;
      }
    }
  }, [dataStream, analysisStore]);

  return null;
}