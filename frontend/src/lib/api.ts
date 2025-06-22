const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const apiUrls = {
  youtubeInfo: `${API_BASE_URL}/api/youtube/info`,
  youtubeDownload: `${API_BASE_URL}/api/youtube/download`,
  videoClip: `${API_BASE_URL}/api/video/clip`,
} as const;

export { API_BASE_URL };
