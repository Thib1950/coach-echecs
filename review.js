import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let active=null,moves=[],index=0,analysisMoves=[],activeAnalysisMove=null,variationIndex=0;
const manualHighlights=new Set();
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function arrow(from,to,color,dashed=false){
 if(!from||!to)return "";
 const x1=(from.charCodeAt(0)-96)*12.5-6.25,y1=(8-Number(from[1]))*12.5+6.25;
 const x2=(to.charCodeAt(0)-96)*12.5-6.25,y2=(8-Number(to[1]))*12.5+6.25;
 return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="2.3" stroke-linecap="round" opacity=".95" '+(dashed?'stroke-dasharray="3 2"':'')+' marker-end="url(#'+(dashed?'playedArrow':'bestArrow')+')" />';
}
function formatEval(cp){
 if(cp==null||!Number.isFinite(cp))return "—";
 if(Math.abs(cp)>=9990)return cp>0?"+M":"−M";
 const value=(cp/100).toFixed(1);
 return cp>0?"+"+value:value.replace("-","−");
}
function evalAdvantage(cp){
 if(cp==null)return "En attente";
 if(Math.abs(cp)<25)return "Équilibre";
 return cp>0?"Avantage Blancs":"Avantage Noirs";
}
function render(){
 if(!active)return;
 let board;
 const pv=activeAnalysisMove?.pvUci||[];
 try{
  if(activeAnalysisMove){
   board=new Chess(activeAnalysisMove.fen);
   for(const uci of pv.slice(0,variationIndex)){
    board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
   }
  }else{
   board=new Chess();
   for(let i=0;i<index;i++){
    const m=moves[i];
    board.move({from:m.from,to:m.to,promotion:m.promotion});
   }
  }
 }catch{board=new Chess();}
 const lastPv=variationIndex>0?pv[variationIndex-1]:null;
 const pvSquares=lastPv?[lastPv.slice(0,2),lastPv.slice(2,4)]:[];
 let cells="";
 board.board().forEach((rank,r)=>rank.forEach((p,f)=>{
  const square=String.fromCharCode(97+f)+(8-r),light=((r+f)%2)===1;
  const classes=["replay-square",light?"light":"dark"];
  if(pvSquares.includes(square))classes.push("pv-highlight");
  if(manualHighlights.has(square))classes.push("manual-highlight");
  cells+='<div class="'+classes.join(" ")+'" data-square="'+square+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':'')+'</div>';
 }));
 let arrows="";
 if(activeAnalysisMove&&variationIndex===0){
  const best=activeAnalysisMove.bestUci,played=activeAnalysisMove.playedUci;
  arrows='<svg class="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="bestArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#9be564"/></marker><marker id="playedArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#ffb45e"/></marker></defs>'+arrow(best?.slice(0,2),best?.slice(2,4),"#9be564")+(played&&played!==best?arrow(played.slice(0,2),played.slice(2,4),"#ffb45e",true):"")+'</svg>';
 }
 const last=index?moves[index-1]:null;
 const label=activeAnalysisMove?(variationIndex?"Variante Stockfish · "+variationIndex+" coup(s) joué(s)":"Analyse du coup "+(Math.floor(activeAnalysisMove.ply/2)+1)+" · "+activeAnalysisMove.played):(last?("Coup "+Math.ceil(index/2)+" · "+last.san):"Position initiale");
 const cp=activeAnalysisMove?.evalWhite??active?.analysis?.positions?.[Math.min(index,(active?.analysis?.positions?.length||1)-1)]??null;
 const clamped=Math.max(-1000,Math.min(1000,Number(cp)||0));
 const whitePct=100/(1+Math.exp(-0.00368208*clamped));
 const evalMarkup='<div class="eval-column"><strong class="eval-score">'+formatEval(cp)+'</strong><div class="eval-bar-track" aria-label="'+esc(evalAdvantage(cp))+'"><div class="eval-black" style="height:'+(100-whitePct)+'%"></div><div class="eval-white" style="height:'+whitePct+'%"></div></div><span class="eval-label">'+evalAdvantage(cp)+'</span><small class="eval-perspective">+ Blancs</small></div>';
 const pvLine=(activeAnalysisMove?.pvSan||[]).map((san,i)=>'<button type="button" class="pv-step '+(variationIndex===i+1?"active":"")+'" data-pv-step="'+(i+1)+'">'+esc(san)+'</button>').join("");
 const pvPanel=activeAnalysisMove&&pvLine?'<div class="pv-panel"><div class="pv-heading"><strong>Meilleure variante Stockfish</strong><span>Touche un coup pour suivre la ligne</span></div><div class="pv-moves"><button type="button" class="pv-step '+(variationIndex===0?"active":"")+'" data-pv-step="0">Départ</button>'+pvLine+'</div></div>':"";
 const analysisPanel=activeAnalysisMove?'<div class="board-analysis-note"><strong>Meilleur coup : '+esc(activeAnalysisMove.best)+'</strong><span>Tu as joué '+esc(activeAnalysisMove.played)+(activeAnalysisMove.loss>0?' · perte estimée '+Math.round(activeAnalysisMove.loss)+' centipions':' · choix conforme à Stockfish')+'</span><small><i class="arrow-key best-key"></i> Meilleur coup <i class="arrow-key played-key"></i> Coup joué</small></div>'+pvPanel:'';
 const clearButton=manualHighlights.size?'<button type="button" class="clear-highlights" data-clear-highlights="1">Effacer les surbrillances</button>':'';
 $("game-replay-area").innerHTML='<article class="surface replay-card" id="active-game-review"><div class="surface-heading"><div><p class="eyebrow">RELECTURE DE TA PARTIE</p><h3>Rejouer et comprendre</h3><p class="muted">'+esc(active.date||"Partie")+' · '+esc(active.white||"Blancs")+' – '+esc(active.black||"Noirs")+'</p></div><span class="engine-badge '+(analysisMoves.length?"ready":"")+'">'+(analysisMoves.length?"Analyse disponible":"Relecture")+'</span></div><p class="review-position-label">'+esc(label)+' · '+index+' / '+moves.length+' demi-coups</p><div class="replay-layout"><div class="replay-board-wrap">'+evalMarkup+'<div class="replay-board">'+cells+arrows+'</div></div><div class="replay-controls"><button class="icon-nav" data-review-start="1" title="Revenir au début" aria-label="Revenir au début">|◀</button><button class="icon-nav" data-review-step="-1" '+(index===0?"disabled":"")+' title="Coup précédent" aria-label="Coup précédent">◀</button><button class="icon-nav" data-review-step="1" '+(index===moves.length?"disabled":"")+' title="Coup suivant" aria-label="Coup suivant">▶</button><button class="icon-nav" data-review-end="1" title="Aller à la fin" aria-label="Aller à la fin">▶|</button></div></div>'+clearButton+'<div class="review-action"><div><strong>Analyse de tes coups</strong><p>'+(analysisMoves.length?"Choisis un coup dans le bilan pour afficher les recommandations et les flèches.":"Stockfish va comparer tes décisions et proposer le meilleur coup dans chaque position.")+'</p></div><button type="button" class="primary-button" id="review-run-analysis">'+(analysisMoves.length?"Relancer l’analyse Stockfish":"Analyser avec Stockfish")+'</button></div>'+analysisPanel+'</article>';
 $("game-replay-area").querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 $("review-run-analysis").addEventListener("click",()=>{const id=active.id;const select=$("analysis-game-select");if(select)select.value=String(id);if(window.CoachAnalysis?.analyze)window.CoachAnalysis.analyze(id);else window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:id}}));});
}
function open(id){
 document.querySelector('[data-tab="training"]')?.click();
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(id));
 if(!game){$("analysis-results").innerHTML='<div class="empty-state">Partie introuvable dans les données de cet appareil.</div>';return false;}
 if(!game.pgn){$("game-replay-area").innerHTML='<div class="empty-state">Le PGN de cette partie est absent. Réimporte-la pour la rejouer.</div>';return false;}
 try{const c=new Chess();c.loadPgn(game.pgn);moves=c.history({verbose:true});if(!moves.length)throw new Error("Aucun coup lisible dans le PGN.");active=game;index=0;analysisMoves=game.analysis?.moves||[];activeAnalysisMove=null;variationIndex=0;manualHighlights.clear();const s=$("analysis-game-select");if(s)s.value=String(game.id);$("analysis-results").innerHTML='<div class="empty-state compact">La relecture est prête. Parcours les coups, puis lance l’analyse moteur pour obtenir les meilleurs coups.</div>';$("lesson-area").innerHTML="";render();$("active-game-review")?.scrollIntoView({behavior:"smooth",block:"start"});return true;}
 catch(e){$("game-replay-area").innerHTML='<div class="empty-state">Impossible de lire cette partie : '+esc(e.message)+'</div>';return false;}
}
function setAnalysis(list,game){
 if(game)active=game;
 analysisMoves=list||[];
 activeAnalysisMove=analysisMoves.find(m=>m.kind!=="good")||analysisMoves[0]||null;
 variationIndex=0;manualHighlights.clear();
 if(activeAnalysisMove)index=activeAnalysisMove.ply;
 render();
}
function showAnalysisMove(move){
 activeAnalysisMove=move;index=move.ply;variationIndex=0;render();
 $("active-game-review")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}
let moveAudioContext=null;
function playMoveSound(direction){
 try{
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  if(!moveAudioContext)moveAudioContext=new AudioCtx();
  const ctx=moveAudioContext;
  if(ctx.state==="suspended")ctx.resume();
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();
  oscillator.type="triangle";
  oscillator.frequency.setValueAtTime(direction<0?390:540,ctx.currentTime);
  gain.gain.setValueAtTime(0.0001,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055,ctx.currentTime+0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.075);
  oscillator.connect(gain);gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime);oscillator.stop(ctx.currentTime+0.08);
 }catch(error){console.debug("Son des coups indisponible",error);}
}
document.addEventListener("click",e=>{
 const pvStep=e.target.closest("[data-pv-step]");
 if(pvStep&&activeAnalysisMove){
  variationIndex=Math.max(0,Math.min((activeAnalysisMove.pvUci||[]).length,Number(pvStep.dataset.pvStep)||0));
  render();
  return;
 }
 if(e.target.closest("[data-clear-highlights]")){
  manualHighlights.clear();render();return;
 }
 const square=e.target.closest(".replay-square[data-square]");
 if(square&&active){
  const name=square.dataset.square;
  if(manualHighlights.has(name))manualHighlights.delete(name);else manualHighlights.add(name);
  render();return;
 }
 const step=e.target.closest("[data-review-step]");
 if(step&&active){
  const next=Math.max(0,Math.min(moves.length,index+Number(step.dataset.reviewStep)));
  if(next!==index){activeAnalysisMove=null;variationIndex=0;index=next;playMoveSound(Number(step.dataset.reviewStep));render();}
  return;
 }
 if(e.target.closest("[data-review-start]")&&active){
  if(index!==0){activeAnalysisMove=null;variationIndex=0;index=0;playMoveSound(-1);render();}
  return;
 }
 if(e.target.closest("[data-review-end]")&&active){
  if(index!==moves.length){activeAnalysisMove=null;variationIndex=0;index=moves.length;playMoveSound(1);render();}
 }
});
window.CoachReview={open,setAnalysis,showAnalysisMove};
window.addEventListener("coach:review-game",event=>open(event.detail?.gameId));
