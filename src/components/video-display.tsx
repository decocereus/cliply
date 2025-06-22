"use client";

import type React from "react";
import Image from "next/image";
import { Clock, FileWarning } from "lucide-react";
import { formatTime } from "@/lib/ffmpeg";
import { VideoDisplayProps } from "@/types";

export const VideoDisplay: React.FC<VideoDisplayProps> = ({
  video,
  inputMethod,
  videoFile,
  youtubeInfo,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
      {/* Video Info Header */}
      <div className="flex flex-col md:flex-row items-center w-full justify-between bg-background/80 backdrop-blur-sm border border-foreground/30 rounded-md px-4 py-2 shadow-lg">
        <h3 className="text-foreground font-mono text-sm md:text-base break-words leading-relaxed">
          <span className="text-foreground font-mono text-md animate-pulse mr-1">
            $
          </span>
          loaded: {video.title}
        </h3>
        <div className="flex items-center gap-x-1.5 text-sm">
          <Clock className="h-3 w-3" />
          <span>duration: {formatTime(video.duration)}</span>
        </div>
      </div>
      {youtubeInfo?.warning && (
        <div className="flex items-center gap-x-1 text-yellow-500 animate-pulse">
          <FileWarning />
          <span className="hidden sm:inline">{youtubeInfo.warning}</span>
          <span className="sm:hidden">Long video</span>
        </div>
      )}

      {/* Video Player/Thumbnail */}
      <div className="relative group">
        <div className=" max-w-3xl mx-auto border-2 border-foreground/30 rounded-lg overflow-hidden bg-background/20 backdrop-blur-sm transition-all duration-300 group-hover:border-foreground/50 shadow-xl">
          {inputMethod === "upload" && videoFile ? (
            <div className="relative ">
              <video
                id="uploaded-video"
                src={video.url}
                controls
                preload="metadata"
                style={{
                  aspectRatio: "16/9",
                }}
              />
            </div>
          ) : (
            <div className="relative">
              <Image
                src={video.url || "/placeholder.svg"}
                alt="Video thumbnail"
                className="w-full max-h-[50vh] lg:max-h-[60vh] object-contain bg-background"
                width={1280}
                height={720}
                unoptimized
                priority
                style={{ aspectRatio: "16/9" }}
              />

              <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-white border border-red-500">
                YOUTUBE
              </div>

              <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-foreground border border-foreground/30">
                {formatTime(video.duration)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
