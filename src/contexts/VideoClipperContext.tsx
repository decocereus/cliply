"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { toast } from "sonner";
import {
  formatTime,
  parseTimeString,
  getVideoMetadata,
  validateVideoFile,
  generateVideoThumbnail,
} from "@/lib/ffmpeg";
import { validateYouTubeUrl } from "@/lib/youtube";
import type {
  VideoFile,
  YouTubeVideoInfo,
  DownloadState,
  LoadingState,
  InputMethod,
  ProcessingState,
} from "@/types";

interface VideoClipperContextType {
  isBarExpanded: boolean;
  setIsBarExpanded: (expanded: boolean) => void;
  startTime: string;
  endTime: string;
  timeErrors: { start?: string; end?: string };

  fileInputRef: React.RefObject<HTMLInputElement | null>;

  inputMethod: InputMethod;
  videoFile: VideoFile | null;
  youtubeInfo: YouTubeVideoInfo | null;
  youtubeUrl: string;
  downloadState: DownloadState;
  isLoadingYoutube: boolean;
  youtubeError: string | null;
  uploadLoadingState: LoadingState;
  processingState: ProcessingState;
  currentVideo: {
    duration: number;
    title: string;
    url: string;
  } | null;

  handleUploadClick: () => void;
  handleYoutubeClick: () => void;
  handleYoutubeSubmit: (url: string) => Promise<void>;
  handleReset: () => void;
  handleTimeControlsClick: () => void;
  handleStartTimeChange: (value: string) => void;
  handleEndTimeChange: (value: string) => void;
  handleClip: () => Promise<void>;
  handleFileUpload: (file: File) => Promise<void>;
  downloadClip: () => void;

  getClipDuration: () => string;
  isValidToClip: boolean;
}

const VideoClipperContext = createContext<VideoClipperContextType | undefined>(
  undefined
);

const generateFileName = (
  title: string,
  startTime: number,
  endTime: number
): string => {
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  const startMinutes = Math.floor(startTime / 60);
  const startSeconds = Math.floor(startTime % 60);
  const endMinutes = Math.floor(endTime / 60);
  const endSecondsRemainder = Math.floor(endTime % 60);
  return `${sanitizedTitle}_clip_${startMinutes}m${startSeconds}s-${endMinutes}m${endSecondsRemainder}s.mp4`;
};

export const VideoClipperProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeErrors, setTimeErrors] = useState<{
    start?: string;
    end?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endTimeModifiedRef = useRef(false);

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
  const [uploadLoadingState, setUploadLoadingState] = useState<LoadingState>({
    isLoading: false,
    stage: "idle",
  });
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    message: "",
  });

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
    } else if (inputMethod === "youtube" && isLoadingYoutube) {
      return {
        duration: 0,
        title: "Loading YouTube video...",
        url: "/placeholder.svg",
      };
    }
    return null;
  }, [inputMethod, videoFile, youtubeInfo, isLoadingYoutube]);

  const currentVideo = getCurrentVideo();

  useEffect(() => {
    return () => {
      if (videoFile?.url) {
        URL.revokeObjectURL(videoFile.url);
      }
      if (downloadState.url) {
        URL.revokeObjectURL(downloadState.url);
      }
    };
  }, [videoFile?.url, downloadState.url]);

  useEffect(() => {
    if (
      currentVideo &&
      currentVideo.duration > 0 &&
      !endTimeModifiedRef.current
    ) {
      setEndTime(formatTime(currentVideo.duration));
    }
  }, [currentVideo]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadLoadingState({
      isLoading: true,
      stage: "validating",
      message: "Validating file...",
    });

    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      setUploadLoadingState({ isLoading: false, stage: "idle" });
      const errorMessage = validation.error || "Invalid file";
      toast.error("File validation failed", {
        description: errorMessage,
        duration: 5000,
      });
      throw new Error(errorMessage);
    }

    try {
      setUploadLoadingState({
        isLoading: true,
        stage: "reading_metadata",
        message: "Reading video metadata...",
      });

      const metadata = await getVideoMetadata(file);

      if (metadata.duration > 120) {
        setUploadLoadingState({ isLoading: false, stage: "idle" });
        const errorMessage = "Video duration exceeds 2 minutes limit";
        toast.error("Duration limit exceeded", {
          description: errorMessage,
          duration: 5000,
        });
        throw new Error(errorMessage);
      }

      setUploadLoadingState({
        isLoading: true,
        stage: "creating_thumbnail",
        message: "Processing video...",
      });

      const videoUrl = URL.createObjectURL(file);
      let thumbnailUrl: string | undefined;

      try {
        thumbnailUrl = await generateVideoThumbnail(file);
      } catch (error) {
        console.warn("Failed to generate thumbnail:", error);
      }

      setVideoFile({
        file,
        url: videoUrl,
        thumbnailUrl,
        metadata: {
          duration: metadata.duration,
          format: metadata.format,
          size: file.size,
          title: file.name.split(".")[0],
        },
      });

      setYoutubeInfo(null);
      setYoutubeError(null);
      setInputMethod("upload");
      setUploadLoadingState({
        isLoading: false,
        stage: "ready",
        message: "Video ready for clipping",
      });
    } catch (error) {
      setUploadLoadingState({ isLoading: false, stage: "idle" });
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      if (
        !(error instanceof Error) ||
        (!error.message?.includes("duration") &&
          !error.message?.includes("validation"))
      ) {
        toast.error("Upload failed", {
          description: errorMessage,
          duration: 5000,
        });
      }
      throw error;
    }
  }, []);

  const fetchYoutubeInfo = useCallback(async (url: string) => {
    setIsLoadingYoutube(true);
    setYoutubeError(null);

    await new Promise((resolve) => setTimeout(resolve, 100));

    setInputMethod("youtube");

    const validation = validateYouTubeUrl(url);
    if (!validation.isValid) {
      const errorMessage = validation.error || "Invalid YouTube URL";
      setYoutubeError(errorMessage);
      setIsLoadingYoutube(false);
      toast.error("Invalid YouTube URL", {
        description: errorMessage,
        duration: 5000,
      });
      return;
    }

    try {
      const response = await fetch("/api/youtube/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: validation.normalizedUrl || url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch video info");
      }

      setYoutubeInfo(data);
      setYoutubeUrl(validation.normalizedUrl || url);
      setVideoFile(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch video info";
      setYoutubeError(errorMessage);
      setYoutubeInfo(null);
      toast.error("YouTube Error", {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoadingYoutube(false);
    }
  }, []);

  const processClip = useCallback(
    async (startTime: number, endTime: number): Promise<void> => {
      try {
        setProcessingState({
          isProcessing: true,
          progress: 0,
          message: "Preparing video for processing...",
          stage: "loading",
        });

        const formData = new FormData();
        formData.append("startTime", startTime.toString());
        formData.append("endTime", endTime.toString());

        if (inputMethod === "upload" && videoFile) {
          formData.append("type", "upload");
          formData.append("video", videoFile.file);
          setProcessingState({
            isProcessing: true,
            progress: 25,
            message: "Uploading video to server...",
            stage: "processing",
          });
        } else if (inputMethod === "youtube" && youtubeInfo && youtubeUrl) {
          formData.append("type", "youtube");
          formData.append("youtubeUrl", youtubeUrl);
          setProcessingState({
            isProcessing: true,
            progress: 25,
            message: "Downloading video from YouTube...",
            stage: "downloading",
          });
        } else {
          throw new Error("No video selected");
        }

        console.log("Sending video to server for processing...");

        setProcessingState({
          isProcessing: true,
          progress: 50,
          message: "Processing video on server...",
          stage: "processing",
        });

        const response = await fetch("/api/video/clip", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process video");
        }

        setProcessingState({
          isProcessing: true,
          progress: 90,
          message: "Finalizing clip...",
          stage: "finalizing",
        });

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);

        const title =
          videoFile?.metadata.title || youtubeInfo?.title || "video";
        const filename = generateFileName(title, startTime, endTime);

        setDownloadState({
          url: downloadUrl,
          filename,
          size: blob.size,
          isReady: true,
        });

        setProcessingState({
          isProcessing: false,
          progress: 100,
          message: "Video processed successfully",
          stage: "complete",
        });

        console.log("Video processed successfully on server");
      } catch (error) {
        console.error("Clip processing failed:", error);
        setProcessingState({
          isProcessing: false,
          progress: 0,
          message: "",
          error: error instanceof Error ? error.message : "Processing failed",
        });
        throw error;
      }
    },
    [inputMethod, videoFile, youtubeInfo, youtubeUrl]
  );

  const validateTimeFormat = (timeString: string): boolean => {
    const regex = /^([0-5]?\d):([0-5]?\d)$/;
    return regex.test(timeString);
  };

  const validateTimes = useCallback(
    (start: string, end: string) => {
      if (!currentVideo) return false;

      const newErrors: { start?: string; end?: string } = {};

      if (!validateTimeFormat(start)) {
        newErrors.start = "Invalid format. Use MM:SS";
      }
      if (!validateTimeFormat(end)) {
        newErrors.end = "Invalid format. Use MM:SS";
      }

      if (Object.keys(newErrors).length > 0) {
        setTimeErrors(newErrors);
        return false;
      }

      const startSeconds = parseTimeString(start);
      const endSeconds = parseTimeString(end);

      if (startSeconds >= endSeconds) {
        newErrors.start = "Start < end";
        newErrors.end = "End > start";
      }

      if (startSeconds < 0) {
        newErrors.start = "Cannot be negative";
      }

      if (endSeconds > currentVideo.duration) {
        newErrors.end = `Max: ${formatTime(currentVideo.duration)}`;
      }

      if (startSeconds >= currentVideo.duration) {
        newErrors.start = `Max: ${formatTime(currentVideo.duration)}`;
      }

      if (endSeconds - startSeconds < 1) {
        newErrors.start = "Min 1s duration";
      }

      setTimeErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [currentVideo]
  );

  const handleUploadClick = () => {
    setInputMethod("upload");
    setIsBarExpanded(false);
    fileInputRef.current?.click();
  };

  const handleYoutubeClick = () => {
    setInputMethod("youtube");
    setIsBarExpanded(false);
  };

  const handleYoutubeSubmit = async (url: string) => {
    if (url.trim()) {
      setIsBarExpanded(false);
      await fetchYoutubeInfo(url.trim());
    }
  };

  const handleReset = () => {
    // Cleanup URLs
    if (videoFile?.url) {
      URL.revokeObjectURL(videoFile.url);
    }
    if (videoFile?.thumbnailUrl) {
      URL.revokeObjectURL(videoFile.thumbnailUrl);
    }
    if (downloadState.url) {
      URL.revokeObjectURL(downloadState.url);
    }

    // Reset all video state
    setVideoFile(null);
    setYoutubeInfo(null);
    setYoutubeUrl("");
    setDownloadState({ filename: "", isReady: false });
    setYoutubeError(null);

    // Reset loading states
    setUploadLoadingState({ isLoading: false, stage: "idle" });
    setIsLoadingYoutube(false);
    setProcessingState({
      isProcessing: false,
      progress: 0,
      message: "",
      error: undefined,
    });

    // Reset UI state
    setIsBarExpanded(false);
    setInputMethod("upload"); // Reset to default input method
    setStartTime("00:00");
    setEndTime("00:00");
    setTimeErrors({});

    // Reset refs
    endTimeModifiedRef.current = false;

    // Clear file input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTimeControlsClick = () => {
    setIsBarExpanded(!isBarExpanded);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (value && endTime) {
      validateTimes(value, endTime);
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    endTimeModifiedRef.current = true;
    if (startTime && value) {
      validateTimes(startTime, value);
    }
  };

  const handleClip = async () => {
    if (!validateTimes(startTime, endTime)) return;

    const startSeconds = parseTimeString(startTime);
    const endSeconds = parseTimeString(endTime);

    setIsBarExpanded(false);

    try {
      await processClip(startSeconds, endSeconds);
      toast.success("Clip created successfully", {
        description: `Clip duration: ${getClipDuration()}`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Clipping failed:", error);
      toast.error("Failed to create clip", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    }
  };

  const downloadClip = useCallback(() => {
    if (!downloadState.url) return;

    const link = document.createElement("a");
    link.href = downloadState.url;
    link.download = downloadState.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadState]);

  const getClipDuration = () => {
    if (validateTimeFormat(startTime) && validateTimeFormat(endTime)) {
      const start = parseTimeString(startTime);
      const end = parseTimeString(endTime);
      if (end > start) {
        return formatTime(end - start);
      }
    }
    return "00:00";
  };

  const isValidToClip = Boolean(
    Object.keys(timeErrors).length === 0 && startTime && endTime && currentVideo
  );

  const contextValue: VideoClipperContextType = {
    isBarExpanded,
    setIsBarExpanded,
    startTime,
    endTime,
    timeErrors,

    fileInputRef,

    inputMethod,
    videoFile,
    youtubeInfo,
    youtubeUrl,
    downloadState,
    isLoadingYoutube,
    youtubeError,
    uploadLoadingState,
    processingState,
    currentVideo,

    handleUploadClick,
    handleYoutubeClick,
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
  };

  return (
    <VideoClipperContext.Provider value={contextValue}>
      {children}
    </VideoClipperContext.Provider>
  );
};

export const useVideoClipperContext = () => {
  const context = useContext(VideoClipperContext);
  if (context === undefined) {
    throw new Error(
      "useVideoClipperContext must be used within a VideoClipperProvider"
    );
  }
  return context;
};
