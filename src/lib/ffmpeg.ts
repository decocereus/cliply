import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }
  ffmpeg = new FFmpeg();
  await ffmpeg.load();
  return ffmpeg;
};

export const clipVideo = async (
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const ffmpeg = await getFFmpeg();
  try {
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp4");
  } catch {
    // Files don't exist, which is fine
  }

  await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  const ffmpegArgs = [
    "-i",
    "input.mp4",
    "-filter_complex",
    `[0:v]trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS[v];[0:a]atrim=start=${startTime}:end=${endTime},asetpts=PTS-STARTPTS[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    "output.mp4",
  ];

  await ffmpeg.exec(ffmpegArgs);

  const data = await ffmpeg.readFile("output.mp4");
  const videoBlob = new Blob([new Uint8Array(data as unknown as ArrayBuffer)], {
    type: "video/mp4",
  });

  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  return videoBlob;
};

export const getVideoMetadata = async (
  videoFile: File
): Promise<{
  duration: number;
  format: string;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        format: videoFile.type,
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
