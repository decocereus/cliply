"use client";

import type React from "react";
import { Terminal, Upload, Youtube, Zap, Loader2 } from "lucide-react";
import { FILE_SIZE_LIMITS } from "@/lib/utils";

interface HeroSectionProps {
  isLoadingYoutube?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isLoadingYoutube = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Loading State for YouTube */}
      {isLoadingYoutube && (
        <div className="mb-6 flex items-center gap-3 text-foreground font-mono animate-in fade-in-50 slide-in-from-top-4">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading YouTube video...</span>
        </div>
      )}

      {/* Animated Terminal Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-foreground/20 rounded-full blur-xl animate-pulse" />
        <div className="relative bg-background border-2 border-foreground rounded-lg p-6">
          <Terminal className={`h-16 w-16 text-foreground animate-pulse`} />
        </div>
      </div>

      {/* Main Heading */}
      <div className="space-y-4 mb-8">
        <h1 className="text-4xl md:text-6xl font-mono font-bold text-foreground">
          <span className="animate-pulse">$</span> cliply
        </h1>
        <div className="text-lg md:text-xl text-muted-foreground font-mono">
          <span className="animate-pulse">&gt;</span> clip videos with precision
          for free
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full mb-12">
        <div className="group border border-foreground/30 rounded-lg p-4 hover:border-foreground transition-all duration-300 hover:bg-foreground/5">
          <Upload className="h-8 w-8 text-foreground mb-2 group-hover:animate-bounce" />
          <div className="text-sm font-mono text-foreground">Upload Files</div>
          <div className="text-xs text-muted-foreground mt-1">
            MP4, AVI, MOV, MKV
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-semibold">
            Max: {FILE_SIZE_LIMITS.MAX_SIZE_MB}MB
          </div>
        </div>

        <div className="group border border-foreground/30 rounded-lg p-4 hover:border-foreground transition-all duration-300 hover:bg-foreground/5">
          <Youtube className="h-8 w-8 text-foreground mb-2 group-hover:animate-bounce" />
          <div className="text-sm font-mono text-foreground">YouTube Links</div>
          <div className="text-xs text-muted-foreground mt-1">
            Direct download & clip
          </div>
        </div>

        <div className="group border border-foreground/30 rounded-lg p-4 hover:border-foreground transition-all duration-300 hover:bg-foreground/5">
          <Zap className="h-8 w-8 text-foreground mb-2 group-hover:animate-bounce" />
          <div className="text-sm font-mono text-foreground">
            Fast Processing
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Browser-based FFmpeg
          </div>
        </div>
      </div>

      {/* Terminal Prompt */}
      <div className="font-mono text-sm text-muted-foreground">
        <span className="animate-pulse">$</span> Use the control panel below to
        get started
        <span className="animate-pulse ml-1">_</span>
      </div>
    </div>
  );
};
