"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useRef,
} from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { getFFmpeg, clipVideo } from "@/lib/ffmpeg";
import { ProcessingState } from "@/types";

interface FFmpegContextType {
  isLoaded: boolean;
  isLoading: boolean;
  processingState: ProcessingState;
  loadFFmpeg: () => Promise<void>;
  processVideo: (
    videoFile: File,
    startTime: number,
    endTime: number
  ) => Promise<Blob | null>;
  resetProcessing: () => void;
}

const FFmpegContext = createContext<FFmpegContextType | undefined>(undefined);

export const FFmpegProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: "",
  });

  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = useCallback(async () => {
    if (isLoading) return;
    if (isLoaded && ffmpegRef.current) return;

    setIsLoading(true);
    setProcessingState({
      isProcessing: true,
      progress: 0,
      message: "Loading FFmpeg...",
    });

    try {
      console.log("Loading FFmpeg...");
      ffmpegRef.current = await getFFmpeg();
      setIsLoaded(true);
      setProcessingState({
        isProcessing: false,
        progress: 100,
        message: "FFmpeg loaded successfully",
      });
    } catch (error) {
      console.error("Failed to load FFmpeg:", error);
      setIsLoaded(false);
      ffmpegRef.current = null;
      setProcessingState({
        isProcessing: false,
        progress: 0,
        message: "",
        error:
          "Failed to load video processor. Please try refreshing the page.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLoaded]);

  const processVideo = useCallback(
    async (
      videoFile: File,
      startTime: number,
      endTime: number
    ): Promise<Blob | null> => {
      if (!isLoaded || !ffmpegRef.current) {
        setProcessingState({
          isProcessing: true,
          progress: 0,
          message: "Loading video processor...",
        });

        await loadFFmpeg();

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setProcessingState({
        isProcessing: true,
        progress: 0,
        message: "Processing video...",
      });

      try {
        const result = await clipVideo(
          videoFile,
          startTime,
          endTime,
          (progress: number) => {
            setProcessingState({
              isProcessing: true,
              progress,
              message: `Processing video... ${progress}%`,
            });
          }
        );

        setProcessingState({
          isProcessing: false,
          progress: 100,
          message: "Video processed successfully",
        });

        return result;
      } catch (error) {
        console.error("Video processing failed:", error);
        setProcessingState({
          isProcessing: false,
          progress: 0,
          message: "",
          error:
            error instanceof Error ? error.message : "Video processing failed",
        });
        return null;
      }
    },
    [isLoaded, loadFFmpeg]
  );

  const resetProcessing = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      progress: 0,
      message: "",
    });
  }, []);

  const contextValue: FFmpegContextType = {
    isLoaded,
    isLoading,
    processingState,
    loadFFmpeg,
    processVideo,
    resetProcessing,
  };

  return (
    <FFmpegContext.Provider value={contextValue}>
      {children}
    </FFmpegContext.Provider>
  );
};

export const useFFmpegContext = () => {
  const context = useContext(FFmpegContext);
  if (context === undefined) {
    throw new Error("useFFmpegContext must be used within a FFmpegProvider");
  }
  return context;
};
