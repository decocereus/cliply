import { useState, useCallback, useRef } from "react";
import { getFFmpeg, clipVideo } from "@/lib/ffmpeg";
import { ProcessingState } from "@/types";

export const useFFmpeg = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: "",
  });

  const ffmpegRef = useRef<any>(null);

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
  }, [isLoading]);

  const processVideo = useCallback(
    async (
      videoFile: File,
      startTime: number,
      endTime: number
    ): Promise<Blob | null> => {
      // Always ensure FFmpeg is loaded
      if (!isLoaded || !ffmpegRef.current) {
        setProcessingState({
          isProcessing: true,
          progress: 0,
          message: "Loading video processor...",
        });

        await loadFFmpeg();

        // Wait for state to update
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
    [loadFFmpeg]
  );

  const resetProcessing = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      progress: 0,
      message: "",
    });
  }, []);

  return {
    isLoaded,
    isLoading,
    processingState,
    loadFFmpeg,
    processVideo,
    resetProcessing,
  };
};
