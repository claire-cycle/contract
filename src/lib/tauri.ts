// ---------------------------------------------------------------------------
// Tauri API Wrapper
// Provides unified clipboard/file APIs for both Tauri and browser environments
// ---------------------------------------------------------------------------

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function writeClipboard(text: string): Promise<void> {
  if (isTauri()) {
    try {
      // @ts-ignore - Tauri plugin loaded at runtime
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return;
    } catch {
      // fallback to browser API
    }
  }
  await navigator.clipboard.writeText(text);
}

export async function openFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (isTauri()) {
    try {
      // @ts-ignore - Tauri plugin loaded at runtime
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ filters, multiple: false });
      if (result && typeof result === "string") {
        // @ts-ignore - Tauri plugin loaded at runtime
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(result);
        return new TextDecoder().decode(bytes);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Browser fallback: hidden file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = filters?.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",") || "";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const text = await file.text();
        resolve(text);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function saveFile(content: string, name: string): Promise<void> {
  if (isTauri()) {
    try {
      // @ts-ignore - Tauri plugin loaded at runtime
      const { save } = await import("@tauri-apps/plugin-dialog");
      // @ts-ignore - Tauri plugin loaded at runtime
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: name });
      if (path) {
        const encoder = new TextEncoder();
        await writeFile(path, encoder.encode(content));
      }
      return;
    } catch {
      // fallback to browser
    }
  }

  // Browser fallback: Blob download
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
