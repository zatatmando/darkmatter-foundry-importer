import { registerImporterUi } from "./import-ui.js";

Hooks.once("init", () => {
  console.log("Dark Matter Foundry Importer | Initializing");
  registerImporterUi();
});
