# GodPrompt v1.3.0 final Docker/GHCR readiness

Date: November 20, 2026. This is the LAST distribution milestone, after P4 and the combined OpenAI Skill+MCP preview.

## Audited source and completed tests

- Image: `ghcr.io/akzar1el/god-prompt-mcp`, runtime `node dist/stdio.js` over stdin/stdout with no allocated pseudo-TTY.
- Dockerfile: multi-stage `node:22.23.4-bookworm-slim`; `npm ci --ignore-scripts`; dev dependencies pruned; only built package, lock, node_modules and dist copied into the runtime layer.
- Runtime uses `USER 10001:10001`; `HOME=/home/godprompt`; no exposed network port, API key, telemetry service or writable host bind mount required. No live trading, unrelated services or Codexify processes affected.
- GitHub [container CI on P4 main release](https://github.com/AKzar1el/god-prompt-mcp/actions/runs/44830713984) passed, including real container execution that checked UID 10001 and the exact 22 public stdio tool names.
- Separate [v1.3.0 release](https://github.com/AKzar1el/god-prompt-mcp/releases/tag/v1.3.0), npm trusted publication and MCP Registry release passed.
- The base-image version is pinned by tag, not by immutable digest. The workflow rebuilds with `--pull`; do not claim byte-for-byte reproducibility or an independent vulnerability scan beyond the completed checks.

## Manual-only GHCR publication gate — not yet executed by this task

The existing [Publish stdio container workflow](https://github.com/AKzar1el/god-prompt-mcp/actions/workflows/publish-container.yml) explicitly publishes **only** when triggered with `workflow_dispatch`. PR and push jobs validate Docker builds and smoke tests but deliberately never push new image tags. Preserve this safeguard.

When the operator chooses to publish: open the linked workflow, select **Run workflow**, select **main**, run it once, and inspect that run's result. On success it pushes `:latest`, `:sha-<commit12>`, and the immutable `:1.3.0` tag if that version tag was previously absent. It never overwrites an existing version tag.

After publication, confirm the GHCR package lists `1.3.0`, verify the image's source/version/revision labels, ensure `docker run --rm --entrypoint id ... -u` prints `10001`, and repeat the MCP initialize/list/call check on that published version. Only then change README's old pinned `:1.1.1` example to `:1.3.0`.

**Current status:** Source and container integration are green. A publish dispatch or a GHCR `:1.3.0` registry tag has not been verified here. Do not claim the Docker distribution was published by this work.

## Rollback and boundaries

Retain the previous verified container version. Never retag its immutable version. If a newly dispatched publish or image smoke fails, do not update the README pin or restart any active service; investigate the exact CI log and rerun only after correction. Hosted Worker/npm/Registry and the OpenAI directory are independent of this Docker publication.

The new combined OpenAI Plugin Directory listing remains unpublished; its code and review ZIP exist separately.
