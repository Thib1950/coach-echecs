// Charge Stockfish 19 Lite en mode mono-thread (compatible Safari/iPad).
// Le moteur et son fichier WASM sont résolus explicitement sur le CDN.
const ENGINE_BASE = "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/";
const ENGINE_SCRIPT = new URL("stockfish-19-lite-single.js", ENGINE_BASE).href;

self.Module = {
  locateFile(path) {
    // Emscripten peut fournir un nom simple ou un chemin relatif.
    const file = String(path).split(/[\\/]/).pop();
    return new URL(file, ENGINE_BASE).href;
  },
  print(line) {
    self.postMessage(String(line));
  },
  // stderr peut contenir des avertissements non fatals : ne pas les
  // confondre avec un échec du chargement du moteur.
  printErr(line) {
    self.postMessage("ENGINE_LOG " + String(line));
  },
  onAbort(reason) {
    self.postMessage("ENGINE_FATAL " + String(reason || "Stockfish a interrompu son initialisation."));
  },
  onRuntimeInitialized() {
    self.postMessage("ENGINE_RUNTIME_READY");
  }
};

try {
  importScripts(ENGINE_SCRIPT);
} catch (error) {
  self.postMessage("ENGINE_FATAL " + (error && error.message ? error.message : String(error)));
}
