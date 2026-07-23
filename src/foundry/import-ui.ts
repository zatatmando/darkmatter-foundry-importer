import { importCharacterPdfFiles, type ImportCharacterPdfResult } from "./import-character.js";

const MODULE_ID = "darkmatter-foundry-importer";

type DialogButton = {
  form?: HTMLFormElement;
};

type DialogV2Api = {
  prompt(config: {
    window: { title: string };
    content: string;
    ok: {
      label: string;
      icon: string;
      callback: (event: Event, button: DialogButton) => File[] | null;
    };
    rejectClose: false;
    modal: true;
  }): Promise<unknown>;
};

function notify(level: "info" | "warn" | "error", message: string): void {
  ui.notifications?.[level]?.(message);
}

function getDialogV2(): DialogV2Api {
  const dialog = foundry.applications?.api?.DialogV2;
  if (!dialog) throw new Error("Foundry DialogV2 API is not available.");
  return dialog;
}

function getSelectedPdfs(button: DialogButton): File[] {
  const input = button.form?.elements.namedItem("pdf");
  if (!(input instanceof HTMLInputElement)) return [];

  return Array.from(input.files ?? []);
}

async function promptForPdfFiles(): Promise<File[]> {
  const result = await getDialogV2().prompt({
    window: { title: "Import Dark Matter Character" },
    content: `
      <div class="form-group">
        <label>Character PDFs</label>
        <input type="file" name="pdf" accept="application/pdf,.pdf" multiple autofocus>
      </div>
    `,
    ok: {
      label: "Import",
      icon: "fa-solid fa-file-import",
      callback: (_event, button) => {
        const files = getSelectedPdfs(button);
        return files.length > 0 ? files : null;
      }
    },
    rejectClose: false,
    modal: true
  });

  return Array.isArray(result) && result.every((entry) => entry instanceof File) ? result : [];
}

export async function openCharacterImporter(): Promise<ImportCharacterPdfResult[]> {
  const files = await promptForPdfFiles();
  if (files.length === 0) return [];

  try {
    notify("info", `Importing ${files.length} Dark Matter character PDF${files.length === 1 ? "" : "s"}...`);
    const results = await importCharacterPdfFiles(files);
    notify("info", `Imported ${results.length} Dark Matter character${results.length === 1 ? "" : "s"}.`);
    return results;
  } catch (error) {
    console.error("Dark Matter Foundry Importer | Import failed", error);
    notify("error", error instanceof Error ? error.message : "Dark Matter import failed.");
    return [];
  }
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function renderedRoot(html: unknown): HTMLElement | null {
  if (isHTMLElement(html)) return html;

  const maybeElement = (html as { element?: unknown } | null)?.element;
  if (isHTMLElement(maybeElement)) return maybeElement;

  const maybeArrayElement = (html as { 0?: unknown } | null)?.[0];
  if (isHTMLElement(maybeArrayElement)) return maybeArrayElement;

  return null;
}

function addActorDirectoryButton(_app: unknown, html: unknown): void {
  if (game.user && !game.user.isGM) return;

  const root = renderedRoot(html);
  if (!root || root.querySelector("[data-dmfi-import]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.dmfiImport = "true";
  button.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Dark Matter PDF';
  button.addEventListener("click", () => {
    void openCharacterImporter();
  });

  const container =
    root.querySelector(".directory-footer") ??
    root.querySelector("footer") ??
    root.querySelector(".directory-list")?.parentElement ??
    root;

  container.append(button);
}

function exposeApi(): void {
  const module = game.modules?.get(MODULE_ID);
  if (module) {
    module.api = {
      openCharacterImporter
    };
  }
}

export function registerImporterUi(): void {
  exposeApi();
  Hooks.on("renderActorDirectory", addActorDirectoryButton);
}
