export interface ControlBarProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onUploadClick: () => void;
  onYoutubeSubmit: (url: string) => void;
  onClip: () => void;
  onReset: () => void;
  onDownload: () => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  timeErrors: { start?: string; end?: string };
  clipDuration: string;
  isValidToClip: boolean;
  hasVideo: boolean;
  hasClip: boolean;
  processingState: ProcessingState;
  isLoadingYoutube: boolean;
  youtubeError: string | null;
  uploadLoadingState?: { isLoading: boolean; stage: string; message?: string };
}

export interface VideoDisplayProps {
  video: {
    url: string;
    title: string;
    duration: number;
  };
  inputMethod: "upload" | "youtube";
  videoFile?: { file: File; thumbnailUrl?: string } | null;
  youtubeInfo?: { warning?: string | null } | null;
}

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
  stage?: "loading" | "downloading" | "processing" | "finalizing" | "complete";
}

export interface LoadingState {
  isLoading: boolean;
  stage:
    | "idle"
    | "validating"
    | "reading_metadata"
    | "creating_thumbnail"
    | "ready";
  message?: string;
}

export interface VideoFile {
  file: File;
  url: string;
  thumbnailUrl?: string;
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
