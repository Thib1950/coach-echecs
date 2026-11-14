// Worker local : charge la version légère mono-thread de Stockfish 19 depuis jsDelivr.
self.Module = { locateFile: path => "https://cdn.jsdelivr.net/npm/stockfish@19.0.1/" + path };
importScripts("https://cdn.jsdelivr.net/npm/stockfish@19.0.1/stockfish-19-lite-single.js");
