import { formatTime, parseTimeString } from "@/lib/ffmpeg";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVideoProcessor } from "./useVideoProcessor";
import { toast } from "sonner";

const useVideoClipper = () => {
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeErrors, setTimeErrors] = useState<{
    start?: string;
    end?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useVideoProcessor();

  const currentVideo = getCurrentVideo();

  // Initialize FFmpeg on component mount
  useEffect(() => {
    const initializeFFmpeg = async () => {
      try {
        await loadFFmpeg();
      } catch (error) {
        toast.error("Failed to initialize FFmpeg", {
          description: "Please refresh the page and try again",
          duration: 5000,
        });
      }
    };
    initializeFFmpeg();
  }, [loadFFmpeg]);

  // Update end time when video loads
  useEffect(() => {
    if (currentVideo) {
      setEndTime(formatTime(currentVideo.duration));
    }
  }, [currentVideo]);

  const validateTimeFormat = (timeString: string): boolean => {
    const regex = /^([0-5]?\d):([0-5]?\d)$/;
    return regex.test(timeString);
  };

  const validateTimes = useCallback(
    (start: string, end: string) => {
      if (!currentVideo) return false;

      const newErrors: { start?: string; end?: string } = {};

      // Format validation
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

      // Time logic validation
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

      // Minimum clip duration (1 second)
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
    setShowYoutubeInput(false);
    setIsBarExpanded(false);
    fileInputRef.current?.click();
  };

  const handleYoutubeClick = () => {
    setInputMethod("youtube");
    setShowYoutubeInput(true);
    setIsBarExpanded(false);
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      await fetchYoutubeInfo(youtubeUrl.trim());
      setShowYoutubeInput(false);
    }
  };

  const handleReset = () => {
    reset();
    setShowYoutubeInput(false);
    setYoutubeUrl("");
    setIsBarExpanded(false);
    setStartTime("00:00");
    setEndTime("00:00");
    setTimeErrors({});
  };

  const handleTimeControlsClick = () => {
    setIsBarExpanded(!isBarExpanded);
    setShowYoutubeInput(false);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (value && endTime) {
      validateTimes(value, endTime);
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    if (startTime && value) {
      validateTimes(startTime, value);
    }
  };

  const handleClip = async () => {
    if (!validateTimes(startTime, endTime)) return;

    const startSeconds = parseTimeString(startTime);
    const endSeconds = parseTimeString(endTime);

    try {
      await processClip(startSeconds, endSeconds);
      setIsBarExpanded(false);
      toast.success("Clip created successfully", {
        description: `Clip duration: ${getClipDuration()}`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Clipping failed:", error);
      toast.error("Failed to create clip", {
        description: "Please try again with different settings",
        duration: 5000,
      });
    }
  };

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

  const isValidToClip =
    Object.keys(timeErrors).length === 0 &&
    startTime &&
    endTime &&
    currentVideo;

  return {
    showYoutubeInput,
    isBarExpanded,
    startTime,
    endTime,
    timeErrors,
    fileInputRef,
    handleUploadClick,
    handleYoutubeClick,
    handleYoutubeSubmit,
    handleReset,
    handleTimeControlsClick,
    handleStartTimeChange,
    handleEndTimeChange,
    handleClip,
    getClipDuration,
    isValidToClip,
    currentVideo,
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
    setShowYoutubeInput,
  };
};

export default useVideoClipper;
