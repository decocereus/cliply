"use client";

import React from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ProcessingState } from "@/types";

interface ProgressBarProps {
  processingState: ProcessingState;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  processingState,
}) => {
  const { isProcessing, progress, message, error } = processingState;

  if (!isProcessing && !message && !error) {
    return null;
  }

  return (
    <div className="py-1 font-mono w-full md:max-w-sm ">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-foreground" />
          ) : error ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : (
            <CheckCircle className="h-4 w-4 text-foreground" />
          )}

          <div className="flex-1">
            <p
              className={`text-sm ${
                error
                  ? "text-destructive"
                  : isProcessing
                  ? "text-foreground"
                  : "text-foreground"
              }`}
            >
              $ {error || message}
            </p>
          </div>

          {isProcessing && (
            <span className="text-sm text-foreground">[{progress}%]</span>
          )}
        </div>

        {isProcessing && (
          <div className="relative">
            <Progress
              value={progress}
              className="w-full h-2 bg-background border border-foreground"
            />
          </div>
        )}
      </div>
    </div>
  );
};
