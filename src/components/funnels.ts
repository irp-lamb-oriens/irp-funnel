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
      ## **I’ll show you how you can successfully** relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.**
    `
    },

    /* —–– authentic hooks start here —–– */

    "b": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## Fourteen years ago I googled “how to move to Costa Rica” and realised the real answers weren’t online. If you’re at that search-bar moment, let’s compare notes.
    `
    },

    "c": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## Relocation isn’t the last stamp in your passport; it’s the 2 a.m. doubt about what actually fits in the suitcase. We start with that doubt—before you land.
    `
    },

    "d": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## Any service that reduces a move to Costa Rica to one form worries me. We begin by listening, not by ticking boxes.
    `
    },

    "e": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## Picking a beach town is easy; deciding what—and who—you leave behind is harder. We map that part first.
    `
    },

    "f": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## Picture your Costa Rica move laid out on a clear timeline before we even ask for your email.
    `
    },

    "g": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## We can’t erase every piece of paperwork, but we can make sure you never navigate it blind.
    `
    }
  },
  "general": {
    "a": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## **I’ll show you how you can successfully** relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.**
    `
    },

    /* —–– authentic hooks start here —–– */

    "b": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## Fourteen years ago I googled “how to move to Costa Rica” and realised the real answers weren’t online. If you’re at that search-bar moment, let’s compare notes.
    `
    },

    "c": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## Relocation isn’t the last stamp in your passport; it’s the 2 a.m. doubt about what actually fits in the suitcase. We start with that doubt—before you land.
    `
    },

    "d": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## Any service that reduces a move to Costa Rica to one form worries me. We begin by listening, not by ticking boxes.
    `
    },

    "e": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## Picking a beach town is easy; deciding what—and who—you leave behind is harder. We map that part first.
    `
    },

    "f": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## Picture your Costa Rica move laid out on a clear timeline before we even ask for your email.
    `
    },

    "g": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## We can’t erase every piece of paperwork, but we can make sure you never navigate it blind.
    `
    }
  }
  // Add more funnel objects here as needed
};

export default funnels;
