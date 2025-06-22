export interface VideoMetadata {
  duration: number;
  title?: string;
  format?: string;
  size?: number;
  url?: string;
}

export interface ClipParams {
  startTime: number;
  endTime: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  message: string;
  error?: string;
}

export interface VideoFile {
  file: File;
  url: string;
  metadata: VideoMetadata;
}

export interface YouTubeVideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  formats: Array<{
    quality: string;
    format: string;
    url: string;
  }>;
  warning?: string | null;
}

export interface DownloadState {
  url?: string;
  filename: string;
  size?: number;
  isReady: boolean;
}

export type InputMethod = "upload" | "youtube";

export interface TimeFormat {
  minutes: number;
  seconds: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
