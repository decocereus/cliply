# Clipper - Video Clipping Application

A full-stack video clipping application with YouTube integration, featuring a Next.js frontend and Express.js backend.

## Project Structure

```
clipper/
├── frontend/          # Next.js React application
│   ├── src/
│   │   ├── app/       # Next.js app router
│   │   ├── components/ # React components
│   │   ├── contexts/  # React contexts
│   │   ├── lib/       # Utility functions
│   │   └── types/     # TypeScript type definitions
│   └── package.json
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── routes/    # API route handlers
│   │   └── utils/     # Utility functions
│   └── package.json
└── package.json       # Root package.json for managing both apps
```

## Features

- **Video Upload & Clipping**: Upload videos and clip specific segments
- **YouTube Integration**: Download and clip YouTube videos directly
- **Real-time Processing**: Progress tracking during video processing
- **Modern UI**: Responsive design with dark/light theme support
- **FFmpeg Processing**: Server-side video processing with FFmpeg
- **File Download**: Direct download of processed clips

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **FFmpeg** (for video processing)
- **yt-dlp** (for YouTube video downloading)

### Installing FFmpeg

#### macOS (using Homebrew)

```bash
brew install ffmpeg
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows

Download from [FFmpeg official website](https://ffmpeg.org/download.html) and add to PATH.

### Installing yt-dlp

#### macOS (using Homebrew)

```bash
brew install yt-dlp
```

#### Ubuntu/Debian

```bash
sudo apt install yt-dlp
```

#### Windows/Others

```bash
pip install yt-dlp
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd clipper
```

### 2. Install Dependencies

```bash
npm run install:all
```

This will install dependencies for the root project, frontend, and backend.

### 3. Environment Configuration

#### Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Backend Environment

Create `backend/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Development Setup

#### Run Both Frontend and Backend

```bash
npm run dev
```

This will start both the frontend (on port 3000) and backend (on port 3001) concurrently.

#### Run Individually

**Frontend only:**

```bash
npm run dev:frontend
```

**Backend only:**

```bash
npm run dev:backend
```

## Production Build

### Build Both Applications

```bash
npm run build
```

### Start Production Servers

```bash
npm run start
```

## API Endpoints

The backend provides the following API endpoints:

### YouTube Routes

- `POST /api/youtube/info` - Get YouTube video information
- `POST /api/youtube/download` - Download YouTube video

### Video Processing Routes

- `POST /api/video/clip` - Process and clip video segments

## Usage

1. **Upload a Video**: Click the upload button and select a video file
2. **Or Use YouTube**: Enter a YouTube URL to import a video
3. **Set Clip Times**: Use the time controls to set start and end times
4. **Process Clip**: Click the clip button to process your video segment
5. **Download**: Download the processed clip when ready

## Technology Stack

### Frontend

- **Next.js 15** - React framework with app router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - UI components
- **Sonner** - Toast notifications
- **FFmpeg.wasm** - Client-side video processing

### Backend

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Multer** - File upload handling
- **FFmpeg** - Video processing
- **yt-dlp** - YouTube video downloading
- **@distube/ytdl-core** - YouTube video information

## Development

### Frontend Development

The frontend is a Next.js application with:

- Modern React patterns (hooks, context, etc.)
- TypeScript for type safety
- Responsive design with Tailwind CSS
- Dark/light theme support

### Backend Development

The backend is an Express.js API server with:

- RESTful API design
- TypeScript for type safety
- File upload and processing capabilities
- FFmpeg integration for video processing

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure FFmpeg is installed and available in PATH
2. **yt-dlp not found**: Ensure yt-dlp is installed and available in PATH
3. **Port conflicts**: Change ports in environment files if needed
4. **CORS issues**: Ensure frontend URL is properly configured in backend environment

### Logs

Check console logs in both frontend and backend terminals for debugging information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]
