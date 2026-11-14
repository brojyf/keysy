import { defineComponent } from 'sourcey';

type ThemedImageProps = { src: string; darkSrc: string; alt: string };

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Sourcey's Figure rasterizes its source; this keeps an SVG as is. Sourcey's theme script swaps each source's srcset. */
export const themedImage = defineComponent<ThemedImageProps, ThemedImageProps>({
  parseProps: ({ src, darkSrc, alt }) => {
    if (typeof src !== 'string' || typeof darkSrc !== 'string' || typeof alt !== 'string') {
      throw new Error('ThemedImage requires src, darkSrc, and alt');
    }
    return { src, darkSrc, alt };
  },
  resolve: ({ props }) => ({ content: [{ kind: 'markdown', value: `![${props.alt}](${props.src})` }], data: props }),
  renderHtml: ({ data }) => {
    const { src, darkSrc, alt } = data!;
    const themes = `data-light="${escapeAttribute(src)}" data-dark="${escapeAttribute(darkSrc)}"`;
    return `<picture data-sourcey-picture>`
      + `<source srcset="${escapeAttribute(darkSrc)}" ${themes} media="(prefers-color-scheme: dark)" />`
      + `<source srcset="${escapeAttribute(src)}" ${themes} />`
      + `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" />`
      + `</picture>`;
  },
});
