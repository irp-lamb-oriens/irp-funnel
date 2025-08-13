# MP4 Buffer Loader

This project demonstrates two advanced strategies for loading MP4 video files in a web browser using modern JavaScript APIs: **Prefetch-to-Blob** and **Media Source Extensions (MSE)**. The goal is to provide a reliable, production-ready implementation that optimizes for fast, efficient, and robust video playback.

## Features

- **Multiple Loading Strategies**:
  - **Blob**: Fetches the entire video into memory as a `Blob` and plays it back via an `ObjectURL`. Best for smaller files and simpler implementation.
  - **MSE (Media Source Extensions)**: Streams the video, appending chunks to a `SourceBuffer`. Ideal for larger files and faster start times, as it doesn't require the entire file to be downloaded first.
  - **Auto**: Automatically selects the best strategy based on browser support and codec availability.
- **Graceful Fallbacks**: If MSE is not supported, it falls back to the Blob strategy. If neither is viable, it falls back to a direct `src` assignment.
- **Abortable Fetch**: In-flight `fetch` requests can be canceled using an `AbortController`.
- **Lazy Loading**: The video will only be loaded when it enters the viewport.
- **Montage Preview**: An initial muted preview of the video is shown, and the full video with sound is played only after user interaction.

## How to Use

The video loading logic is encapsulated in the `src/components/Video` directory. The main component is `Video.svelte`, which can be used in any Svelte application.

### Props

- `src` (string | null): The URL of the video to load.
- `poster` (string): The URL of a poster image to display before the video loads.
- `lazy` (boolean): Whether to enable lazy loading. Defaults to `true`.
- `spinnerDelay` (number): The delay in milliseconds before showing the loading spinner. Defaults to `150`.

### Example

```svelte
<script>
  import Video from './src/components/Video/Video.svelte';
</script>

<Video src="https://example.com/my-video.mp4" />
```

## Technical Details

### Server Requirements

For the loading strategies to work correctly, the server hosting the video files must be properly configured:

- **CORS**: The server must include the `Access-Control-Allow-Origin` header in its responses (e.g., `Access-Control-Allow-Origin: *`).
- **Content-Type**: The `Content-Type` header must be set to `video/mp4`.
- **Accept-Ranges**: For seeking to work correctly (especially with MSE), the server should support range requests and include the `Accept-Ranges: bytes` header.

### Browser Support

This implementation is designed to work on the latest versions of modern browsers:

- **Chrome**: Fully supported.
- **Firefox**: Fully supported.
- **Safari (macOS and iOS)**: Fully supported. Note that `playsinline` and `muted` are crucial for any form of autoplay on iOS.
- **Edge**: Fully supported.

### Future Extensions

- **WebCodecs**: For even more control over video playback, the WebCodecs API could be integrated. This would allow for decoding individual frames and could be useful for advanced applications like custom video editors or players.
