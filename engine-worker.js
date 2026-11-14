// Stockfish 19 Lite single-threaded. Les fichiers du paquet npm sont dans /bin/.
const ENGINE_BASE = "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/";
self.Module = {
  locateFile: function(path) { return ENGINE_BASE + path; },
  print: function(line) { self.postMessage(String(line)); },
  printErr: function(line) { self.postMessage("ENGINE_ERROR " + String(line)); },
  onAbort: function(reason) { self.postMessage("ENGINE_ABORT " + String(reason)); }
};
try {
  importScripts(ENGINE_BASE + "stockfish-19-lite-single.js");
} catch (error) {
  self.postMessage("ENGINE_FATAL " + (error && error.message ? error.message : String(error)));
}
