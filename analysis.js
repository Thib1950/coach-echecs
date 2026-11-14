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

function evalPosition(engine,fen,movetime=650){
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
    engine.postMessage("go movetime "+movetime);
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
  if(loss<=0.01)return {label:"Coup parfait",kind:"perfect"};
  if(loss<15)return {label:"Meilleur coup",kind:"best"};
  if(loss<35)return {label:"Bon coup",kind:"good"};
  if(loss<90)return {label:"Imprécision",kind:"inaccuracy"};
  if(loss<180)return {label:"Erreur",kind:"mistake"};
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
  const kinds=["brilliant","perfect","best","good","inaccuracy","mistake","blunder"];
  const counts=Object.fromEntries(kinds.map(k=>[k,0]));
  report.moves.forEach(m=>{if(m.loss!==null&&m.loss!==undefined&&counts[m.kind]!==undefined)counts[m.kind]++;});
  const meta={brilliant:["!!","Brillants"],perfect:["✓","Parfaits"],best:["★","Meilleurs"],good:["✓","Bons coups"],inaccuracy:["?!","Imprécisions"],mistake:["?","Erreurs"],blunder:["??","Gaffes"]};
  const tiles=kinds.map(k=>'<div class="summary-metric '+k+'"><span class="metric-icon">'+meta[k][0]+'</span><strong>'+counts[k]+'</strong><span class="metric-label">'+meta[k][1]+'</span></div>').join("");
  const moveList=report.moves.filter(m=>m.loss!==null&&m.loss!==undefined).map(m=>{
    const symbol=meta[m.kind]?.[0]||"✓",label=m.label||"Bon coup";
    return '<button type="button" class="analysis-move analysis-move-button" data-analysis-ply="'+m.ply+'"><span class="analysis-move-main"><strong>'+Math.floor(m.ply/2+1)+'. '+esc(m.played||"—")+'</strong><small>Meilleur coup : <b>'+esc(m.best||"—")+'</b> · perte estimée '+Math.round(m.loss)+' cp</small></span><span class="move-tag '+m.kind+'">'+symbol+' '+esc(label)+'</span></button>';
  }).join("");
  $("analysis-results").innerHTML='<div class="analysis-summary">'+tiles+'</div><p class="analysis-verdict">'+(report.moves.length?"Voici le détail de tes décisions, coup par coup. Sélectionne une ligne pour afficher la position et comprendre l’idée.":"Aucun coup personnel n’a encore été évalué.")+'</p><div class="analysis-moves">'+moveList+'</div><p class="small muted">Précision estimée sur tes coups uniquement · analyse moteur indicative à profondeur limitée. Les coups brillants sont comptés uniquement lorsqu’un sacrifice décisif est reconnu.</p>';
  if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,g);
}
function accuracyFromMoves(moves){
  const list=(moves||[]).filter(m=>m.loss!==null&&m.loss!==undefined&&Number.isFinite(Number(m.loss))).map(m=>Math.max(0,Number(m.loss)||0));
  if(!list.length)return null;
  return Math.round(list.reduce((sum,loss)=>sum+100*Math.exp(-0.01*Math.sqrt(loss)),0)/list.length);
}
function bestMoveFacts(fen,uci){
  if(!uci||uci==="(none)")return {bestCapture:false,bestCheck:false};
  try{
    const board=new Chess(fen),m=board.moves({verbose:true}).find(x=>uciMove(x)===uci);
    if(!m)return {bestCapture:false,bestCheck:false};
    board.move({from:m.from,to:m.to,promotion:m.promotion});
    return {bestCapture:!!m.captured,bestCheck:board.isCheck(),bestMate:board.isCheckmate()};
  }catch{return {bestCapture:false,bestCheck:false};}
}
async function analyseSelectedGame(gameIdOverride,options={}){
  if(busy)return;
  const background=!!options.background,movetime=options.movetime||650;
  const games=window.CoachApp?.getGames?.()||[];
  const id=gameIdOverride===undefined?$("analysis-game-select").value:String(gameIdOverride);
  const game=games.find(g=>String(g.id)===id);
  if(!game){$("analysis-results").innerHTML='<div class="empty-state">Aucune partie sélectionnée.</div>';return;}
  if(!background)$("analysis-game-select").value=String(game.id);
  if(!game.pgn){if(!background)$("analysis-results").innerHTML='<div class="empty-state">Le PGN de cette partie n’est pas disponible. Réimporte la partie depuis Chess.com pour l’analyser.</div>';return;}
  busy=true;const startedAt=Date.now();
  if(!background){
    $("analyse-game-button").disabled=true;$("analyse-game-button").textContent="Analyse en cours…";
    $("analysis-progress").hidden=false;$("analysis-progress-fill").style.width="0%";$("analysis-progress-label").textContent="Chargement du moteur Stockfish…";
    $("analysis-results").innerHTML="";if(window.CoachReview?.open)window.CoachReview.open(game.id);
  }
  const report={moves:[],depth:0,covered:0,positions:[],positionDetails:[]};
  try{
    const parsed=new Chess();parsed.loadPgn(game.pgn);
    const history=parsed.history({verbose:true});
    if(!history.length)throw new Error("Aucun coup n'a pu être lu dans le PGN de cette partie.");
    const engine=await getEngine(),replay=new Chess();
    const userSide=(game.white||"").toLowerCase()===user?"w":"b";
    let beforeEval=await evalPosition(engine,replay.fen(),movetime);
    report.positions.push(beforeEval.scoreWhite);
    for(let i=0;i<history.length;i++){
      const beforeFen=replay.fen(),move=history[i],playedUci=uciMove(move);
      replay.move({from:move.from,to:move.to,promotion:move.promotion});
      const bestSan=sanForUci(beforeFen,beforeEval.bestmove);
      const facts=bestMoveFacts(beforeFen,beforeEval.bestmove);
      const playedBoard=new Chess(beforeFen);playedBoard.move({from:move.from,to:move.to,promotion:move.promotion});
      const detail={
        fen:beforeFen,bestUci:beforeEval.bestmove,pvUci:beforeEval.pv,
        pvSan:pvToSan(beforeFen,beforeEval.pv,8),
        evalWhite:beforeEval.scoreWhite,afterEvalWhite:null,
        color:move.color,ply:i,moveNo:Math.floor(i/2)+1,
        played:move.san,playedUci,best:bestSan,loss:null,label:"Analyse en cours",kind:"good",
        playedCapture:!!move.captured,playedCheck:playedBoard.isCheck(),
        playedMate:playedBoard.isCheckmate(),...facts,depth:beforeEval.depth
      };
      report.positionDetails.push(detail);
      if(move.color===userSide)report.moves.push(detail);
      report.covered=i+1;
      game.analysis={
        date:new Date().toISOString(),moves:report.moves,positions:report.positions,
        positionDetails:report.positionDetails,covered:report.covered,
        accuracy:null,partial:true
      };
      // Publie la flèche du meilleur coup dès que Stockfish a terminé cette position.
      window.CoachApp.saveGames();
      if(!background){
        renderResults(game,report);
        if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,game);
      }

      const afterEval=await evalPosition(engine,replay.fen(),movetime);
      const moverSign=move.color==="w"?1:-1;
      const loss=beforeEval.bestmove===playedUci?0:Math.max(0,moverSign*(beforeEval.scoreWhite-afterEval.scoreWhite));
      Object.assign(detail,{afterEvalWhite:afterEval.scoreWhite,loss,...classify(loss)});
      report.covered=i+1;
      report.depth=Math.max(report.depth,beforeEval.depth||0);
      report.positions.push(afterEval.scoreWhite);
      beforeEval=afterEval;
      game.analysis={
        date:new Date().toISOString(),moves:report.moves,positions:report.positions,
        positionDetails:report.positionDetails,covered:report.covered,
        accuracy:accuracyFromMoves(report.moves),partial:true
      };
      window.CoachApp.saveGames();
      renderResults(game,report);
      if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,game);
      if(!background){
        $("analysis-progress-fill").style.width=Math.round((i+1)/history.length*100)+"%";
        $("analysis-progress-label").textContent="Analyse en cours · "+(i+1)+" / "+history.length+" demi-coups · "+elapsedText(startedAt);
      }
    }
    game.analysis={date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered,accuracy:accuracyFromMoves(report.moves),partial:false,depth:report.depth};
    window.CoachApp.saveGames();
    if(!background){
      renderResults(game,report);
      if(window.CoachReview?.updateAnalysis)window.CoachReview.updateAnalysis(report.moves,game);
      $("analysis-progress-fill").style.width="100%";
      $("analysis-progress-label").textContent="Analyse complète · "+elapsedText(startedAt)+" · Précision estimée : "+game.analysis.accuracy+" %.";
    }else{
      window.CoachApp.refresh?.();
      updateAccuracyQueueStatus();
    }
  }catch(error){
    if(!report.covered){
      engineReady=null;if(worker){try{worker.terminate();}catch{}worker=null;}
      if(!background){
        $("analysis-results").innerHTML='<div class="empty-state">'+esc(error.message||"Une erreur est survenue pendant l’analyse.")+'</div>';
        $("engine-status").textContent="Moteur indisponible";
      }
    }else{
      game.analysis={date:new Date().toISOString(),moves:report.moves,positions:report.positions,positionDetails:report.positionDetails,covered:report.covered,accuracy:accuracyFromMoves(report.moves),partial:true};
      window.CoachApp.saveGames();
      if(!background){
        renderResults(game,report);
        $("analysis-progress-label").textContent="Analyse interrompue après "+report.covered+" demi-coups. Les positions déjà calculées restent disponibles.";
      }
    }
  }finally{
    busy=false;refreshGamePicker();
    if(!background){
      $("analyse-game-button").disabled=false;$("analyse-game-button").textContent="Analyser cette partie";
      setTimeout(startAccuracyQueue,700);
    }
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
window.addEventListener("coach:games-updated",()=>{refreshGamePicker();updateAccuracyQueueStatus();setTimeout(startAccuracyQueue,400);});

window.CoachAnalysis={openGame:openGameInCoach,analyze:gameId=>openGameInCoach(gameId)};
refreshGamePicker();
updateAccuracyQueueStatus();
setTimeout(startAccuracyQueue,1800);

let autoQueueRunning=false,autoQueueStopped=false;
function updateAccuracyQueueStatus(){
  const all=window.CoachApp?.getGames?.()||[];
  const eligible=all.filter(g=>g.pgn);
  const complete=eligible.filter(g=>!g.analysis?.partial&&Number.isFinite(Number(g.analysis?.accuracy))).length;
  const pending=eligible.length-complete;
  const node=$("accuracy-queue-status");
  if(node)node.textContent=pending?"Calcul automatique de ta précision : "+complete+" / "+eligible.length+" parties terminées · "+pending+" restantes.":eligible.length?"Précision calculée pour toutes tes parties importées.":"";
}
async function startAccuracyQueue(){
  if(autoQueueRunning||busy||document.hidden)return;
  autoQueueRunning=true;autoQueueStopped=false;
  try{
    while(!document.hidden&&!autoQueueStopped){
      const all=(window.CoachApp?.getGames?.()||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      const next=all.find(g=>g.pgn&&(g.analysis?.partial||!Number.isFinite(Number(g.analysis?.accuracy))));
      updateAccuracyQueueStatus();
      if(!next)break;
      await analyseSelectedGame(next.id,{background:true,movetime:120});
      if(!next.analysis?.partial&&!Number.isFinite(Number(next.analysis?.accuracy))){autoQueueStopped=true;break;}
      if(next.analysis?.partial){autoQueueStopped=true;break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }catch(error){console.warn("Calcul automatique de précision interrompu",error);}
  finally{autoQueueRunning=false;updateAccuracyQueueStatus();}
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(startAccuracyQueue,500);});
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-analysis-ply]");
  if(!button)return;
  const all=window.CoachApp?.getGames?.()||[];
  const game=all.find(g=>g.analysis?.moves?.some(m=>String(m.ply)===button.dataset.analysisPly));
  const move=game?.analysis?.moves?.find(m=>String(m.ply)===button.dataset.analysisPly);
  if(move)window.CoachReview?.showAnalysisMove(move);
});
