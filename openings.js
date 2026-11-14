import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id);
const USER="gone_1950";
let database=[],dbReady=false,dbError="",groups=[],currentDetail=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FR=[[/Sicilian Defense/gi,"Défense sicilienne"],[/French Defense/gi,"Défense française"],[/Caro-Kann Defense/gi,"Défense Caro-Kann"],[/King's Indian Defense/gi,"Défense est-indienne"],[/Queen's Gambit/gi,"Gambit dame"],[/King's Gambit/gi,"Gambit roi"],[/Ruy Lopez/gi,"Partie espagnole"],[/Italian Game/gi,"Partie italienne"],[/English Opening/gi,"Ouverture anglaise"],[/Scandinavian Defense/gi,"Défense scandinave"],[/Alekhine's Defense/gi,"Défense Alekhine"],[/Pirc Defense/gi,"Défense Pirc"],[/Dutch Defense/gi,"Défense hollandaise"],[/Slav Defense/gi,"Défense slave"],[/Nimzo-Indian Defense/gi,"Défense nimzo-indienne"],[/Grünfeld Defense/gi,"Défense Grünfeld"],[/Benoni Defense/gi,"Défense Benoni"],[/Reti Opening/gi,"Ouverture Réti"],[/Opening/gi,"Ouverture"],[/Defense/gi,"Défense"],[/Gambit/gi,"Gambit"],[/Variation/gi,"Variante"],[/Attack/gi,"Attaque"],[/Accepted/gi,"accepté"],[/Declined/gi,"refusé"],[/Exchange/gi,"d'échange"],[/Classical/gi,"classique"],[/System/gi,"système"]];
function frenchName(name){let s=name||"Ouverture non classée";for(const [re,to] of FR)s=s.replace(re,to);return s;}
function parseLine(pgn){try{const c=new Chess();c.loadPgn(pgn);return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
async function loadDatabase(){
 const cached=localStorage.getItem("coach-echecs-openings-db-v1");
 if(cached){try{database=JSON.parse(cached);dbReady=true;return;}catch{}}
 try{
  const letters=["a","b","c","d","e"],all=[];
  for(const letter of letters){
   const res=await fetch("https://raw.githubusercontent.com/lichess-org/chess-openings/master/"+letter+".tsv");
   if(!res.ok)throw new Error("Base des ouvertures indisponible");
   const rows=(await res.text()).split(/\r?\n/);
   for(const row of rows){const [eco,name,pgn]=row.split("\t");if(!eco||!name||!pgn||eco.toLowerCase()==="eco")continue;const moves=parseLine(pgn);if(moves.length)all.push({eco,name,pgn,moves});}
  }
  database=all;
  try{localStorage.setItem("coach-echecs-openings-db-v1",JSON.stringify(database));}catch{}
  dbReady=true;
 }catch(e){dbError=e.message||"Chargement impossible";dbReady=true;}
}
function gameMoves(game){try{const c=new Chess();c.loadPgn(game.pgn||"");return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function sanLine(uciMoves,limit=10){
 const board=new Chess(),out=[];
 for(let i=0;i<Math.min(uciMoves.length,limit);i++){
  const u=uciMoves[i],legal=board.moves({verbose:true}),m=legal.find(x=>x.from+x.to+(x.promotion||"")===u);
  if(!m)break;
  board.move({from:m.from,to:m.to,promotion:m.promotion});
  out.push((i%2===0?(Math.floor(i/2)+1)+". ":"")+m.san);
 }
 return out.join(" ");
}
function validEco(value){const m=String(value||"").match(/\b([A-E]\d{2})\b/i);return m?m[1].toUpperCase():"";}
function compatibleEco(name,eco){
 if(!eco)return false;
 const n=String(name||"").toLowerCase();
 if(n.includes("french")||n.includes("française"))return /^C(0[0-9]|1[0-9])$/.test(eco);
 if(n.includes("sicilian")||n.includes("sicilienne"))return /^B(2[0-9]|3[0-9])$/.test(eco);
 if(n.includes("caro-kann"))return /^B1[0-9]$/.test(eco);
 if(n.includes("ruy lopez")||n.includes("spanish")||n.includes("espagnole"))return /^C[6-9][0-9]$/.test(eco);
 if(n.includes("italian")||n.includes("italienne"))return /^C5[0-9]$/.test(eco);
 return true;
}
function classify(game){
 const moves=gameMoves(game);let best=null;
 for(const item of database){
  if(!item.moves.length||item.moves.length>moves.length)continue;
  let ok=true;
  for(let i=0;i<item.moves.length;i++)if(item.moves[i]!==moves[i]){ok=false;break;}
  if(ok&&(!best||item.moves.length>best.moves.length))best=item;
 }
 if(best)return {...best,display:frenchName(best.name),source:"database"};
 const headerName=(game.opening||"").trim(),eco=validEco(game.eco);
 if(headerName){
  const candidates=database.filter(x=>x.name.toLowerCase()===headerName.toLowerCase());
  const headerEco=candidates.find(x=>compatibleEco(headerName,x.eco))?.eco||"";
  const safeEco=compatibleEco(headerName,eco)?eco:headerEco;
  return {eco:safeEco,name:headerName,display:frenchName(headerName),moves:[],pgn:"",source:"pgn"};
 }
 if(eco){
  const candidates=database.filter(x=>x.eco===eco).sort((a,b)=>b.moves.length-a.moves.length);
  if(candidates[0])return {...candidates[0],display:frenchName(candidates[0].name),source:"eco"};
 }
 return {eco:"",name:"Ouverture non classée",display:"Ouverture non identifiée",moves:[],pgn:"",source:"unknown"};
}
function result(g){const white=(g.white||"").toLowerCase()===USER,black=(g.black||"").toLowerCase()===USER;if(g.result==="1/2-1/2")return "draw";if((white&&g.result==="1-0")||(black&&g.result==="0-1"))return "win";if((white&&g.result==="0-1")||(black&&g.result==="1-0"))return "loss";return "unknown";}
function buildGroups(){
 const games=window.CoachApp?.getGames?.()||[],map=new Map();
 for(const game of games){
  const op=classify(game),key=(op.eco||"")+"|"+op.display;
  if(!map.has(key))map.set(key,{...op,key,games:[],wins:0,draws:0,losses:0,white:0,black:0});
  const g=map.get(key);g.games.push(game);const r=result(game);if(r==="win")g.wins++;if(r==="draw")g.draws++;if(r==="loss")g.losses++;
  if((game.white||"").toLowerCase()===USER)g.white++;else if((game.black||"").toLowerCase()===USER)g.black++;
 }
 groups=[...map.values()].map(g=>({...g,count:g.games.length,decided:g.wins+g.draws+g.losses,score:(g.wins+g.draws/2)/(g.wins+g.draws+g.losses||1)*100})).sort((a,b)=>b.count-a.count);
}
function render(){
 buildGroups();
 const n=groups.length,played=groups.reduce((s,g)=>s+g.count,0);
 $("opening-count").textContent=n;
 const main=groups[0];$("opening-main").textContent=main?main.display:"—";$("opening-main-count").textContent=main?main.count+" partie(s) · "+(main.eco||"ECO non fourni"):"Aucune ouverture reconnue";
 const qualified=groups.filter(g=>g.count>=3&&g.decided>=3);
 const best=qualified.slice().sort((a,b)=>b.score-a.score)[0],weak=qualified.slice().sort((a,b)=>a.score-b.score)[0];
 $("opening-best").textContent=best?Math.round(best.score)+" %":"—";$("opening-best-name").textContent=best?best.display+" · "+best.count+" parties":"Minimum 3 parties pour comparer";
 const filter=$("opening-color-filter").value;
 const rows=groups.map(g=>{const subset=filter==="all"?g.games:g.games.filter(x=>((x.white||"").toLowerCase()===USER?"white":"black")===filter);const w=subset.filter(x=>result(x)==="win").length,d=subset.filter(x=>result(x)==="draw").length,l=subset.filter(x=>result(x)==="loss").length;return {...g,shown:subset.length,w,d,l,score:(w+d/2)/(w+d+l||1)*100};}).filter(g=>g.shown).sort((a,b)=>b.shown-a.shown);
 $("opening-table").innerHTML=!dbError&&!dbReady?'<div class="empty-state">Chargement du dictionnaire des ouvertures…</div>':rows.length?'<div class="opening-head"><span>OUVERTURE / ECO</span><span>PARTIES</span><span>V / N / D</span><span>SCORE</span></div>'+rows.slice(0,40).map(g=>'<div class="opening-row"><strong>'+esc(g.display)+'<small class="opening-eco">'+esc(g.eco?"Code ECO : "+g.eco:"Code ECO non fourni")+'</small><small class="opening-preview">'+esc(sanLine(gameMoves(g.games[0]||{}),8))+'</small></strong><span>'+g.shown+'<small class="opening-eco">B '+g.white+' · N '+g.black+'</small></span><span>'+g.w+' / '+g.d+' / '+g.l+'</span><span class="score-cell">'+Math.round(g.score)+' %<button class="opening-detail-button" data-opening="'+esc(g.key)+'">Travailler →</button></span></div>').join(""):'<div class="empty-state">Aucune ouverture détectée dans les parties. Les PGN restent conservés ; vérifie qu’ils contiennent bien les coups.</div>';
 if(dbError)$("opening-table").insertAdjacentHTML("afterbegin",'<p class="small muted">Dictionnaire complet indisponible : affichage des informations présentes dans tes PGN. '+esc(dbError)+'</p>');
 if(weak&&$("opening-best-name"))$("opening-best-name").title="Ouverture à travailler en priorité : "+weak.display+" ("+Math.round(weak.score)+" % sur "+weak.count+" parties).";
 if(currentDetail){const still=groups.find(g=>g.key===currentDetail);if(still)renderDetail(still);}
}
function renderDetail(g){
 currentDetail=g.key;
 const line=esc(sanLine(gameMoves(g.games[0]||{}),14)||g.pgn||"Séquence de coups non disponible.");
 const examples=g.games.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
 const lessons=[];
 examples.forEach(game=>(game.analysis?.moves||[]).forEach((m,i)=>{if(m.moveNo<=12&&m.kind!=="good")lessons.push({game,move:m,index:i});}));
 $("opening-detail").innerHTML='<article class="surface opening-detail-card"><div class="surface-heading"><div><p class="eyebrow">FICHE OUVERTURE</p><h3>'+esc(g.display)+'</h3><p class="muted">Code ECO '+esc(g.eco||"non disponible")+' · '+g.count+' partie(s) · score '+Math.round(g.score)+' %</p></div><button class="text-button" id="close-opening-detail">Fermer ✕</button></div><div class="opening-detail-stats"><span>Avec les Blancs : <b>'+g.white+'</b></span><span>Avec les Noirs : <b>'+g.black+'</b></span><span>V / N / D : <b>'+g.wins+'/'+g.draws+'/'+g.losses+'</b></span></div><p class="small muted">Le code ECO est une classification internationale qui identifie la famille et la variante d’une ouverture.</p><h4>Échiquier d’exploration indépendant</h4><div id="opening-board"></div><h4>Début de partie · coups joués</h4><p class="opening-line">'+line+'</p><h4>Leçons tirées de tes parties</h4>'+(lessons.length?lessons.slice(0,8).map(x=>'<div class="opening-exercise"><span>'+esc(x.game.date||"Partie")+' · coup '+x.move.moveNo+' · '+esc(x.move.label)+'</span><button class="lesson-launch" data-opening-lesson="'+esc(x.game.id)+'" data-move-index="'+x.index+'">Faire cet exercice →</button></div>').join(""):'<p class="muted">Aucune erreur analysée pour cette ouverture pour le moment. Les exercices apparaîtront ici et se travailleront directement sur cet échiquier.</p>')+'<h4>Tes parties dans cette ouverture</h4>'+examples.slice(0,12).map(game=>'<div class="opening-game"><span>'+esc(game.date||"Date inconnue")+' · '+esc((game.white||"")+" – "+(game.black||""))+'</span><button class="lesson-launch" data-opening-game="'+esc(game.id)+'">Afficher sur l’échiquier →</button></div>').join("")+'</article>';
 $("close-opening-detail").addEventListener("click",()=>{$("opening-detail").innerHTML="";currentDetail=null;});
 const sample=examples[0];if(sample)mountOpeningBoard(sample);
 $("opening-detail").scrollIntoView({behavior:"smooth",block:"start"});
 $("opening-detail").querySelectorAll("[data-opening-game]").forEach(b=>b.addEventListener("click",()=>{const game=(window.CoachApp?.getGames?.()||[]).find(x=>String(x.id)===b.dataset.openingGame);if(game)mountOpeningBoard(game);$("opening-board")?.scrollIntoView({behavior:"smooth",block:"center"});}));
 $("opening-detail").querySelectorAll("[data-opening-lesson]").forEach(b=>b.addEventListener("click",()=>{const game=(window.CoachApp?.getGames?.()||[]).find(x=>String(x.id)===b.dataset.openingLesson);const move=game?.analysis?.moves?.[Number(b.dataset.moveIndex)];if(game)mountOpeningBoard(game,move?.ply||0);$("opening-board")?.scrollIntoView({behavior:"smooth",block:"center"});}));
}
function mountOpeningBoard(game,startPly=0){
 const root=$("opening-board");if(!root)return;
 let history=[];try{const c=new Chess();c.loadPgn(game.pgn||"");history=c.history({verbose:true});}catch{}
 let index=Math.max(0,Math.min(history.length,Number(startPly)||0)),board=new Chess(),selected=null,free=false;
 for(const move of history.slice(0,index))board.move({from:move.from,to:move.to,promotion:move.promotion});
 const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
 const draw=()=>{
  const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));
  let html='<div class="opening-explorer-layout"><div class="opening-explorer-board">';
  for(let rank=8;rank>=1;rank--)for(let fi=0;fi<8;fi++){const file="abcdefgh"[fi],sq=file+rank,p=board.get(sq),light=(rank+fi)%2===1,cls=["opening-square",light?"light":"dark"];if(selected===sq)cls.push("selected");if(targets.has(sq))cls.push(targets.get(sq)==="capture"?"capture-target":"legal-target");html+='<button type="button" class="'+cls.join(" ")+'" data-opening-square="'+sq+'" aria-label="'+sq+'">'+(p?glyph[p.color+p.type]:"")+(targets.has(sq)&&targets.get(sq)==="move"?'<i class="opening-legal-dot"></i>':"")+'</button>';}
  html+='</div><div class="opening-explorer-side"><p class="muted">'+(free?"Mode libre : joue les coups légaux de ton choix.":"Relecture de la partie exemple : avance ou recule dans les coups.")+'</p><strong class="opening-explorer-status">'+(free?"Exploration libre":"Coup "+index+" / "+history.length)+'</strong><div class="opening-explorer-controls"><button type="button" data-opening-prev '+(free||index===0?"disabled":"")+'>←</button><button type="button" data-opening-next '+(free||index>=history.length?"disabled":"")+'>→</button><button type="button" data-opening-free>Mode libre</button><button type="button" data-opening-reset>Réinitialiser</button><button type="button" data-opening-analyze>Analyser la position</button></div><p id="opening-engine-result" class="small muted">Stockfish analysera uniquement quand tu appuieras sur le bouton.</p><p class="small muted">'+(free?"Les coups restent dans cet échiquier et n’affectent pas tes parties importées.":"Sélectionne Mode libre pour essayer tes propres variantes.")+'</p></div></div>';root.innerHTML=html;
 };
 root.onclick=event=>{
  const sq=event.target.closest("[data-opening-square]");
  if(sq){const name=sq.dataset.openingSquare,piece=board.get(name);if(!selected){if(piece&&piece.color===board.turn()){selected=name;draw();}return;}if(piece&&piece.color===board.turn()){selected=name;draw();return;}const move=board.moves({square:selected,verbose:true}).find(m=>m.to===name);if(move){board.move({from:selected,to:name,promotion:"q"});selected=null;free=true;draw();}else{selected=null;draw();}return;}
  if(event.target.closest("[data-opening-prev]")&&!free&&index>0){index--;board=new Chess();for(const m of history.slice(0,index))board.move({from:m.from,to:m.to,promotion:m.promotion});selected=null;draw();return;}
  if(event.target.closest("[data-opening-next]")&&!free&&index<history.length){const m=history[index++];board.move({from:m.from,to:m.to,promotion:m.promotion});selected=null;draw();return;}
  if(event.target.closest("[data-opening-free]")){free=true;selected=null;draw();return;}
  if(event.target.closest("[data-opening-reset]")){board=new Chess();index=0;selected=null;free=false;draw();return;}
  if(event.target.closest("[data-opening-analyze]")){
   const output=root.querySelector("#opening-engine-result"),fen=board.fen();
   if(!window.CoachAnalysis?.analyzePosition){output.textContent="Le moteur n’est pas encore prêt.";return;}
   output.textContent="Stockfish analyse cette position…";
   window.CoachAnalysis.analyzePosition(fen).then(result=>{
    const score=Math.abs(result.scoreWhite)>=9990?(result.scoreWhite>0?"+ mat":"− mat"):(result.scoreWhite>=0?"+":"")+(result.scoreWhite/100).toFixed(1);
    output.textContent="Évaluation (point de vue des Blancs) : "+score+" · Meilleur coup : "+result.bestSan+" · Suite : "+(result.pvSan||[]).join(" ");
   }).catch(error=>{output.textContent=error.message||"Analyse impossible.";});
  }
 };draw();
}
function openGame(id){if(window.CoachReview?.open){window.CoachReview.open(id);return;}window.dispatchEvent(new CustomEvent("coach:review-game",{detail:{gameId:id}}));}
document.addEventListener("click",e=>{const b=e.target.closest("[data-opening]");if(b){const g=groups.find(x=>x.key===b.dataset.opening);if(g)renderDetail(g);}});
$("opening-detail")||$("opening-table").insertAdjacentHTML("afterend",'<div id="opening-detail"></div>');
$("opening-color-filter").addEventListener("change",render);
window.addEventListener("coach:games-updated",()=>{if($("panel-openings")?.classList.contains("active"))render();});
loadDatabase().then(render);
render();
