"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Youtube,
  Upload,
  Download,
  RotateCcw,
  Play,
  Terminal,
  Clock,
  Scissors,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "./progress-bar";
import { useVideoProcessor } from "@/hooks/useVideoProcessor";
import { formatBytes } from "@/lib/youtube";
import { formatTime, parseTimeString } from "@/lib/ffmpeg";
import { toast } from "sonner";
import useVideoClipper from "@/hooks/useVideoClipper";
import Image from "next/image";

export const VideoClipper: React.FC = () => {
  const {
    showYoutubeInput,
    isBarExpanded,
    startTime,
    endTime,
    timeErrors,
    fileInputRef,
    handleFileUpload,
    handleYoutubeSubmit,
    youtubeUrl,
    setYoutubeUrl,
    isLoadingYoutube,
    youtubeError,
    processingState,
    currentVideo,
    inputMethod,
    videoFile,
    youtubeInfo,
    downloadState,
    handleReset,
    handleUploadClick,
    handleYoutubeClick,
    handleTimeControlsClick,
    handleStartTimeChange,
    handleEndTimeChange,
    handleClip,
    getClipDuration,
    isValidToClip,
    downloadClip,
    setShowYoutubeInput,
  } = useVideoClipper();

  return (
    <div className="bg-background text-foreground font-mono relative">
      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/avi,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm,.m4v"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className="hidden"
      />

      {/* Main Content */}
      <div className="p-3 sm:p-6">
        {/* YouTube URL Input Overlay */}
        {showYoutubeInput && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-foreground bg-background rounded-lg">
            <form onSubmit={handleYoutubeSubmit} className="space-y-3">
              <div className="text-green-300 text-sm sm:text-base">
                $ enter youtube url:
              </div>
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isLoadingYoutube}
                className="bg-background border-foreground text-foreground font-mono text-sm sm:text-base"
              />
              <div className="flex flex-col xs:flex-row gap-2">
                <Button
                  type="submit"
                  disabled={!youtubeUrl.trim() || isLoadingYoutube}
                  className="bg-background hover:bg-background text-foreground border border-foreground font-mono text-sm sm:text-base flex-1 xs:flex-none"
                >
                  {isLoadingYoutube ? "loading..." : "[ENTER]"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowYoutubeInput(false)}
                  variant="outline"
                  className="border-foreground text-foreground hover:bg-background font-mono text-sm sm:text-base flex-1 xs:flex-none"
                >
                  [ESC]
                </Button>
              </div>
            </form>

            {youtubeError && (
              <div className="mt-3 p-2 text-red-400 bg-red-950/20 border border-foreground rounded text-xs sm:text-sm break-words">
                error: {youtubeError}
              </div>
            )}
          </div>
        )}

        {/* Video Display */}
        {currentVideo && (
          <div className="space-y-3 sm:space-y-4">
            {/* Video Info */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-y-3 sm:gap-y-4 mb-4 sm:mb-6">
              <div className="text-foreground space-y-1 w-full p-4">
                <div className="flex items-start gap-x-1">
                  <span className="animate-caret-blink text-sm sm:text-base flex-shrink-0">
                    $
                  </span>
                  <p className="text-sm sm:text-base break-words min-w-0">
                    loaded: {currentVideo.title}
                  </p>
                </div>
                <div className="text-foreground text-xs sm:text-sm">
                  duration: {Math.floor(currentVideo.duration / 60)}:
                  {(currentVideo.duration % 60).toString().padStart(2, "0")}
                  {youtubeInfo?.warning && (
                    <span className="text-yellow-500 block xs:inline xs:ml-4 mt-1 xs:mt-0">
                      ⚠ {youtubeInfo.warning}
                    </span>
                  )}
                </div>
              </div>
              <ProgressBar processingState={processingState} />
            </div>

            {/* Video Player */}
            <div className="border border-foreground rounded overflow-hidden max-w-3xl mx-auto">
              {inputMethod === "upload" && videoFile ? (
                <video
                  src={currentVideo.url}
                  controls
                  preload="metadata"
                  className="w-full max-h-[50vh] sm:max-h-[70vh]"
                />
              ) : (
                <Image
                  src={currentVideo.url}
                  alt="Video thumbnail"
                  className="w-full max-h-[50vh] sm:max-h-[70vh] object-contain bg-background"
                  width={1000}
                  height={1000}
                />
              )}
            </div>
          </div>
        )}

        {/* Processing Progress */}

        {/* Download Section */}
        {downloadState.isReady && downloadState.url && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 border border-foreground bg-background rounded-lg">
            <div className="text-foreground mb-2 sm:mb-3 text-sm sm:text-base">
              $ clip ready:
            </div>
            <div className="text-foreground text-xs sm:text-sm space-y-1 mb-3 sm:mb-4">
              <div className="break-words">file: {downloadState.filename}</div>
              {downloadState.size && (
                <div>size: {formatBytes(downloadState.size)}</div>
              )}
            </div>
            <Button
              onClick={downloadClip}
              className="bg-background hover:bg-background text-foreground border border-foreground font-mono text-sm sm:text-base w-full xs:w-auto"
            >
              <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              [DOWNLOAD]
            </Button>
          </div>
        )}
      </div>

      {/* Expandable Floating Action Bar */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-10 w-[calc(100vw-2rem)] sm:w-auto max-w-none sm:max-w-4xl">
        <div
          className={`bg-background rounded-xl border border-foreground backdrop-blur-sm transition-all duration-300 ${
            isBarExpanded
              ? "py-2 sm:py-2.5 px-3 sm:px-6"
              : "py-2 sm:py-2.5 px-2 sm:px-4"
          }`}
        >
          {/* Main Action Row */}
          <div className="flex items-center gap-1 sm:gap-3 justify-center">
            {/* Main Action Buttons */}
            <Button
              onClick={handleUploadClick}
              disabled={processingState.isProcessing}
              variant="terminal"
              size="sm"
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              {!isBarExpanded && (
                <span className="hidden xs:inline ml-1 sm:ml-2">Upload</span>
              )}
            </Button>

            <Button
              onClick={handleYoutubeClick}
              disabled={processingState.isProcessing}
              variant="terminal"
              size="sm"
              className="h-8 sm:h-9 px-2 sm:px-3"
            >
              <Youtube className="h-3 w-3 sm:h-4 sm:w-4" />
              {!isBarExpanded && (
                <span className="hidden xs:inline ml-1 sm:ml-2">YouTube</span>
              )}
            </Button>

            {currentVideo && (
              <Button
                onClick={handleTimeControlsClick}
                disabled={processingState.isProcessing}
                variant="terminal"
                size="sm"
                className="transition-all duration-300 h-8 sm:h-9 px-2 sm:px-3"
              >
                {!isBarExpanded && (
                  <>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline ml-1 sm:ml-2">Clip</span>
                  </>
                )}

                {isBarExpanded ? (
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            )}

            {(currentVideo || downloadState.isReady) && (
              <Button
                onClick={handleReset}
                disabled={processingState.isProcessing}
                size="sm"
                variant="terminal"
                className="h-8 sm:h-9 px-2 sm:px-3"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Expanded Time Controls - Always Horizontal */}
          {isBarExpanded && currentVideo && (
            <div className="mt-2 md:mt-0 md:ml-2 md:pl-3 md:border-l md:border-foreground pt-2 md:pt-0">
              <div className="flex items-center gap-1 md:gap-3 overflow-x-auto">
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <div className="text-foreground text-xs whitespace-nowrap">
                    start:
                  </div>
                  <Input
                    type="text"
                    placeholder="00:00"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    disabled={processingState.isProcessing}
                    className={`bg-background border-foreground text-foreground font-mono text-xs md:text-sm w-16 md:w-20 h-7 md:h-8 flex-shrink-0 ${
                      timeErrors.start ? "border-red-600" : ""
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <div className="text-foreground text-xs whitespace-nowrap">
                    end:
                  </div>
                  <Input
                    type="text"
                    placeholder={formatTime(currentVideo.duration)}
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    disabled={processingState.isProcessing}
                    className={`bg-background border-foreground text-foreground font-mono text-xs md:text-sm w-16 md:w-20 h-7 md:h-8 flex-shrink-0 ${
                      timeErrors.end ? "border-red-600" : ""
                    }`}
                  />
                </div>

                <div className="text-foreground text-xs flex-shrink-0 min-w-0">
                  {getClipDuration()}
                </div>

                <Button
                  onClick={handleClip}
                  disabled={processingState.isProcessing || !isValidToClip}
                  variant="terminal"
                  size="sm"
                  className="h-7 md:h-8 px-2 md:px-3 text-xs flex-shrink-0"
                >
                  <Scissors className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Process</span>
                  <span className="sm:hidden">Go</span>
                </Button>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {isBarExpanded && (timeErrors.start || timeErrors.end) && (
            <div className="mt-2 pt-2 border-t border-foreground">
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs">
                {timeErrors.start && (
                  <span className="text-destructive">
                    start: {timeErrors.start}
                  </span>
                )}
                {timeErrors.end && (
                  <span className="text-destructive">
                    end: {timeErrors.end}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
