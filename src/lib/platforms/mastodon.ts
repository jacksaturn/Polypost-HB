import type { PlatformSpec } from './types';

export const mastodonSpec: PlatformSpec = {
  id: 'mastodon',
  label: 'High Bias',
  brandColor: '#6364ff',
  // 500 is the default; individual instances can raise or lower it.
  charLimit: 500,
  warningThreshold: 465,
  // Code points with links counted as a flat 23 (Mastodon's rule).
  counting: 'mastodon',
  // Vanilla Mastodon posts are plain text — no Markdown or styled-Unicode rendering.
  allowUnicodeStyling: false,
  truncation: null,
  truncationLabel: '',
  capabilities: {
    copy: true,
    imageAttachments: true,
    openComposer: {
      url: (text) => `https://highbias.org/share?text=${encodeURIComponent(text)}`,
      prefillsText: true,
    },
  },
  warnings: [],
  // Mastodon renders a compact card: small thumbnail on the left, title,
  // description, and domain on the right.
  linkPreview: { layout: 'thumbnail', showDescription: true },
  disclaimer: 'Links count as 23 characters. 500 is the default limit and can vary by instance.',
};
