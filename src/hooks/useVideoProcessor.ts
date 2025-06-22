import { useState, useCallback } from "react";
import {
  VideoFile,
  YouTubeVideoInfo,
  DownloadState,
  InputMethod,
} from "@/types";
import { getVideoMetadata, validateVideoFile } from "@/lib/ffmpeg";
import { generateFileName } from "@/lib/youtube";
import { useFFmpeg } from "./useFFmpeg";

export const useVideoProcessor = () => {
  const [inputMethod, setInputMethod] = useState<InputMethod>("upload");
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeVideoInfo | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [downloadState, setDownloadState] = useState<DownloadState>({
    filename: "",
    isReady: false,
  });
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const { processVideo, processingState, loadFFmpeg, resetProcessing } =
    useFFmpeg();

  const handleFileUpload = useCallback(async (file: File) => {
    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    try {
      const metadata = await getVideoMetadata(file);

      // Check duration limit (120 seconds = 2 minutes)
      if (metadata.duration > 120) {
        throw new Error("Video duration exceeds 2 minutes limit");
      }

      const videoUrl = URL.createObjectURL(file);

      setVideoFile({
        file,
        url: videoUrl,
        metadata: {
          duration: metadata.duration,
          format: metadata.format,
          size: file.size,
          title: file.name.split(".")[0],
        },
      });

      setYoutubeInfo(null);
      setYoutubeError(null);
    } catch (error) {
      throw error;
    }
  }, []);

  const fetchYoutubeInfo = useCallback(async (url: string) => {
    setIsLoadingYoutube(true);
    setYoutubeError(null);

    try {
      const response = await fetch("/api/youtube/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch video info");
      }

      setYoutubeInfo(data);
      setYoutubeUrl(url);
      setVideoFile(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch video info";
      setYoutubeError(errorMessage);
      setYoutubeInfo(null);
    } finally {
      setIsLoadingYoutube(false);
    }
  }, []);

  const downloadYoutubeVideo = useCallback(
    async (url: string, quality?: string): Promise<File> => {
      const response = await fetch("/api/youtube/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, quality }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download video");
      }

      const blob = await response.blob();
      const filename = `youtube_video_${Date.now()}.mp4`;
      return new File([blob], filename, { type: "video/mp4" });
    },
    []
  );

  const processClip = useCallback(
    async (startTime: number, endTime: number): Promise<void> => {
      let fileToProcess: File;

      try {
        if (inputMethod === "upload" && videoFile) {
          fileToProcess = videoFile.file;
        } else if (inputMethod === "youtube" && youtubeInfo && youtubeUrl) {
          // Download YouTube video first
          fileToProcess = await downloadYoutubeVideo(youtubeUrl);
        } else {
          throw new Error("No video selected");
        }

        // Process the video
        const result = await processVideo(fileToProcess, startTime, endTime);

        if (result) {
          const downloadUrl = URL.createObjectURL(result);
          const title =
            videoFile?.metadata.title || youtubeInfo?.title || "video";
          const filename = generateFileName(title, startTime, endTime);

          setDownloadState({
            url: downloadUrl,
            filename,
            size: result.size,
            isReady: true,
          });
        } else {
          throw new Error("Failed to process video");
        }
      } catch (error) {
        console.error("Clip processing failed:", error);
        throw error;
      }
    },
    [
      inputMethod,
      videoFile,
      youtubeInfo,
      youtubeUrl,
      processVideo,
      downloadYoutubeVideo,
    ]
  );

  const downloadClip = useCallback(() => {
    if (!downloadState.url) return;

    const link = document.createElement("a");
    link.href = downloadState.url;
    link.download = downloadState.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadState]);

  const reset = useCallback(() => {
    if (videoFile?.url) {
      URL.revokeObjectURL(videoFile.url);
    }
    if (downloadState.url) {
      URL.revokeObjectURL(downloadState.url);
    }

    setVideoFile(null);
    setYoutubeInfo(null);
    setYoutubeUrl("");
    setDownloadState({ filename: "", isReady: false });
    setYoutubeError(null);
    resetProcessing();
  }, [videoFile, downloadState, resetProcessing]);

  const getCurrentVideo = useCallback(() => {
    if (inputMethod === "upload" && videoFile) {
      return {
        duration: videoFile.metadata.duration,
        title: videoFile.metadata.title || "Uploaded Video",
        url: videoFile.url,
      };
    } else if (inputMethod === "youtube" && youtubeInfo) {
      return {
        duration: youtubeInfo.duration,
        title: youtubeInfo.title,
        url: youtubeInfo.thumbnail,
      };
    }
    return null;
  }, [inputMethod, videoFile, youtubeInfo]);

  return {
    inputMethod,
    setInputMethod,
    videoFile,
    youtubeInfo,
    youtubeUrl,
    setYoutubeUrl,
    downloadState,
    isLoadingYoutube,
    youtubeError,
    processingState,
    handleFileUpload,
    fetchYoutubeInfo,
    processClip,
    downloadClip,
    reset,
    getCurrentVideo,
    loadFFmpeg,
  };
};
