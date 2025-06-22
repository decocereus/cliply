# Video Clipper Web App

A free, modern video clipping web application built with Next.js that allows users to upload videos or provide YouTube URLs, set start/end times, and download clipped videos in the same quality as the original.

## ✨ Features

- **File Upload Support**: Upload video files up to 800MB and 2 minutes duration
- **YouTube Integration**: Paste YouTube URLs to clip videos directly
- **High-Quality Processing**: Maintains original video quality using FFmpeg.wasm
- **Supported Formats**: MP4, AVI, MOV, MKV
- **Client-Side Processing**: All video processing happens in your browser
- **Real-Time Progress**: Visual progress tracking during processing
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Free to Use**: No server costs, completely client-side

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd clipper
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🏗️ Project Structure

```
clipper/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── youtube/          # YouTube API routes
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── VideoClipper.tsx      # Main app component
│   │   ├── FileUploader.tsx      # Drag & drop uploader
│   │   ├── TimeControls.tsx      # Time input controls
│   │   └── ProgressBar.tsx       # Processing progress
│   ├── hooks/
│   │   ├── useFFmpeg.ts          # FFmpeg management
│   │   └── useVideoProcessor.ts  # Video processing logic
│   ├── lib/
│   │   ├── ffmpeg.ts             # FFmpeg utilities
│   │   ├── youtube.ts            # YouTube utilities
│   │   └── utils.ts              # General utilities
│   └── types/
│       └── index.ts              # TypeScript definitions
├── next.config.ts                # Next.js configuration
└── package.json
```

## 🎯 Usage

### File Upload Method

1. Click "Upload File" or drag and drop a video file
2. Supported formats: MP4, AVI, MOV, MKV (max 800MB, 2 minutes)
3. Set start and end times in MM:SS format
4. Click "Create Clip" to process
5. Download your clipped video

### YouTube Method

1. Click "YouTube URL"
2. Paste a YouTube video URL
3. Click "Load Video Info" to validate and load metadata
4. Set start and end times
5. Click "Create Clip" to process and download

### Time Format

- Use MM:SS format (e.g., 01:30 for 1 minute 30 seconds)
- Start time must be before end time
- End time cannot exceed video duration
- Minimum clip duration is 1 second

## 🛠️ Technical Details

### Video Processing

- **Client-Side**: All processing happens in the browser using FFmpeg.wasm
- **Quality Preservation**: Uses copy codec when possible to maintain quality
- **Memory Management**: Automatic cleanup of temporary files and URLs
- **Progress Tracking**: Real-time progress updates during processing

### YouTube Integration

- **Server-Side API**: Secure YouTube video information fetching
- **Duration Validation**: Automatic checking of 2-minute limit
- **Error Handling**: Comprehensive error messages for various scenarios
- **Streaming Downloads**: Efficient handling of YouTube video downloads

### Browser Compatibility

- Modern browsers with SharedArrayBuffer support
- Chrome, Firefox, Safari, Edge (latest versions)
- Requires Cross-Origin-Embedder-Policy headers for FFmpeg.wasm

## 🔧 Configuration

### Environment Variables

No environment variables required for basic functionality.

### Next.js Configuration

The app includes special headers for FFmpeg.wasm support:

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Cross-Origin-Embedder-Policy",
          value: "require-corp",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
      ],
    },
  ];
}
```

## 📦 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with default settings
4. The app will work completely free on Vercel's hobby plan

### Other Platforms

The app can be deployed on any platform that supports Next.js:

- Netlify
- Railway
- Render
- Self-hosted

## 🚨 Limitations

- **File Size**: Maximum 800MB per video
- **Duration**: Maximum 2 minutes per video
- **Browser Memory**: Large files may consume significant browser memory
- **YouTube**: Some videos may be restricted or unavailable

## 🐛 Troubleshooting

### Common Issues

1. **FFmpeg fails to load**

   - Ensure your browser supports SharedArrayBuffer
   - Check that CORS headers are properly configured

2. **YouTube video unavailable**

   - Video may be private, restricted, or deleted
   - Some regions may have access restrictions

3. **Processing fails**
   - Check file size and duration limits
   - Ensure sufficient browser memory available

### Browser Support

- ✅ Chrome 67+
- ✅ Firefox 79+
- ✅ Safari 15.2+
- ✅ Edge 79+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) for client-side video processing
- [ytdl-core](https://github.com/fent/node-ytdl-core) for YouTube integration
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

Made with ❤️ using Next.js, FFmpeg.wasm, and modern web technologies.
