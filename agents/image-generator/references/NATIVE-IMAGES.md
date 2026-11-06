# Native image production

Default: built-in Codex image generation, currently exposed as `image_gen__imagegen` through functions tooling. Check available tools and the live schema each session. The installed system [imagegen skill](C:/Users/Cha%20Yang/.codex/skills/.system/imagegen/SKILL.md) is the supporting execution reference; tool instructions take precedence when signatures change. Built-in mode does not need a separately configured Gemini/OpenAI API key. No paid API script is bundled here.

## Input and call discipline

1. Open local product and chosen layout images with the image-viewing tool. Avoid loading all 50 references; choose from the index first.
2. When all reference inputs have local paths, use the current tool's referenced-image-path mechanism. When inputs are only conversation images, use its recent-image mechanism with the smallest sufficient count. Never mix the two mechanisms in one call. If the live tool cannot include every required input, recover the missing file or ask once for the missing attachment.
3. Name input roles in the prompt: exact product truth, layout inspiration and optional palette. Require the actual item; structural inspiration does not transfer the example's factual claims.
4. A new image with no reference inputs omits image-reference parameters. A batch uses one explicit brief per requested asset/variant, not an accidental collage. Use the current tool's documented wait/result-display pattern and keep the user informed during long generations.
5. Image edits, crops, resizing and generated-image corrections use the built-in image tool unless the user explicitly requests another method. Filesystem utilities may copy outputs and inspect dimensions; they do not silently alter pixels.

## Prompt packet

```text
Job / asset ID:
Use: Shopify gallery / benefit section / Meta static / other
Exact product and variant:
Input roles: product photo ... ; layout reference ...
Buyer situation / country / angle:
Supported feature or claim + source ID:
Composition / framing / negative space:
Visual style / palette / lighting:
Text verbatim and placement, or no text:
Must preserve: shape, dimensions/proportions, label, colors, functional details
Requested pixel dimensions / aspect ratio:
Change for this revision only:
```

Use only applicable fields. Text should be concise enough to read at the intended placement size. Do not bake long product descriptions into images that the page builder can render as live text.

## Review before marking usable

Check the returned image itself, not only the prompt or tool success message:

- Product identity: exact variant, geometry, label text, attachments, quantity and function.
- Message: supported statements, real quote/offer if included, correct country and spelling.
- Presentation: legibility, composition, product visibility, artifacts and sensible crop at the intended size.
- File: actual measured width/height, format and transparency if requested. Explicit dimensions override inferred defaults. A size mismatch remains unresolved until corrected or the owner accepts a different size.
- Handoff: local file exists, version does not overwrite accepted work, and manifest points to the real file. Shopify URLs are recorded only after upload.

Use statuses `draft`, `needs-fix`, `QC-pass`, `owner-selected`, `uploaded` and `experiment-linked` as separate milestones. QC-pass means reviewed for the intended use, not independently verified conversion performance. If automated size checking is unavailable, record dimensions unverified rather than guessing.
