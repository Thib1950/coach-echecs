import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let active=null,moves=[],index=0,analysisMoves=[],activeAnalysisMove=null,variationIndex=0;
let freeBoard=null,freeStartFen="",freeSelected=null;
const manualHighlights=new Set();
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function arrow(from,to,color,dashed=false){
 if(!from||!to)return "";
 const x1=(from.charCodeAt(0)-96)*12.5-6.25,y1=(8-Number(from[1]))*12.5+6.25;
 const x2=(to.charCodeAt(0)-96)*12.5-6.25,y2=(8-Number(to[1]))*12.5+6.25;
 return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="2.3" stroke-linecap="round" opacity=".95" '+(dashed?'stroke-dasharray="3 2"':'')+' marker-end="url(#'+(dashed?'playedArrow':'bestArrow')+')" />';
}
function formatEval(cp){
 if(cp==null||!Number.isFinite(Number(cp)))return "—";
 cp=Number(cp);if(Math.abs(cp)>=9990)return cp>0?"+M":"−M";
 const value=(cp/100).toFixed(1);return cp>0?"+"+value:value.replace("-","−");
}
function coachMessage(detail){
 if(!detail)return {title:"Ton coach est prêt",body:"Fais défiler les coups : je commenterai chaque position et les idées que Stockfish recommande.",tip:"Conseil : avant chaque coup, vérifie les échecs, les captures et les menaces de ton adversaire."};
 const best=detail.best||"le meilleur coup";
 if(detail.color!==((active?.white||"").toLowerCase()==="gone_1950"?"w":"b")){
  return {title:"Au tour de l’adversaire",body:"L’adversaire a joué "+(detail.played||"un coup")+". Dans cette position, Stockfish préfère "+best+". Observe cette idée : elle t’indique la réponse la plus précise à envisager.",tip:"Demande-toi toujours quelle menace vient de créer le dernier coup."};
 }
 if(Number(detail.loss||0)<35){
  return {title:"Bien joué !",body:"Tu as joué "+(detail.played||"ce coup")+". C’est un choix proche de la meilleure décision : Stockfish propose "+best+". Tu as conservé l’essentiel de l’évaluation.",tip:"Continue à vérifier les menaces adverses avant de valider ton coup."};
 }
 const label=detail.label||"Coup à revoir";
 const loss=Math.round(Number(detail.loss)||0);
 return {title:label+" : regardons pourquoi",body:"Tu as joué "+(detail.played||"ce coup")+", mais Stockfish préfère "+best+". Ce choix coûte environ "+loss+" centipions dans cette position. Rejoue la variante proposée et compare les menaces avant et après le coup.",tip:"Prends l’habitude de chercher d’abord les échecs, les prises et les menaces forcées. C’est souvent là que se trouve la différence."};
}
function currentDetail(){
 if(freeBoard)return null;
 return active?.analysis?.positionDetails?.[index]||activeAnalysisMove||null;
}
function render(){
 if(!active)return;
 const detail=currentDetail();
 let board;
 const pv=detail?.pvUci||[];
 try{
  if(freeBoard)board=new Chess(freeBoard.fen());
  else if(detail&&variationIndex>0){
   board=new Chess(detail.fen);
   for(const uci of pv.slice(0,variationIndex))board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
  }else{
   board=new Chess();
   for(let i=0;i<index;i++){const m=moves[i];board.move({from:m.from,to:m.to,promotion:m.promotion});}
  }
 }catch{board=new Chess();}
 const lastPv=variationIndex>0?pv[variationIndex-1]:null;
 const pvSquares=lastPv?[lastPv.slice(0,2),lastPv.slice(2,4)]:[];
 const selectedSquares=freeSelected?[freeSelected]:[];
 let cells="";
 board.board().forEach((rank,r)=>rank.forEach((p,f)=>{
  const square=String.fromCharCode(97+f)+(8-r),light=((r+f)%2)===1;
  const classes=["replay-square",light?"light":"dark"];
  if(pvSquares.includes(square))classes.push("pv-highlight");
  if(manualHighlights.has(square))classes.push("manual-highlight");
  if(selectedSquares.includes(square))classes.push("free-selected");
  cells+='<div class="'+classes.join(" ")+'" data-square="'+square+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+glyph[p.color+p.type]+'">':'')+'</div>';
 }));
 let arrows="";
 const arrowDetail=freeBoard?null:(variationIndex===0?detail:null);
 if(arrowDetail){
  const best=arrowDetail.bestUci,played=arrowDetail.playedUci;
  arrows='<svg class="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="bestArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#9be564"/></marker><marker id="playedArrow" markerWidth="5" markerHeight="5" refX="3.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#ffb45e"/></marker></defs>'+arrow(best?.slice(0,2),best?.slice(2,4),"#9be564")+(played&&played!==best?arrow(played.slice(0,2),played.slice(2,4),"#ffb45e",true):"")+'</svg>';
 }
 const last=index?moves[index-1]:null;
 const label=freeBoard?"Mode libre · "+freeBoard.turn().toUpperCase()+" joue":(variationIndex?"Variante Stockfish · "+variationIndex+" coup(s) joué(s)":(detail&&detail.played?"Coup "+(Math.floor(detail.ply/2)+1)+" · "+detail.played:(last?("Après le coup "+Math.ceil(index/2)+" · "+last.san):"Position initiale")));
 const cp=freeBoard?null:(variationIndex?null:(detail?.evalWhite??active?.analysis?.positions?.[Math.min(index,(active?.analysis?.positions?.length||1)-1)]??null));
 const clamped=Math.max(-1000,Math.min(1000,Number(cp)||0));
 const whitePct=100/(1+Math.exp(-0.00368208*clamped));
 const evalMarkup='<div class="eval-column"><strong class="eval-score">'+formatEval(cp)+'</strong><div class="eval-bar-track" aria-label="Évaluation du point de vue des Blancs"><div class="eval-black" style="height:'+(100-whitePct)+'%"></div><div class="eval-white" style="height:'+whitePct+'%"></div></div><small class="eval-perspective">Blancs</small></div>';
 const pvLine=(detail?.pvSan||[]).map((san,i)=>'<button type="button" class="pv-step '+(variationIndex===i+1?"active":"")+'" data-pv-step="'+(i+1)+'">'+esc(san)+'</button>').join("");
 const pvPanel=detail&&pvLine?'<div class="pv-panel"><div class="pv-heading"><strong>Meilleure variante Stockfish</strong><span>Touche un coup pour suivre la ligne</span></div><div class="pv-moves"><button type="button" class="pv-step '+(variationIndex===0?"active":"")+'" data-pv-step="0">Départ</button>'+pvLine+'</div></div>':"";
 const coach=coachMessage(detail);
 const coachPanel='<aside class="review-side"><section class="coach-card"><div class="coach-avatar" aria-hidden="true">♞</div><div class="coach-identity"><strong>Ton coach</strong><span>Analyse Stockfish · en direct</span></div><div class="coach-message"><strong>'+esc(freeBoard?"À toi de jouer !":coach.title)+'</strong><p>'+esc(freeBoard?"Essaie une continuation. Les coups légaux sont acceptés sur l’échiquier. Tu peux annuler ou revenir à la position de départ à tout moment.":coach.body)+'</p><small>'+esc(freeBoard?"Joue librement, puis compare tes idées à la variante du moteur.":coach.tip)+'</small></div></section><div class="free-play-controls">'+(freeBoard?'<button type="button" class="secondary-button" data-free-undo="1" '+(freeBoard.history().length?"":"disabled")+'>↶ Annuler le coup</button><button type="button" class="secondary-button" data-free-reset="1">Revenir à la position</button><button type="button" class="text-button" data-free-exit="1">Quitter le mode libre</button>':'<button type="button" class="secondary-button free-play-button" data-free-start="1">▶ Continuer la partie depuis cette position</button>')+'</div></aside>';
 const controls='<div class="replay-controls"><button class="icon-nav" data-review-start="1" title="Revenir au début" aria-label="Revenir au début">|◀</button><button class="icon-nav" data-review-step="-1" '+(index===0||freeBoard?"disabled":"")+' title="Coup précédent" aria-label="Coup précédent">◀</button><button class="icon-nav" data-review-step="1" '+(index===moves.length||freeBoard?"disabled":"")+' title="Coup suivant" aria-label="Coup suivant">▶</button><button class="icon-nav" data-review-end="1" title="Aller à la fin" aria-label="Aller à la fin" '+(freeBoard?"disabled":"")+'>▶|</button></div>';
 const analysisPanel=detail&&!freeBoard?'<div class="board-analysis-note"><strong>Meilleur coup : '+esc(detail.best||"—")+'</strong><span>Coup joué : '+esc(detail.played||"—")+(detail.loss>0?' · perte estimée '+Math.round(detail.loss)+' centipions':' · choix proche du meilleur coup')+'</span><small><i class="arrow-key best-key"></i> Meilleur coup <i class="arrow-key played-key"></i> Coup joué</small></div>':"";
 const clearButton=manualHighlights.size?'<button type="button" class="clear-highlights" data-clear-highlights="1">Effacer les surbrillances</button>':'';
 $("game-replay-area").innerHTML='<article class="surface replay-card" id="active-game-review"><div class="surface-heading"><div><p class="eyebrow">RELECTURE DE TA PARTIE</p><h3>Rejouer et comprendre</h3><p class="muted">'+esc(active.date||"Partie")+' · '+esc(active.white||"Blancs")+' – '+esc(active.black||"Noirs")+'</p></div><span class="engine-badge '+(analysisMoves.length?"ready":"")+'">'+(analysisMoves.length?"Analyse disponible":"Relecture")+'</span></div><p class="review-position-label">'+esc(label)+' · '+(freeBoard?"position libre":index+' / '+moves.length+' demi-coups')+'</p><div class="replay-layout"><div class="replay-board-column"><div class="replay-board-wrap">'+evalMarkup+'<div class="replay-board">'+cells+arrows+'</div></div>'+controls+clearButton+analysisPanel+pvPanel+'</div>'+coachPanel+'</div><div class="review-action"><div><strong>Analyse de tes coups</strong><p>'+(analysisMoves.length?"Le coach suit maintenant automatiquement le coup affiché sur l’échiquier.":"Stockfish va comparer tes décisions et proposer le meilleur coup dans chaque position.")+'</p></div><button type="button" class="primary-button" id="review-run-analysis">'+(analysisMoves.length?"Relancer l’analyse Stockfish":"Analyser avec Stockfish")+'</button></div></article>';
 $("game-replay-area").querySelectorAll(".chess-piece-image").forEach(img=>img.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="piece";fallback.textContent=img.alt;img.replaceWith(fallback);},{once:true}));
 $("review-run-analysis").addEventListener("click",()=>{const id=active.id;const select=$("analysis-game-select");if(select)select.value=String(id);if(window.CoachAnalysis?.analyze)window.CoachAnalysis.analyze(id);else window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:id}}));});
}
function open(id){
 document.querySelector('[data-tab="training"]')?.click();
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(id));
 if(!game){$("game-replay-area").innerHTML='<div class="empty-state">Partie introuvable dans les données de cet appareil.</div>';return false;}
 if(!game.pgn){$("game-replay-area").innerHTML='<div class="empty-state">Le PGN de cette partie est absent. Réimporte-la pour la rejouer.</div>';return false;}
 try{const c=new Chess();c.loadPgn(game.pgn);moves=c.history({verbose:true});if(!moves.length)throw new Error("Aucun coup lisible dans le PGN.");active=game;index=0;analysisMoves=game.analysis?.moves||[];activeAnalysisMove=null;variationIndex=0;freeBoard=null;freeSelected=null;manualHighlights.clear();const s=$("analysis-game-select");if(s)s.value=String(game.id);$("analysis-results").innerHTML='<div class="empty-state compact">La relecture est prête. Parcours les coups, puis lance l’analyse moteur pour obtenir les meilleurs coups.</div>';$("lesson-area").innerHTML="";render();$("active-game-review")?.scrollIntoView({behavior:"smooth",block:"start"});return true;}
 catch(e){$("game-replay-area").innerHTML='<div class="empty-state">Impossible de lire cette partie : '+esc(e.message)+'</div>';return false;}
}
function setAnalysis(list,game){
 if(game)active=game;
 analysisMoves=list||[];
 activeAnalysisMove=null;variationIndex=0;freeBoard=null;freeSelected=null;manualHighlights.clear();
 if(active)active.analysis=active.analysis||{};
 if(active)index=0;
 render();
}
function showAnalysisMove(move){
 activeAnalysisMove=move;index=move.ply;variationIndex=0;freeBoard=null;freeSelected=null;render();
 $("active-game-review")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}
let moveAudioContext=null;
function playMoveSound(direction,capture=false){
 try{
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
  if(!moveAudioContext)moveAudioContext=new AudioCtx();
  const ctx=moveAudioContext;if(ctx.state==="suspended")ctx.resume();
  const duration=capture?0.105:0.07;
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){const fade=1-i/data.length;data[i]=(Math.random()*2-1)*fade*fade;}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  source.buffer=buffer;filter.type="bandpass";filter.frequency.value=capture?520:1050;filter.Q.value=0.8;
  gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(direction<0?0.035:0.065,ctx.currentTime+0.004);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration);
  source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();source.stop(ctx.currentTime+duration);
 }catch(error){console.debug("Son des coups indisponible",error);}
}
function handleFreeSquare(square){
 const sq=square.dataset.square,piece=freeBoard.get(sq);
 if(!freeSelected){
  if(piece&&piece.color===freeBoard.turn()){freeSelected=sq;render();}
  return;
 }
 if(piece&&piece.color===freeBoard.turn()){freeSelected=sq;render();return;}
 const legal=freeBoard.moves({square:freeSelected,verbose:true}).find(m=>m.to===sq);
 if(!legal){freeSelected=null;render();return;}
 try{freeBoard.move({from:freeSelected,to:sq,promotion:"q"});freeSelected=null;playMoveSound(1,!!legal.captured);render();}
 catch{freeSelected=null;render();}
}
document.addEventListener("click",e=>{
 const pvStep=e.target.closest("[data-pv-step]");
 if(pvStep&&currentDetail()&&!freeBoard){variationIndex=Math.max(0,Math.min((activeAnalysisMove.pvUci||[]).length,Number(pvStep.dataset.pvStep)||0));render();return;}
 if(e.target.closest("[data-free-start]")){
  const displayed=new Chess();if(activeAnalysisMove&&variationIndex>0){displayed.load(activeAnalysisMove.fen);for(const uci of (activeAnalysisMove.pvUci||[]).slice(0,variationIndex))displayed.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}
  else{for(let i=0;i<index;i++){const m=moves[i];displayed.move({from:m.from,to:m.to,promotion:m.promotion});}}
  freeStartFen=displayed.fen();freeBoard=displayed;freeSelected=null;render();return;
 }
 if(e.target.closest("[data-free-undo]")&&freeBoard){freeBoard.undo();freeSelected=null;render();return;}
 if(e.target.closest("[data-free-reset]")&&freeBoard){freeBoard=new Chess(freeStartFen);freeSelected=null;render();return;}
 if(e.target.closest("[data-free-exit]")){freeBoard=null;freeSelected=null;render();return;}
 if(e.target.closest("[data-clear-highlights]")){manualHighlights.clear();render();return;}
 const square=e.target.closest(".replay-square[data-square]");
 if(square&&active){if(freeBoard){handleFreeSquare(square);return;}const name=square.dataset.square;if(manualHighlights.has(name))manualHighlights.delete(name);else manualHighlights.add(name);render();return;}
 const step=e.target.closest("[data-review-step]");
 if(step&&active&&!freeBoard){const next=Math.max(0,Math.min(moves.length,index+Number(step.dataset.reviewStep)));if(next!==index){activeAnalysisMove=null;variationIndex=0;index=next;playMoveSound(Number(step.dataset.reviewStep));render();}return;}
 if(e.target.closest("[data-review-start]")&&active&&!freeBoard){if(index!==0){activeAnalysisMove=null;variationIndex=0;index=0;playMoveSound(-1);render();}return;}
 if(e.target.closest("[data-review-end]")&&active&&!freeBoard){if(index!==moves.length){activeAnalysisMove=null;variationIndex=0;index=moves.length;playMoveSound(1);render();}}
});
window.CoachReview={open,setAnalysis,showAnalysisMove};
window.addEventListener("coach:review-game",event=>open(event.detail?.gameId));
