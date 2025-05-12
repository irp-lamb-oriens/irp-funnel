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
        ## I’ll show you how you can successfully relocate to Costa Rica** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
      `
    },

    /* —–– pain-point hooks start here —–– */

    "b": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## **No hidden fees,** **full cost breakdown** so you avoid **surprise charges**—**we lay it all bare** before you pack.
      `
    },

    "f": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## **Fuel prices** and **customs hold-ups** can **send your costs soaring**—**we lock in your rate** and **take care of all the paperwork**.
      `
    },

    "g": {
      country: "Costa Rica",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/1e11b4c27969ea032f97979415965c4a/manifest/video.m3u8",
      copy: `
      ## **Delivery delays** and **damaged goods** are all too common—**we track in real-time** and **resolve issues** before they arrive.
      `
    }
  },

  "general": {
    "a": {
      country: "",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
        ## I’ll show you how you can successfully relocate ** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
      `
    },

    /* —–– pain-point hooks start here —–– */

    "b": {
      country: "",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## **No hidden fees,** **full cost breakdown** so you avoid **surprise charges**—**we lay it all bare** before you pack.
      `
    },

    "f": {
      country: "",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## **Fuel prices** and **customs hold-ups** can **send your costs soaring**—**we lock in your rate** and **take care of all the paperwork**.
      `
    },

    "g": {
      country: "",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/d3412a106068b592a8622b2556d1ff51/manifest/video.m3u8",
      copy: `
      ## **Delivery delays** and **damaged goods** are all too common—**we track in real-time** and **resolve issues** before they arrive.
      `
    }
  },

  "mexico": {
    "a": {
      country: "Mexico",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/18d3c4d86d275c76b3f60626279dd5a4/manifest/video.m3u8",
      copy: `
        ## I’ll show you how you can successfully relocate to Mexico** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
      `
    },

    /* —–– pain-point hooks start here —–– */

    "b": {
      country: "México",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/18d3c4d86d275c76b3f60626279dd5a4/manifest/video.m3u8",
      copy: `
      ## **No hidden fees,** **full cost breakdown** so you avoid **surprise charges**—**we lay it all bare** before you pack.
      `
    },

    "f": {
      country: "México",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/18d3c4d86d275c76b3f60626279dd5a4/manifest/video.m3u8",
      copy: `
      ## **Fuel prices** and **customs hold-ups** can **send your costs soaring**—**we lock in your rate** and **take care of all the paperwork**.
      `
    },

    "g": {
      country: "México",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/18d3c4d86d275c76b3f60626279dd5a4/manifest/video.m3u8",
      copy: `
      ## **Delivery delays** and **damaged goods** are all too common—**we track in real-time** and **resolve issues** before they arrive.
      `
    }
  },

  "panama": {
    "a": {
      country: "Panama",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/32c7393cede3cc5288ecce0c22b65248/manifest/video.m3u8",
      copy: `
        ## I’ll show you how you can successfully relocate to Panama** without the **stress of bureaucracy,** the **overwhelm of logistics,** or the **risk of making costly mistakes.
      `
    },

    /* —–– pain-point hooks start here —–– */

    "b": {
      country: "Panamá",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/32c7393cede3cc5288ecce0c22b65248/manifest/video.m3u8",
      copy: `
      ## **No hidden fees,** **full cost breakdown** so you avoid **surprise charges**—**we lay it all bare** before you pack.
      `
    },

    "f": {
      country: "Panamá",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/32c7393cede3cc5288ecce0c22b65248/manifest/video.m3u8",
      copy: `
      ## **Fuel prices** and **customs hold-ups** can **send your costs soaring**—**we lock in your rate** and **take care of all the paperwork**.
      `
    },

    "g": {
      country: "Panamá",
      videoSrc: "https://customer-ygvpdn9is2a2i5fz.cloudflarestream.com/32c7393cede3cc5288ecce0c22b65248/manifest/video.m3u8",
      copy: `
      ## **Delivery delays** and **damaged goods** are all too common—**we track in real-time** and **resolve issues** before they arrive.
      `
    }
  }
};

export default funnels;
