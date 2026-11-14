import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let active=null,moves=[],index=0,analysisMoves=[],activeAnalysisMove=null;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function arrow(from,to,color,dashed=false){
 if(!from||!to)return "";
 const x1=(from.charCodeAt(0)-96)*12.5-6.25,y1=(8-Number(from[1]))*12.5+6.25;
 const x2=(to.charCodeAt(0)-96)*12.5-6.25,y2=(8-Number(to[1]))*12.5+6.25;
 return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="2.3" stroke-linecap="round" opacity=".95" '+(dashed?'stroke-dasharray="3 2"':'')+' marker-end="url(#'+(dashed?'playedArrow':'bestArrow')+')" />';
}
function render(){
 if(!active)return;
 let board;
 try{board=activeAnalysisMove?new Chess(activeAnalysisMove.fen):new Chess();if(!activeAnalysisMove)for(let i=0;i<index;i++){const m=moves[i];board.move({from:m.from,to:m.to,promotion:m.promotion});}}
 catch{board=new Chess();}
 let cells="";
 board.board().forEach((rank,r)=>rank.forEach((p,f)=>{
  const square=String.fromCharCode(97+f)+(8-r),light=((r+f)%2)===1;
  cells+='<div class="replay-square '+(light?"light":"dark")+'" data-square="'+square+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':'')+'</div>';
 }));
 let arrows="";
 if(activeAnalysisMove){
  const best=activeAnalysisMove.bestUci,played=activeAnalysisMove.playedUci;
  arrows='<svg class="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="bestArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#9be564"/></marker><marker id="playedArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#ffb45e"/></marker></defs>'+arrow(best?.slice(0,2),best?.slice(2,4),"#9be564")+(played&&played!==best?arrow(played.slice(0,2),played.slice(2,4),"#ffb45e",true):"")+'</svg>';
 }
 const last=index?moves[index-1]:null,label=activeAnalysisMove?("Analyse du coup "+(Math.floor(activeAnalysisMove.ply/2)+1)+" · "+activeAnalysisMove.played):(last?("Coup "+Math.ceil(index/2)+" · "+last.san):"Position initiale");
 const analysisPanel=activeAnalysisMove?'<div class="board-analysis-note"><strong>Meilleur coup : '+esc(activeAnalysisMove.best)+'</strong><span>Tu as joué '+esc(activeAnalysisMove.played)+(activeAnalysisMove.loss>0?' · perte estimée '+Math.round(activeAnalysisMove.loss)+' centipions':' · choix conforme à Stockfish')+'</span><small><i class="arrow-key best-key"></i> Meilleur coup <i class="arrow-key played-key"></i> Coup joué</small></div>':'';
 $("game-replay-area").innerHTML='<article class="surface replay-card" id="active-game-review"><div class="surface-heading"><div><p class="eyebrow">RELECTURE DE TA PARTIE</p><h3>Rejouer et comprendre</h3><p class="muted">'+esc(active.date||"Partie")+' · '+esc(active.white||"Blancs")+' – '+esc(active.black||"Noirs")+'</p></div><span class="engine-badge '+(analysisMoves.length?"ready":"")+'">'+(analysisMoves.length?"Analyse disponible":"Relecture")+'</span></div><p class="review-position-label">'+esc(label)+' · '+index+' / '+moves.length+' demi-coups</p><div class="replay-layout"><div class="replay-board">'+cells+arrows+'</div><div class="replay-controls"><button class="secondary-button" data-review-step="-1" '+(index===0?"disabled":"")+'>← Précédent</button><button class="primary-button" data-review-step="1" '+(index===moves.length?"disabled":"")+'>Suivant →</button><button class="secondary-button" data-review-start="1">Revenir au début</button><button class="secondary-button" data-review-end="1">Aller à la fin</button><div class="review-action"><strong>Analyse de tes coups</strong><p>'+(analysisMoves.length?"Choisis un coup dans le bilan pour afficher les recommandations et les flèches.":"Stockfish va comparer tes décisions et proposer le meilleur coup dans chaque position.")+'</p><button type="button" class="primary-button" id="review-run-analysis">'+(analysisMoves.length?"Relancer l’analyse Stockfish":"Analyser avec Stockfish")+'</button></div></div></div>'+analysisPanel+'</article>';
 $("game-replay-area").querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 $("review-run-analysis").addEventListener("click",()=>{const id=active.id;const select=$("analysis-game-select");if(select)select.value=String(id);if(window.CoachAnalysis?.analyze)window.CoachAnalysis.analyze(id);else window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:id}}));});
}
function open(id){
 document.querySelector('[data-tab="training"]')?.click();
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(id));
 if(!game){$("analysis-results").innerHTML='<div class="empty-state">Partie introuvable dans les données de cet appareil.</div>';return false;}
 if(!game.pgn){$("game-replay-area").innerHTML='<div class="empty-state">Le PGN de cette partie est absent. Réimporte-la pour la rejouer.</div>';return false;}
 try{const c=new Chess();c.loadPgn(game.pgn);moves=c.history({verbose:true});if(!moves.length)throw new Error("Aucun coup lisible dans le PGN.");active=game;index=0;analysisMoves=game.analysis?.moves||[];activeAnalysisMove=null;const s=$("analysis-game-select");if(s)s.value=String(game.id);$("analysis-results").innerHTML='<div class="empty-state compact">La relecture est prête. Parcours les coups, puis lance l’analyse moteur pour obtenir les meilleurs coups.</div>';$("lesson-area").innerHTML="";render();$("active-game-review")?.scrollIntoView({behavior:"smooth",block:"start"});return true;}
 catch(e){$("game-replay-area").innerHTML='<div class="empty-state">Impossible de lire cette partie : '+esc(e.message)+'</div>';return false;}
}
function setAnalysis(list,game){
 if(game)active=game;
 analysisMoves=list||[];
 activeAnalysisMove=analysisMoves.find(m=>m.kind!=="good")||analysisMoves[0]||null;
 if(activeAnalysisMove)index=activeAnalysisMove.ply;
 render();
}
function showAnalysisMove(move){
 activeAnalysisMove=move;index=move.ply;render();
 $("active-game-review")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}
document.addEventListener("click",e=>{const s=e.target.closest("[data-review-step]");if(s&&active){activeAnalysisMove=null;index=Math.max(0,Math.min(moves.length,index+Number(s.dataset.reviewStep)));render();return;}if(e.target.closest("[data-review-start]")&&active){activeAnalysisMove=null;index=0;render();return;}if(e.target.closest("[data-review-end]")&&active){activeAnalysisMove=null;index=moves.length;render();}});
window.CoachReview={open,setAnalysis,showAnalysisMove};
window.addEventListener("coach:review-game",event=>open(event.detail?.gameId));
