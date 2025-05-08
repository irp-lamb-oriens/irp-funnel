export type Funnel = {
  country: string;
  videoSrc: string;
  copy: string;
};

const funnels: Record<string, Record<string, Funnel>> = {
  "costa-rica": {
    "a": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
        ## **I’ll show you how you can successfully** relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
      `
    }
  }
  // Add more funnel objects here as needed
};

export default funnels;
