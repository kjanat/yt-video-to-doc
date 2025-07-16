# YouTube Video to Text Converter - Proof of Concept

Convert YouTube videos (especially presentations and slideshows) into structured text documents by extracting slides and running OCR on the visual content.

## 🚀 Features

- **YouTube Video Download**: Downloads videos using yt-dlp
- **Frame Extraction**: Extracts frames at configurable intervals
- **Slide Detection**: Automatically detects slide transitions
- **OCR Processing**: Extracts text from slides using Tesseract
- **Markdown Output**: Generates structured markdown documents
- **CLI Interface**: Easy-to-use command-line tool

## 📋 Prerequisites

### System Requirements

- Node.js 18+
- Python 3.8+ (for yt-dlp)
- FFmpeg
- Tesseract OCR

### Installation

1. **Install system dependencies:**

   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install ffmpeg tesseract-ocr python3-pip

   # macOS
   brew install ffmpeg tesseract python3

   # Windows
   # Download FFmpeg from https://ffmpeg.org/download.html
   # Download Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
   ```

2. **Install yt-dlp:**

   ```bash
   pip3 install yt-dlp
   ```

3. **Clone and setup the project:**

   ```bash
   git clone https://github.com/yourusername/yt-video-to-txt.git
   cd yt-video-to-txt
   ./setup.sh
   ```

   Or manually:

   ```bash
   npm install
   npm run build
   ```

## 🎯 Usage

### Basic Usage

Convert a YouTube video to text:

```bash
npm run dev convert https://www.youtube.com/watch?v=VIDEO_ID
```

### Advanced Options

```bash
npm run dev convert [url] [options]

Options:
  -i, --interval <seconds>   Frame extraction interval (default: 2)
  -f, --format <format>      Output format: markdown|txt|pdf (default: markdown)
  -l, --language <lang>      OCR language code (default: eng)
  -t, --threshold <value>    Slide detection threshold 0-1 (default: 0.3)
  -o, --output <dir>         Output directory (default: ./output)
  --temp <dir>               Temporary directory (default: ./temp)
```

### Examples

Extract frames every 5 seconds:

```bash
npm run dev convert https://youtube.com/watch?v=VIDEO_ID -i 5
```

Use German OCR:

```bash
npm run dev convert https://youtube.com/watch?v=VIDEO_ID -l deu
```

Higher slide detection sensitivity:

```bash
npm run dev convert https://youtube.com/watch?v=VIDEO_ID -t 0.2
```

### Test with Sample Video

```bash
npm run dev test
```

### Clean Temporary Files

```bash
npm run dev clean
```

## 📁 Project Structure

```
yt-video-to-txt/
├── src/
│   ├── core/
│   │   └── video-processor.ts    # Main processing orchestrator
│   ├── services/
│   │   ├── youtube-downloader.ts # Video download service
│   │   ├── frame-extractor.ts    # Frame extraction using FFmpeg
│   │   ├── slide-detector.ts     # Slide transition detection
│   │   ├── ocr-service.ts        # OCR text extraction
│   │   └── document-generator.ts # Document generation
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── config/
│   │   └── defaults.ts           # Default configuration
│   ├── utils/
│   │   └── logger.ts             # Winston logger setup
│   └── cli.ts                    # CLI interface
├── temp/                         # Temporary files (git-ignored)
├── output/                       # Generated documents
├── logs/                         # Application logs
└── plan.md                       # Full architecture design
```

## 🔧 Configuration

Default settings in `src/config/defaults.ts`:

- **Frame Interval**: 2 seconds
- **OCR Language**: English
- **Output Format**: Markdown
- **Slide Detection Threshold**: 0.3 (30% difference)
- **Max Video Duration**: 10 minutes (PoC limit)

## 📝 Output Format

The generated markdown includes:

- Video metadata (title, duration, source)
- Table of contents (for videos with >3 slides)
- Extracted slide content with timestamps
- OCR-extracted text from each slide

Example output structure:

```markdown
# Video Title

---

**Source:** https://youtube.com/watch?v=...
**Duration:** 5m 23s
**Generated:** 2024-01-15T10:30:00Z

---

## Table of Contents

- [Slide 1](#slide-1)
- [Slide 2](#slide-2)

## Slide 1

**Time:** 0:00 - 0:15

### Content

Introduction to Machine Learning

- What is ML?
- Types of algorithms

> Frame: 1 at 0:00

---
```

## 🚧 Limitations (Proof of Concept)

- Maximum video duration: 10 minutes
- Only supports YouTube videos
- Basic slide detection (may miss subtle transitions)
- OCR accuracy depends on slide quality
- No audio transcription (slides only)
- Markdown output only

## 🛠️ Development

### Run in Development Mode

```bash
npm run dev -- convert https://youtube.com/watch?v=VIDEO_ID
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Lint & Type Check

```bash
npm run lint
npm run typecheck
```

## 🔮 Future Enhancements

See `plan.md` for the full architecture design including:

- Audio transcription with speech-to-text
- Multiple export formats (PDF, DOCX, HTML)
- Web interface and API
- Distributed processing for longer videos
- Advanced slide detection algorithms
- Multi-language support
- Cloud deployment

## 🤝 Contributing

This is a proof of concept. For the full production system, please refer to the architecture design in `plan.md`.

## 📄 License

MIT

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for video downloading
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) for text extraction
- [FFmpeg](https://ffmpeg.org/) for video processing
