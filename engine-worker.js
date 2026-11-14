// Build ASM-JS de Stockfish 19 : pas de WebAssembly à télécharger.
// Cela évite l'échec "Aborted(Load failed)" rencontré sur Safari/iPad
// pendant le chargement du fichier .wasm. Le moteur fonctionne dans un Worker.
const ENGINE_URL = "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/stockfish-19-asm.js";

try {
  importScripts(ENGINE_URL);
} catch (error) {
  self.postMessage("ENGINE_FATAL " + (error && error.message ? error.message : String(error)));
}
