// The public Worker deliberately uses Cloudflare types, not @types/node.
// This tiny local-only declaration covers the Node filesystem functions
// used by the optional Codexify audit adapter in the stdio MCP.
declare module "node:fs/promises" {
  export function lstat(path: string): Promise<{
    size: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }>;
  export function open(path: string, flags: string): Promise<{
    read(buffer: Uint8Array, offset: number, length: number,
      position: number): Promise<{ bytesRead: number }>;
    close(): Promise<void>;
  }>;
}
declare module "node:path" {
  export function isAbsolute(path: string): boolean;
}
