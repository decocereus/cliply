import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getVideoMetadata = async (
  videoFile: File
): Promise<{
  duration: number;
  format: string;
  title: string;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        format: videoFile.type,
        title: videoFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata"));
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(videoFile);
  });
};

export const validateVideoFile = (
  file: File
): { isValid: boolean; error?: string } => {
  const maxSize = 800 * 1024 * 1024; // 800MB
  const supportedTypes = [
    "video/mp4",
    "video/avi",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
  ];

  if (file.size > maxSize) {
    return { isValid: false, error: "File size exceeds 800MB limit" };
  }

  const isSupportedType = supportedTypes.includes(file.type);

  let isSupportedExtension = false;
  if (!isSupportedType) {
    const extension = file.name.toLowerCase().split(".").pop();
    isSupportedExtension = Boolean(
      extension &&
        ["mp4", "avi", "mov", "mkv", "webm", "m4v"].includes(extension)
    );
  }

  if (!isSupportedType && !isSupportedExtension) {
    return {
      isValid: false,
      error: "Supported formats: MP4, AVI, MOV, MKV, WebM",
    };
  }

  return { isValid: true };
};

export const isValidYouTubeUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;

  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(url.trim());
};

export const validateYouTubeUrl = (
  url: string
): { isValid: boolean; error?: string; normalizedUrl?: string } => {
  if (!url || typeof url !== "string") {
    return { isValid: false, error: "URL is required" };
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { isValid: false, error: "URL is required" };
  }

  try {
    new URL(
      trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`
    );
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  if (!isValidYouTubeUrl(trimmedUrl)) {
    return { isValid: false, error: "Must be a valid YouTube URL" };
  }

  const videoId = extractVideoId(trimmedUrl);
  if (!videoId) {
    return { isValid: false, error: "Could not extract video ID from URL" };
  }

  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return { isValid: true, normalizedUrl };
};

export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const generateFileName = (
  title: string,
  startTime: number,
  endTime: number
): string => {
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  const start = Math.floor(startTime);
  const end = Math.floor(endTime);
  return `${sanitizedTitle}_${start}s-${end}s.mp4`;
};

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

export const parseTimeString = (timeString: string): number => {
  const [minutes, seconds] = timeString.split(":").map(Number);
  const result = (minutes || 0) * 60 + (seconds || 0);
  return result;
};

export const generateVideoThumbnail = async (
  videoFile: File
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    video.addEventListener("loadedmetadata", () => {
      const aspectRatio = video.videoWidth / video.videoHeight;
      const thumbnailWidth = 320;
      const thumbnailHeight = thumbnailWidth / aspectRatio;

      canvas.width = thumbnailWidth;
      canvas.height = thumbnailHeight;

      video.currentTime = video.duration * 0.1;
    });

    video.addEventListener("seeked", () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const thumbnailUrl = URL.createObjectURL(blob);
              resolve(thumbnailUrl);
            } else {
              reject(new Error("Failed to generate thumbnail blob"));
            }
          },
          "image/jpeg",
          0.8
        );
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(video.src);
      }
    });

    video.addEventListener("error", () => {
      reject(new Error("Failed to load video for thumbnail generation"));
      URL.revokeObjectURL(video.src);
    });

    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};
