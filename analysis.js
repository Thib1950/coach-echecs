import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const $ = id => document.getElementById(id);
let worker = null, engineReady = null, busy = false;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const user = "gone_1950";


function getEngine(){
  if(engineReady)return engineReady;
  engineReady=new Promise((resolve,reject)=>{
    let stage="téléchargement des fichiers Stockfish 19 Lite";
    let settled=false;
    const timer=setTimeout(()=>{
      if(worker){try{worker.terminate();}catch{} worker=null;}
      settled=true;
      reject(new Error("Délai dépassé pendant le "+stage+". Le moteur n'a pas pu être initialisé."));
    },90000);
    const fail=error=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      reject(error instanceof Error?error:new Error(String(error)));
    };
    (async()=>{
      // Précharge explicitement le JS et le WASM via le service worker.
      // Les deux ressources sont ensuite disponibles sous la même origine.
      for(const file of ["stockfish-19-lite-single.js","stockfish-19-lite-single.wasm"]){
        const response=await fetch("./vendor/stockfish/"+file+"?build=25",{cache:"no-store"});
        if(!response.ok){
          const detail=(await response.text()).slice(0,240);
          throw new Error("Téléchargement de "+file+" impossible (HTTP "+response.status+"). "+detail);
        }
      }
      if(settled)return;
      stage="démarrage du Worker WebAssembly";
      worker=new Worker("./vendor/stockfish/stockfish-19-lite-single.js?build=25");
      worker.onmessage=event=>{
        const line=String(event.data||"").trim();
        if(line==="uciok"){
          stage="initialisation UCI (isready)";
          $("engine-status").textContent="Moteur téléchargé · initialisation…";
          worker.postMessage("isready");
        }else if(line==="readyok"){
          if(settled)return;
          settled=true;
          clearTimeout(timer);
          $("engine-status").textContent="Stockfish 19 prêt";
          $("engine-status").classList.add("ready");
          resolve(worker);
        }
      };
      worker.onerror=event=>{
        event.preventDefault?.();
        fail(new Error("Échec du chargement de Stockfish WebAssembly"+(event.message?" : "+event.message:".")));
      };
      worker.onmessageerror=()=>fail(new Error("Stockfish a envoyé une réponse illisible au navigateur."));
      $("engine-status").textContent="Stockfish téléchargé · démarrage du moteur…";
      stage="attente de la réponse UCI (uciok)";
      worker.postMessage("uci");
    })().catch(fail);
  });
  return engineReady;
}

function evalPosition(engine,fen){
  return new Promise((resolve,reject)=>{
    let score=0,bestmove="",pv=[],depth=0,timer=null;
    const handler=event=>{
      const line=String(event.data||"");
      const cp=line.match(/\bscore cp (-?\d+)/);
      const mate=line.match(/\bscore mate (-?\d+)/);
      if(cp)score=Number(cp[1]);
      if(mate)score=Number(mate[1])>0?10000:-10000;
      if(line.startsWith("info ")){
        const d=line.match(/\bdepth (\d+)/);
        if(d)depth=Number(d[1]);
        const pvIndex=line.indexOf(" pv ");
        if(pvIndex>=0)pv=line.slice(pvIndex+4).trim().split(/\s+/).filter(Boolean);
      }
      if(line.startsWith("bestmove")){
        engine.removeEventListener("message",handler);
        clearTimeout(timer);
        bestmove=line.split(/\s+/)[1]||"";
        const whiteToMove=fen.split(" ")[1]!=="b";
        resolve({score,bestmove,pv,depth,scoreWhite:score*(whiteToMove?1:-1)});
      }
    };
    engine.addEventListener("message",handler);
    engine.postMessage("position fen "+fen);
    engine.postMessage("go movetime 650");
    timer=setTimeout(()=>{
      engine.removeEventListener("message",handler);
      reject(new Error("Stockfish n’a pas terminé l’analyse de cette position dans le délai prévu."));
    },20000);
  });
}

function pvToSan(fen,pv,max=8){
  const board=new Chess(fen),out=[];
  for(const uci of (pv||[]).slice(0,max)){
    try{out.push(board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).san);}
    catch{break;}
  }
  return out;
}
function uciMove(move){ return move.from + move.to + (move.promotion || ""); }
function sanForUci(fen, uci){
  if (!uci || uci === "(none)") return "—";
  const board = new Chess(fen);
  const moves = board.moves({verbose:true});
  const found = moves.find(m => uciMove(m) === uci);
  return found ? found.san : uci;
}
function elapsedText(startedAt){const seconds=Math.floor((Date.now()-startedAt)/1000);return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");}
function classify(loss){
  if (loss < 35) return {label:"Bon coup",kind:"good"};
  if (loss < 90) return {label:"Imprécision",kind:"inaccuracy"};
  if (loss < 180) return {label:"Erreur",kind:"mistake"};
  return {label:"Gaffe",kind:"blunder"};
}
function resultName(g){
  const white = (g.white || "").toLowerCase() === user;
  const black = (g.black || "").toLowerCase() === user;
  const won = (white && g.result === "1-0") || (black && g.result === "0-1");
  const draw = g.result === "1/2-1/2";
  return won ? "Victoire" : draw ? "Nulle" : "Défaite";
}
function labelGame(g){
  const opponent = (g.white || "").toLowerCase() === user ? g.black : g.white;
  return (g.date || "Date inconnue") + " · " + (opponent || "Adversaire") + " · " + resultName(g);
}
function refreshGamePicker(){
  const select = $("analysis-game-select");
  if (!select) return;
  const games = (window.CoachApp?.getGames?.() || []).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const previous = select.value;
  select.innerHTML = games.length ? games.map((g,i)=>'<option value="'+esc(g.id)+'">'+esc(labelGame(g))+'</option>').join("") : '<option value="">Aucune partie importée</option>';
  if (games.some(g=>String(g.id)===previous)) select.value = previous;
  $("analyse-game-button").disabled = !games.length || busy;
}
function renderResults(g, report){
  const counts={good:0,inaccuracy:0,mistake:0,blunder:0};
  report.moves.forEach(m=>counts[m.kind]++);
  const issues=report.moves.filter(m=>m.kind!=="good");
  const ordered=[...report.moves].sort((a,b)=>a.ply-b.ply);
  const rows=ordered.map(m=>{
    const side=m.color==="w"?"Blancs":"Noirs";
    const note=m.loss>0?"perte estimée "+Math.round(m.loss)+" centipions":"coup conforme au meilleur choix";
    return '<button type="button" class="analysis-move analysis-move-button" data-analysis-ply="'+m.ply+'"><span class="analysis-move-main"><strong>'+esc(side)+' · '+esc(m.moveNo)+'. '+esc(m.played)+'</strong><small>Meilleur coup : <b>'+esc(m.best)+'</b> · '+esc(note)+'</small></span><span class="move-tag '+m.kind+'">'+m.label+'</span></button>';
  }).join("");
  $("analysis-results").innerHTML=
    '<div class="analysis-summary"><div><strong>'+report.moves.length+'</strong><span>coups analysés</span></div><div><strong>'+counts.inaccuracy+'</strong><span>imprécisions</span></div><div><strong>'+counts.mistake+'</strong><span>erreurs</span></div><div><strong>'+counts.blunder+'</strong><span>gaffes</span></div></div>'+
    '<p class="analysis-verdict">'+(issues.length?"Stockfish a trouvé "+issues.length+" coup(s) à revoir. Fais défiler les coups : les flèches et les explications suivent automatiquement la position affichée.":"Aucune erreur importante détectée dans les coups examinés.")+'</p>'+
    '<div class="analysis-moves">'+rows+'</div>'+
    '<p class="small muted">Stockfish 19 Lite · '+report.positions.length+' positions examinées · '+report.covered+' demi-coups parcourus. Analyse indicative à profondeur limitée.</p>';
  window.CoachReview?.setAnalysis?.(report.moves,g);
}
async function analyseSelectedGame(gameIdOverride){
  if (busy) return;
  const games = window.CoachApp?.getGames?.() || [];
  const id = gameIdOverride === undefined ? $("analysis-game-select").value : String(gameIdOverride);
  const game = games.find(g=>String(g.id)===id);
  if (!game) { $("analysis-results").innerHTML='<div class="empty-state">Aucune partie sélectionnée.</div>'; return; }
  $("analysis-game-select").value=String(game.id);
  if (!game.pgn) { $("analysis-results").innerHTML='<div class="empty-state">Le PGN de cette partie n’est pas disponible. Réimporte la partie depuis Chess.com pour l’analyser.</div>'; return; }
  busy = true; const startedAt=Date.now(); $("analyse-game-button").disabled = true; $("analyse-game-button").textContent = "Analyse en cours…";
  $("analysis-progress").hidden = false; $("analysis-progress-fill").style.width = "0%"; $("analysis-progress-label").textContent = "Chargement du moteur Stockfish…"; $("analysis-results").innerHTML = ""; if(window.CoachReview?.open) window.CoachReview.open(game.id);
  try {
    const parsed = new Chess();
    parsed.loadPgn(game.pgn);
    const history = parsed.history({verbose:true});
    if (!history.length) throw new Error("Aucun coup n'a pu être lu dans le PGN de cette partie.");
    const engine = await getEngine();
    const replay=new Chess(),report={moves:[],depth:0,covered:0,positions:[]};
    const userSide=(game.white||"").toLowerCase()===user?"w":"b";
    const maxPlies=history.length;
    const evaluations=[];
    // Une évaluation par position donne une courbe complète, comme sur les analyseurs
    // de référence. Le score est normalisé du point de vue des Blancs.
    for(let i=0;i<maxPlies;i++){
      const before=replay.fen();
      const positionEval=await evalPosition(engine,before);
      evaluations.push(positionEval);
      const move=history[i];
      replay.move({from:move.from,to:move.to,promotion:move.promotion});
      report.covered=i+1;
      $("analysis-progress-fill").style.width=Math.round((i+1)/maxPlies*100)+"%";
      $("analysis-progress-label").textContent="Analyse Stockfish : position "+(i+1)+" / "+maxPlies+" · "+elapsedText(startedAt);
    }
    evaluations.push(await evalPosition(engine,replay.fen()));
    report.positions=evaluations.map(item=>item.scoreWhite);
    report.positionDetails=[];
    for(let i=0;i<maxPlies;i++){
      const move=history[i],beforeEval=evaluations[i],afterEval=evaluations[i+1];
      const fen=new Chess();
      for(let j=0;j<i;j++)fen.move({from:history[j].from,to:history[j].to,promotion:history[j].promotion});
      const beforeFen=fen.fen(),playedUci=uciMove(move);
      const bestSan=sanForUci(beforeFen,beforeEval.bestmove);
      const moverSign=move.color==="w"?1:-1;
      const loss=beforeEval.bestmove===playedUci?0:Math.max(0,moverSign*(beforeEval.scoreWhite-afterEval.scoreWhite));
      const category=classify(loss);
      const detail={
        fen:beforeFen,bestUci:beforeEval.bestmove,pvUci:beforeEval.pv,
        pvSan:pvToSan(beforeFen,beforeEval.pv,8),
        evalWhite:beforeEval.scoreWhite,afterEvalWhite:afterEval.scoreWhite,
        color:move.color,ply:i,moveNo:Math.floor(i/2)+1,
        played:move.san,playedUci,best:bestSan,loss,...category
      };
      report.positionDetails.push(detail);
      if(move.color===userSide)report.moves.push(detail);
    }
    report.depth=maxPlies;
    game.analysis = {date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered};
    window.CoachApp.saveGames();
    renderResults(game,report);
    $("analysis-progress-fill").style.width = "100%"; $("analysis-progress-label").textContent = "Analyse terminée en "+elapsedText(startedAt)+".";
  } catch(error) {
    engineReady=null;
    if(worker){try{worker.terminate();}catch{} worker=null;}
    $("analysis-results").innerHTML = '<div class="empty-state">'+esc(error.message || "Une erreur est survenue pendant l’analyse.")+'</div>';
    $("engine-status").textContent = worker ? "Moteur interrompu" : "Moteur indisponible";
  } finally {
    busy = false; refreshGamePicker(); $("analyse-game-button").disabled = false; $("analyse-game-button").textContent = "Analyser cette partie";
  }
}

function openGameInCoach(gameId){
  const id=String(gameId??"");
  document.querySelector('[data-tab="training"]')?.click();
  refreshGamePicker();
  const select=$("analysis-game-select");
  const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===id);
  if(!game){
    $("analysis-results").innerHTML='<div class="empty-state">Cette partie est introuvable dans les données de cet appareil.</div>';
    return false;
  }
  if(select)select.value=id;
  $("analyse-game-button")?.scrollIntoView({behavior:"smooth",block:"center"});
  analyseSelectedGame(id);
  return true;
}
window.addEventListener("coach:analyze-game",event=>openGameInCoach(event.detail?.gameId));
$("analyse-game-button").addEventListener("click",()=>analyseSelectedGame());
window.addEventListener("coach:games-updated",refreshGamePicker);
document.addEventListener("click",event=>{const row=event.target.closest("[data-analysis-ply]");if(!row)return;const ply=Number(row.dataset.analysisPly);const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===$("analysis-game-select").value);const move=game?.analysis?.moves?.find(m=>m.ply===ply);if(move)window.CoachReview?.showAnalysisMove?.(move);});
window.CoachAnalysis={openGame:openGameInCoach,analyze:gameId=>openGameInCoach(gameId)};
refreshGamePicker();
