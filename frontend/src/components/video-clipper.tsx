"use client";

import type React from "react";
import { Input } from "@/components/ui/input";
import { HeroSection } from "./hero-section";
import { ControlBar } from "./control-bar";
import { VideoDisplay } from "./video-display";
import { useVideoClipperContext } from "@/contexts/VideoClipperContext";
import { toast } from "sonner";
import { formatTime, checkFileSizeLimit } from "@/lib/utils";

export const VideoClipper: React.FC = () => {
  const {
    isBarExpanded,
    startTime,
    endTime,
    timeErrors,
    fileInputRef,
    currentVideo,
    inputMethod,
    videoFile,
    youtubeInfo,
    downloadState,
    isLoadingYoutube,
    youtubeError,
    uploadLoadingState,
    processingState,
    handleUploadClick,
    handleYoutubeSubmit,
    handleReset,
    handleTimeControlsClick,
    handleStartTimeChange,
    handleEndTimeChange,
    handleClip,
    handleFileUpload,
    downloadClip,
    getClipDuration,
    isValidToClip,
  } = useVideoClipperContext();

  const handleUpload = () => {
    handleUploadClick();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Early file size check to provide immediate feedback
      const sizeCheck = checkFileSizeLimit(file);
      if (!sizeCheck.isValid) {
        toast.error("File too large", {
          description: `${sizeCheck.error}. Please choose a smaller file.`,
          duration: 6000,
        });
        // Clear the file input
        e.target.value = "";
        return;
      }

      try {
        await handleFileUpload(file);
        toast.success("Video uploaded successfully", {
          description: currentVideo
            ? `Duration: ${formatTime(currentVideo.duration)}`
            : "Video ready for clipping",
        });
      } catch (error) {
        console.error("File upload error:", error);
        // Clear the file input on error
        e.target.value = "";
      }
    }
  };

  const handleYoutubeUrl = async (url: string) => {
    try {
      await handleYoutubeSubmit(url);
    } catch (error) {
      console.error("YouTube URL error:", error);
    }
  };

  return (
    <div className="h-full bg-background text-foreground font-mono relative overflow-hidden mb-4">
      {/* Hidden file input */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/avi,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm,.m4v"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-4">
          {!currentVideo ||
          isLoadingYoutube ||
          (inputMethod === "youtube" && !youtubeInfo) ? (
            <div className="pb-32">
              <HeroSection
                isLoadingYoutube={
                  isLoadingYoutube ||
                  (inputMethod === "youtube" && !youtubeInfo)
                }
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto pb-40 lg:pb-48">
              <VideoDisplay
                video={currentVideo}
                inputMethod={inputMethod}
                videoFile={videoFile}
                youtubeInfo={youtubeInfo}
              />
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <ControlBar
        isExpanded={isBarExpanded}
        onToggleExpanded={handleTimeControlsClick}
        onUploadClick={handleUpload}
        onYoutubeSubmit={handleYoutubeUrl}
        onClip={handleClip}
        onReset={handleReset}
        onDownload={downloadClip}
        startTime={startTime}
        endTime={endTime}
        onStartTimeChange={handleStartTimeChange}
        onEndTimeChange={handleEndTimeChange}
        timeErrors={timeErrors}
        clipDuration={getClipDuration()}
        isValidToClip={!!isValidToClip}
        hasVideo={!!currentVideo}
        hasClip={downloadState.isReady}
        processingState={processingState}
        isLoadingYoutube={isLoadingYoutube}
        youtubeError={youtubeError}
        uploadLoadingState={uploadLoadingState}
      />
    </div>
  );
};
