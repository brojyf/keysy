# Landing page v4 motion

Plays the two v4 effects that the [Figma design](../README.md) shows as still frames. It has only the
elements these effects need. The rest of the page lives in Figma.

| Effect | Figma | Components |
| --- | --- | --- |
| Dot background behind the hero and the call-to-action card; dots near the pointer turn blue and spring away | Hero and call-to-action card | [ReactBits](https://reactbits.dev) DotGrid |
| Hero story: the AI assistant moves the Stripe and Resend keys into `production/shared` | Hero story frame | ReactBits TextType and ShinyText, Motion |

## Run

```sh
bun install
bun run dev    # open /reactbits.html at the printed URL
bun test
bun run build
```

## Structure

- `src/content.ts`: copy for the hero web window, from the Figma design. Product data is illustrative.
- `src/shared/Product.tsx`: the web window.
- `src/pages/reactbits/`: the page and the hero story.
- `src/vendor/reactbits/`: component source copied unchanged from ReactBits, with its license.

ReactBits uses the MIT + Commons Clause license: its components may ship inside a site or
product but may not be sold or redistributed on their own.
