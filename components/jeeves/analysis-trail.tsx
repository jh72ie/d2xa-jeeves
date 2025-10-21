"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDownIcon,
  WrenchIcon,
  CheckCircleIcon,
  BrainCircuitIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "@/components/elements/code-block";

interface ToolStep {
  type: string;
  state: string;
  input?: any;
  output?: any;
  text?: string;
  timestamp: string;
}

interface AnalysisTrailProps {
  trail: ToolStep[];
  className?: string;
}

export function AnalysisTrail({ trail, className }: AnalysisTrailProps) {
  if (!trail || trail.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-3">
        <BrainCircuitIcon className="size-4 text-muted-foreground" />
        <h4 className="font-semibold text-sm">Analysis Trail</h4>
        <Badge variant="outline" className="text-xs">
          {trail.length} steps
        </Badge>
      </div>

      <div className="space-y-2">
        {trail.map((step, index) => (
          <ToolStepCard key={index} step={step} stepNumber={index + 1} />
        ))}
      </div>
    </div>
  );
}

function ToolStepCard({ step, stepNumber }: { step: ToolStep; stepNumber: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const isReasoning = step.type === 'reasoning';

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-md border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            #{stepNumber}
          </span>
          {isReasoning ? (
            <BrainCircuitIcon className="size-4 shrink-0 text-blue-500" />
          ) : (
            <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium text-sm">
            {isReasoning ? 'Reasoning' : step.type}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="flex items-center gap-1 text-xs" variant="secondary">
            <CheckCircleIcon className="size-3 text-green-600" />
            Complete
          </Badge>
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t">
        {/* Reasoning text */}
        {isReasoning && step.text && (
          <div className="p-4 space-y-2">
            <h5 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Thought Process
            </h5>
            <div className="text-sm leading-relaxed bg-muted/30 rounded-md p-3">
              {step.text}
            </div>
          </div>
        )}

        {/* Tool input */}
        {!isReasoning && step.input && (
          <div className="p-4 space-y-2">
            <h5 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Parameters
            </h5>
            <div className="rounded-md bg-muted/50 overflow-hidden">
              <CodeBlock
                code={JSON.stringify(step.input, null, 2)}
                language="json"
              />
            </div>
          </div>
        )}

        {/* Tool output */}
        {!isReasoning && step.output && (
          <div className="p-4 space-y-2 border-t">
            <h5 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Result
            </h5>
            <div className="rounded-md bg-muted/50 overflow-hidden">
              <CodeBlock
                code={typeof step.output === 'string'
                  ? step.output
                  : JSON.stringify(step.output, null, 2)}
                language="json"
              />
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-3 text-xs text-muted-foreground" suppressHydrationWarning>
          {new Date(step.timestamp).toLocaleTimeString()}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
