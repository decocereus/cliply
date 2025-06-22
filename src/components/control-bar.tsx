"use client";

import type React from "react";
import { useState } from "react";
import {
  Upload,
  Youtube,
  Clock,
  Scissors,
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ControlBarProps } from "@/types";
import { cn } from "@/lib/utils";

export const ControlBar: React.FC<ControlBarProps> = ({
  isExpanded,
  onToggleExpanded,
  onUploadClick,
  onYoutubeSubmit,
  onClip,
  onReset,
  onDownload,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  timeErrors,
  isValidToClip,
  hasVideo,
  hasClip,
  processingState,
  isLoadingYoutube,
  youtubeError,
  uploadLoadingState,
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      onYoutubeSubmit(youtubeUrl.trim());
      setYoutubeUrl("");
      setShowYoutubeInput(false);
      setUrlError(null);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);

    if (url.trim()) {
      import("@/lib/youtube").then(({ validateYouTubeUrl }) => {
        const validation = validateYouTubeUrl(url);
        setUrlError(
          validation.isValid ? null : validation.error || "Invalid URL"
        );
      });
    } else {
      setUrlError(null);
    }
  };

  const toggleYoutubeInput = () => {
    setShowYoutubeInput(!showYoutubeInput);
    if (showYoutubeInput) {
      setYoutubeUrl("");
    }
  };

  const closeYoutubeInput = () => {
    setShowYoutubeInput(false);
    setYoutubeUrl("");
  };

  const closeTimeControls = () => {
    onToggleExpanded();
  };

  return (
    <div
      className={cn(
        "fixed bottom-16 left-1/2 transform -translate-x-1/2 z-50 px-4",
        isExpanded || (showYoutubeInput && "w-11/12 sm:w-xl")
      )}
    >
      <div className="bg-background/95 backdrop-blur-md rounded-xl border-2 border-foreground shadow-2xl transition-all duration-500 ease-out overflow-hidden w-full">
        <div
          className={cn(
            "flex flex-col sm:flex-row items-center transition-all duration-500 ease-out w-full",
            isExpanded && "h-56 sm:h-auto",
            showYoutubeInput && "h-36 sm:h-auto"
          )}
        >
          {/* Main Controls Section */}
          <div
            className={cn(
              "flex items-center p-3 lg:p-4 transition-all duration-500 ease-out gap-x-2 lg:gap-x-3",
              showYoutubeInput || isExpanded
                ? "transform -translate-x-full opacity-0 pointer-events-none"
                : "transform translate-x-0 opacity-100 justify-between",
              showYoutubeInput && "min-w-md"
            )}
          >
            {/* Upload Button */}
            <Button
              onClick={onUploadClick}
              disabled={
                processingState.isProcessing || uploadLoadingState?.isLoading
              }
              variant="terminal"
              size="sm"
              className="group relative overflow-hidden h-9 lg:h-10 flex-shrink-0"
            >
              {uploadLoadingState?.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 transition-transform group-hover:scale-110" />
              )}
              <span className="hidden sm:inline ml-2">
                {uploadLoadingState?.isLoading
                  ? uploadLoadingState.stage
                  : "Upload"}
              </span>
              {processingState.isProcessing && (
                <div className="absolute inset-0 bg-foreground/10 animate-pulse" />
              )}
            </Button>

            {/* YouTube Button */}
            <Button
              onClick={toggleYoutubeInput}
              disabled={processingState.isProcessing}
              variant="terminal"
              size="sm"
              className="group relative overflow-hidden transition-all duration-300 h-9 lg:h-10 flex-shrink-0"
            >
              {isLoadingYoutube ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Youtube className="h-4 w-4 transition-transform group-hover:scale-110" />
              )}
              <span className="hidden sm:inline ml-2">YouTube</span>
            </Button>

            {/* Divider */}
            {hasVideo && (
              <div className="w-px h-6 bg-foreground/30 animate-pulse flex-shrink-0" />
            )}

            {/* Clip Controls Toggle */}
            {hasVideo && (
              <Button
                onClick={onToggleExpanded}
                disabled={processingState.isProcessing}
                variant="terminal"
                size="sm"
                className="group h-9 lg:h-10 flex-shrink-0"
              >
                <Clock className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline ml-2">Clip</span>
                <ChevronRight className="h-3 w-3 ml-1 transition-transform" />
              </Button>
            )}

            {/* Right Side Actions */}
            {(hasClip || hasVideo) && (
              <div className="flex items-center gap-2 ml-2">
                {hasClip && (
                  <Button
                    onClick={onDownload}
                    variant="terminal"
                    size="sm"
                    className="group animate-pulse h-9 lg:h-10 flex-shrink-0"
                  >
                    <Download className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span className="hidden sm:inline ml-2">Download</span>
                  </Button>
                )}

                {(hasVideo || hasClip) && (
                  <Button
                    onClick={onReset}
                    disabled={processingState.isProcessing}
                    variant="terminal"
                    size="sm"
                    className="group h-9 lg:h-10 flex-shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* YouTube Input Section */}
          <div
            className={`flex flex-col sm:flex-row items-center gap-3 p-3 lg:p-4 transition-all duration-500 ease-out absolute inset-0 bg-background/95 backdrop-blur-md ${
              showYoutubeInput
                ? "transform translate-x-0 opacity-100"
                : "transform translate-x-full opacity-0 pointer-events-none"
            }`}
          >
            <Button
              onClick={closeYoutubeInput}
              variant="terminal"
              size="sm"
              className="h-9 lg:h-10 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-sm font-mono text-foreground flex-shrink-0">
              <span className="animate-pulse">$</span> youtube:
            </div>

            <form
              onSubmit={handleYoutubeSubmit}
              className="flex gap-2 flex-1 min-w-0"
            >
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={handleUrlChange}
                disabled={isLoadingYoutube}
                className={`flex-1 font-mono text-sm h-9 min-w-0 ${
                  urlError ? "border-destructive" : ""
                }`}
              />
              <Button
                type="submit"
                disabled={!youtubeUrl.trim() || isLoadingYoutube || !!urlError}
                variant="terminal"
                size="sm"
                className="h-9 px-4 flex-shrink-0"
              >
                {isLoadingYoutube ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "GO"
                )}
              </Button>
            </form>

            {(youtubeError || urlError) && (
              <div className="absolute top-full left-0 right-0 mt-2 px-3 lg:px-4">
                <div className="text-xs text-destructive font-mono animate-pulse bg-background/95 backdrop-blur-md border border-destructive/30 rounded p-2">
                  error: {youtubeError || urlError}
                </div>
              </div>
            )}
          </div>

          {/* Time Controls Section */}
          <div
            className={cn(
              "flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 lg:p-4 transition-all duration-500 ease-out absolute inset-0 bg-background/95 backdrop-blur-md",
              isExpanded && hasVideo
                ? "transform translate-x-0 opacity-100"
                : "transform translate-x-full opacity-0 pointer-events-none"
            )}
          >
            <Button
              onClick={closeTimeControls}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Time Inputs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
              <div className="flex items-center gap-1">
                <label className="text-xs font-mono text-foreground whitespace-nowrap">
                  start:
                </label>
                <Input
                  type="text"
                  placeholder="00:00"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  disabled={processingState.isProcessing}
                  className={`font-mono text-sm w-20  h-8 flex-shrink-0 ${
                    timeErrors.start ? "border-destructive" : ""
                  }`}
                />
              </div>

              <div className="flex items-center gap-4 sm:gap-1">
                <label className="text-xs font-mono text-foreground whitespace-nowrap">
                  end:
                </label>
                <Input
                  type="text"
                  placeholder="00:00"
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  disabled={processingState.isProcessing}
                  className={`font-mono text-sm w-20  h-8 flex-shrink-0 ${
                    timeErrors.end ? "border-destructive" : ""
                  }`}
                />
              </div>

              <Button
                onClick={onClip}
                disabled={processingState.isProcessing || !isValidToClip}
                variant="terminal"
                size="sm"
                className="min-w-fit w-full sm:w-auto"
              >
                {processingState.isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Scissors className="h-4 w-4 mr-1 transition-transform group-hover:scale-110" />
                )}
                <span>Go</span>
                {processingState.isProcessing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/20 to-transparent animate-pulse" />
                )}
              </Button>
            </div>

            {/* Error Messages */}
            {(timeErrors.start || timeErrors.end) && (
              <div className="absolute top-full left-0 right-0 mt-2 px-3 lg:px-4">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs bg-background/95 backdrop-blur-md border border-destructive/30 rounded p-2">
                  {timeErrors.start && (
                    <span className="text-destructive font-mono">
                      start: {timeErrors.start}
                    </span>
                  )}
                  {timeErrors.end && (
                    <span className="text-destructive font-mono">
                      end: {timeErrors.end}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Processing Status Bar */}
        {(processingState.isProcessing || isLoadingYoutube) && (
          <div className="border-t border-foreground/20 p-3 lg:p-4 bg-background/50 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 text-sm font-mono mb-2">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span className="truncate flex-1">
                {processingState.isProcessing
                  ? processingState.message
                  : isLoadingYoutube
                  ? "Loading YouTube video..."
                  : "Processing..."}
              </span>
              <span className="text-muted-foreground flex-shrink-0">
                {processingState.isProcessing
                  ? `[${processingState.progress}%]`
                  : "[...]"}
              </span>
            </div>
            {processingState.isProcessing && (
              <div className="w-full bg-background/50 rounded-full h-2 border border-foreground/30">
                <div
                  className="bg-foreground h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${processingState.progress}%` }}
                />
              </div>
            )}
            {isLoadingYoutube && (
              <div className="w-full bg-background/50 rounded-full h-2 border border-foreground/30">
                <div
                  className="bg-foreground h-full rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
