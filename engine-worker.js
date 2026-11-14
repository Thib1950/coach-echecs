// Stockfish 19 Lite single-threaded : worker compatible Safari iOS.
self.Module = {
  locateFile: function(path) {
    return "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/" + path;
  },
  print: function(line) { self.postMessage(String(line)); },
  printErr: function(line) { self.postMessage("ENGINE_ERROR " + String(line)); },
  onAbort: function(reason) { self.postMessage("ENGINE_ABORT " + String(reason)); }
};
try {
  importScripts("https://cdn.jsdelivr.net/npm/stockfish@19.0.1/stockfish-19-lite-single.js");
} catch (error) {
  self.postMessage("ENGINE_FATAL " + (error && error.message ? error.message : String(error)));
}
