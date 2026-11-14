import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let active=null,moves=[],index=0;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
function render(){
 if(!active)return;const b=new Chess();for(let i=0;i<index;i++){const m=moves[i];b.move({from:m.from,to:m.to,promotion:m.promotion});}
 let cells="";b.board().forEach((rank,r)=>rank.forEach((p,f)=>{cells+='<div class="replay-square '+(((r+f)%2)?"light":"dark")+'">'+(p?'<span class="piece">'+glyph[p.color+p.type]+'</span>':'')+'</div>';}));
 const last=index?moves[index-1]:null,label=last?("Coup "+Math.ceil(index/2)+" · "+last.san):"Position initiale";
 $("game-replay-area").innerHTML='<article class="surface replay-card" id="active-game-review"><div class="surface-heading"><div><p class="eyebrow">RELECTURE DE TA PARTIE</p><h3>Rejouer et comprendre</h3><p class="muted">'+esc(active.date||"Partie")+' · '+esc(active.white||"Blancs")+' – '+esc(active.black||"Noirs")+'</p></div><span class="engine-badge">Relecture indépendante</span></div><p class="review-position-label">'+esc(label)+' · '+index+' / '+moves.length+' demi-coups</p><div class="replay-layout"><div class="replay-board">'+cells+'</div><div class="replay-controls"><button class="secondary-button" data-review-step="-1" '+(index===0?"disabled":"")+'>← Précédent</button><button class="primary-button" data-review-step="1" '+(index===moves.length?"disabled":"")+'>Suivant →</button><button class="secondary-button" data-review-start="1">Revenir au début</button><button class="secondary-button" data-review-end="1">Aller à la fin</button><div class="review-action"><strong>Analyse de tes coups</strong><p>Stockfish examinera tes décisions, indiquera les meilleurs coups et signalera les imprécisions, erreurs et gaffes.</p><button type="button" class="primary-button" id="review-run-analysis">Analyser avec Stockfish</button></div></div></div></article>';
 $("review-run-analysis").addEventListener("click",()=>{const id=active.id;const select=$("analysis-game-select");if(select)select.value=String(id);if(window.CoachAnalysis?.analyze)window.CoachAnalysis.analyze(id);else window.dispatchEvent(new CustomEvent("coach:analyze-game",{detail:{gameId:id}}));});
 $("active-game-review").scrollIntoView({behavior:"smooth",block:"start"});
}
function open(id){
 document.querySelector('[data-tab="training"]')?.click();
 const game=(window.CoachApp?.getGames?.()||[]).find(g=>String(g.id)===String(id));
 if(!game){$("analysis-results").innerHTML='<div class="empty-state">Partie introuvable dans les données de cet appareil.</div>';return false;}
 if(!game.pgn){$("game-replay-area").innerHTML='<div class="empty-state">Le PGN de cette partie est absent. Réimporte-la pour la rejouer.</div>';return false;}
 try{const c=new Chess();c.loadPgn(game.pgn);moves=c.history({verbose:true});if(!moves.length)throw new Error("Aucun coup lisible dans le PGN.");active=game;index=0;const s=$("analysis-game-select");if(s)s.value=String(game.id);$("analysis-results").innerHTML='<div class="empty-state compact">La relecture est prête. Tu peux parcourir les coups ci-dessus, puis lancer l’analyse moteur quand tu le souhaites.</div>';$("lesson-area").innerHTML="";render();return true;}
 catch(e){$("game-replay-area").innerHTML='<div class="empty-state">Impossible de lire cette partie : '+esc(e.message)+'</div>';return false;}
}
document.addEventListener("click",e=>{const s=e.target.closest("[data-review-step]");if(s&&active){index=Math.max(0,Math.min(moves.length,index+Number(s.dataset.reviewStep)));render();return;}if(e.target.closest("[data-review-start]")&&active){index=0;render();return;}if(e.target.closest("[data-review-end]")&&active){index=moves.length;render();}});
window.CoachReview={open};
window.addEventListener("coach:review-game",event=>open(event.detail?.gameId));
