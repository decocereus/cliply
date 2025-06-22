import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { isValidYouTubeUrl, extractVideoId } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const { url, quality } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract video ID from URL" },
        { status: 400 }
      );
    }

    // For Shorts URLs, convert to regular watch URL format
    const normalizedUrl = url.includes("/shorts/")
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;

    // Validate URL
    const isValid = await ytdl.validateURL(normalizedUrl);
    if (!isValid) {
      return NextResponse.json(
        { error: "Video is not available" },
        { status: 400 }
      );
    }

    // Get video info to get title for filename
    const info = await ytdl.getInfo(normalizedUrl);
    const videoDetails = info.videoDetails;

    // Check duration (max 15 minutes = 900 seconds)
    const duration = parseInt(videoDetails.lengthSeconds);
    if (duration > 900) {
      return NextResponse.json(
        { error: "Video duration exceeds 15 minutes limit" },
        { status: 400 }
      );
    }

    // Get the best format based on quality preference
    let format;
    if (quality) {
      format = ytdl.chooseFormat(info.formats, {
        quality: quality,
        filter: "videoandaudio",
      });
    } else {
      format = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: "videoandaudio",
      });
    }

    if (!format) {
      return NextResponse.json(
        { error: "No suitable video format found" },
        { status: 400 }
      );
    }

    // Create a readable stream
    const videoStream = ytdl(normalizedUrl, { format });

    // Set up response headers for file download
    const filename = `${videoDetails.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")}.mp4`;

    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    });

    // If content length is available, set it
    if (format.contentLength) {
      headers.set("Content-Length", format.contentLength);
    }

    // Create a ReadableStream from the ytdl stream
    const readableStream = new ReadableStream({
      start(controller) {
        videoStream.on("data", (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        videoStream.on("end", () => {
          controller.close();
        });

        videoStream.on("error", (error) => {
          console.error("Stream error:", error);
          controller.error(error);
        });
      },
      cancel() {
        videoStream.destroy();
      },
    });

    return new NextResponse(readableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("YouTube download error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Could not extract functions")) {
        return NextResponse.json(
          {
            error:
              "Unable to process this YouTube video. This may be due to YouTube's recent changes or regional restrictions. Please try a different video.",
          },
          { status: 400 }
        );
      }
      if (error.message.includes("Video unavailable")) {
        return NextResponse.json(
          { error: "Video is unavailable or restricted" },
          { status: 400 }
        );
      }
      if (error.message.includes("private")) {
        return NextResponse.json(
          { error: "Video is private" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    );
  }
}
