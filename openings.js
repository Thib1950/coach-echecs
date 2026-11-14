import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";
const $=id=>document.getElementById(id),USER="gone_1950";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let database=[],dbError="",groups=[],currentKey=null,exercise=null;
const FR=[[/Sicilian Defense/gi,"Défense sicilienne"],[/French Defense/gi,"Défense française"],[/Caro-Kann Defense/gi,"Défense Caro-Kann"],[/King's Indian Defense/gi,"Défense est-indienne"],[/Queen's Gambit/gi,"Gambit dame"],[/King's Gambit/gi,"Gambit roi"],[/Ruy Lopez/gi,"Partie espagnole"],[/Italian Game/gi,"Partie italienne"],[/Scotch Game/gi,"Partie écossaise"],[/English Opening/gi,"Ouverture anglaise"],[/Scandinavian Defense/gi,"Défense scandinave"],[/Alekhine's Defense/gi,"Défense Alekhine"],[/Pirc Defense/gi,"Défense Pirc"],[/Dutch Defense/gi,"Défense hollandaise"],[/Slav Defense/gi,"Défense slave"],[/Nimzo-Indian Defense/gi,"Défense nimzo-indienne"],[/Grünfeld Defense/gi,"Défense Grünfeld"],[/Benoni Defense/gi,"Défense Benoni"],[/Reti Opening/gi,"Ouverture Réti"],[/Opening/gi,"Ouverture"],[/Defense/gi,"Défense"],[/Gambit/gi,"Gambit"],[/Variation/gi,"Variante"],[/Attack/gi,"Attaque"],[/Accepted/gi,"accepté"],[/Declined/gi,"refusé"],[/Exchange/gi,"d'échange"],[/Classical/gi,"classique"],[/System/gi,"système"]];
function frenchName(name){let s=name||"Ouverture non classée";for(const [re,to] of FR)s=s.replace(re,to);return s;}
function familyName(name){return frenchName(String(name||"Ouverture non classée").split(/\s*[:–—]\s*/)[0].trim());}
function gameMoves(game){try{const c=new Chess();c.loadPgn(game.pgn||"");return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function parseLine(pgn){try{const c=new Chess();c.loadPgn(pgn);return c.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||""));}catch{return [];}}
function validEco(v){return (String(v||"").match(/\b([A-E]\d{2})\b/i)||[])[1]?.toUpperCase()||"";}
function outcome(g){const w=(g.white||"").toLowerCase()===USER,b=(g.black||"").toLowerCase()===USER;if(g.result==="1/2-1/2")return "draw";if((w&&g.result==="1-0")||(b&&g.result==="0-1"))return "win";if((w&&g.result==="0-1")||(b&&g.result==="1-0"))return "loss";return "unknown";}
function sideOf(g){return (g.white||"").toLowerCase()===USER?"white":"black";}
function sanLine(uci){const c=new Chess(),out=[];for(let i=0;i<uci.length;i++){const m=c.moves({verbose:true}).find(x=>x.from+x.to+(x.promotion||"")===uci[i]);if(!m)break;c.move({from:m.from,to:m.to,promotion:m.promotion});out.push((i%2===0?(Math.floor(i/2)+1)+". ":"")+m.san);}return out.join(" ");}
async function loadDatabase(){
 const cached=localStorage.getItem("coach-echecs-openings-db-v1");
 if(cached){try{database=JSON.parse(cached);return;}catch{}}
 try{
  const letters=["a","b","c","d","e"];
  const files=await Promise.all(letters.map(async letter=>{const res=await fetch("https://raw.githubusercontent.com/lichess-org/chess-openings/master/"+letter+".tsv");if(!res.ok)throw new Error("Base des ouvertures indisponible");return await res.text();}));
  const all=[];
  for(const file of files)for(const row of file.split(/\r?\n/)){const [eco,name,pgn]=row.split("\t");if(!eco||!name||!pgn||eco.toLowerCase()==="eco")continue;const moves=parseLine(pgn);if(moves.length)all.push({eco,name,display:frenchName(name),family:familyName(name),moves,pgn});}
  database=all;try{localStorage.setItem("coach-echecs-openings-db-v1",JSON.stringify(database));}catch{}
 }catch(e){dbError=e.message||"Dictionnaire indisponible";}
}
function classify(game){
 const moves=gameMoves(game);let best=null;
 for(const item of database){if(!item.moves.length||item.moves.length>moves.length)continue;let ok=true;for(let i=0;i<item.moves.length;i++)if(item.moves[i]!==moves[i]){ok=false;break;}if(ok&&(!best||item.moves.length>best.moves.length))best=item;}
 if(best)return best;
 const header=(game.opening||"").trim(),eco=validEco(game.eco);
 if(header)return {eco,name:header,display:frenchName(header),family:familyName(header),moves:[],pgn:""};
 if(eco){const item=database.filter(x=>x.eco===eco).sort((a,b)=>b.moves.length-a.moves.length)[0];if(item)return item;}
 return {eco:"",name:"Ouverture non classée",display:"Ouverture non identifiée",family:"Ouverture non identifiée",moves:[],pgn:""};
}
function buildGroups(){
 const map=new Map(),games=window.CoachApp?.getGames?.()||[];
 for(const game of games){
  const op=classify(game),key=op.family;
  if(!map.has(key))map.set(key,{key,family:op.family,games:[],variants:new Map(),white:0,black:0,wins:0,draws:0,losses:0});
  const group=map.get(key);group.games.push(game);const side=sideOf(game);group[side]++;
  const result=outcome(game);if(result==="win")group.wins++;if(result==="draw")group.draws++;if(result==="loss")group.losses++;
  const variantName=op.display===op.family?"Ligne principale":op.display;
  if(!group.variants.has(variantName))group.variants.set(variantName,{name:variantName,count:0,book:op.moves?.length?op:null,games:[]});
  const variant=group.variants.get(variantName);variant.count++;variant.games.push(game);if(op.moves?.length&&(!variant.book||op.moves.length>variant.book.moves.length))variant.book=op;
 }
 groups=[...map.values()].sort((a,b)=>b.games.length-a.games.length);
}
function render(){
 buildGroups();const filter=$("opening-color-filter")?.value||"all";
 const rows=groups.map(g=>{const games=g.games.filter(x=>filter==="all"||sideOf(x)===filter);return {...g,shown:games.length,shownGames:games,w:games.filter(x=>outcome(x)==="win").length,d:games.filter(x=>outcome(x)==="draw").length,l:games.filter(x=>outcome(x)==="loss").length,white:games.filter(x=>sideOf(x)==="white").length,black:games.filter(x=>sideOf(x)==="black").length};}).filter(g=>g.shown).sort((a,b)=>b.shown-a.shown);
 $("opening-table").innerHTML=rows.length?rows.map(g=>'<div class="opening-family-row"><div class="opening-family-main"><strong>'+esc(g.family)+'</strong><small>Blancs : '+g.white+' partie(s) · Noirs : '+g.black+' partie(s)</small></div><div class="opening-family-stats"><b>'+g.shown+' partie(s)</b><small>V / N / D : '+g.w+' / '+g.d+' / '+g.l+'</small></div><button type="button" class="opening-family-button" data-opening-family="'+esc(g.key)+'">Étudier →</button></div>').join(""):'<div class="empty-state">'+(dbError?"Les noms d'ouvertures n'ont pas pu être chargés. Vérifie ta connexion puis rouvre cet onglet.":"Aucune ouverture reconnue dans tes parties importées.")+'</div>';
 if(currentKey){const g=groups.find(x=>x.key===currentKey);if(g)renderDetail(g);}
}
function renderDetail(g){
 currentKey=g.key;exercise=null;
 const variants=[...g.variants.values()].sort((a,b)=>b.count-a.count);
 const variantsHtml=variants.map((v,i)=>'<div class="opening-variant-row"><div><strong>'+esc(v.name)+'</strong><small>'+v.count+' partie(s) · '+esc(v.book?.eco||"Variante issue de tes parties")+'</small></div><button type="button" data-opening-exercise="'+i+'">Travailler cette ligne</button></div>').join("");
 $("opening-detail").innerHTML='<article class="surface opening-detail-card"><div class="surface-heading"><div><p class="eyebrow">OUVERTURE À TRAVAILLER</p><h3>'+esc(g.family)+'</h3><p class="muted">'+g.games.length+' partie(s) dans ton historique · '+g.white+' avec les Blancs · '+g.black+' avec les Noirs</p></div><button class="text-button" id="close-opening-detail">Fermer ✕</button></div><div class="opening-variants"><h4>Variantes repérées dans tes parties</h4>'+variantsHtml+'</div><div id="opening-practice"></div></article>';
 $("close-opening-detail").addEventListener("click",()=>{$("opening-detail").innerHTML="";currentKey=null;exercise=null;});
 $("opening-detail").querySelectorAll("[data-opening-exercise]").forEach(button=>button.addEventListener("click",()=>startExercise(g,variants[Number(button.dataset.openingExercise)])));
 $("opening-detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function startExercise(group,variant){
 const game=variant.games.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
 let line=variant.book?.moves?.slice()||gameMoves(game||{});
 if(!line.length){$("opening-practice").innerHTML='<p class="muted">La suite de coups n’est pas disponible pour cette variante.</p>';return;}
 const filter=$("opening-color-filter").value;
 const whiteCount=group.games.filter(g=>sideOf(g)==="white").length,blackCount=group.games.length-whiteCount;
 const side=filter==="white"?"w":filter==="black"?"b":(whiteCount>=blackCount?"w":"b");
 let board=new Chess(),ply=0,selected=null,feedback="Choisis une pièce puis une case. Je te guide dans la ligne d’ouverture que tu as jouée.";
 const applyOpponentMoves=()=>{while(ply<line.length&&board.turn()!==side){const u=line[ply++];try{board.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});}catch{break;}}};
 applyOpponentMoves();
 const root=$("opening-practice");
 const draw=()=>{
  const files=side==="w"?["a","b","c","d","e","f","g","h"]:["h","g","f","e","d","c","b","a"];
  const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const legal=selected?board.moves({square:selected,verbose:true}):[],targets=new Map(legal.map(m=>[m.to,m.captured?"capture":"move"]));
  let cells="";
  ranks.forEach((rank,r)=>files.forEach((file,f)=>{
   const sq=file+rank,p=board.get(sq),light=((rank-1+(file.charCodeAt(0)-97))%2)===1,classes=["opening-square",light?"light":"dark"];
   if(selected===sq)classes.push("selected");if(targets.has(sq))classes.push(targets.get(sq)==="capture"?"capture-target":"legal-target");
   const coords=(f===0?'<span class="opening-rank-coordinate">'+rank+'</span>':"")+(r===7?'<span class="opening-file-coordinate">'+file.toUpperCase()+'</span>':"");
   cells+='<button type="button" class="'+classes.join(" ")+'" data-opening-square="'+sq+'" aria-label="'+sq+'">'+(p?'<img class="chess-piece-image" src="https://lichess1.org/assets/piece/cburnett/'+(p.color==="w"?"w":"b")+p.type.toUpperCase()+'.svg" alt="'+p.type+'">':"")+coords+(targets.has(sq)&&targets.get(sq)==="move"?'<i class="opening-legal-dot"></i>':"")+'</button>';
  }));
  const done=ply>=line.length;
  root.innerHTML='<div class="opening-practice-layout"><div class="opening-practice-board">'+cells+'</div><aside class="opening-practice-coach"><div class="coach-avatar">♞</div><p class="eyebrow">TON COACH</p><h4>'+esc(group.family)+'</h4><strong>'+(done?"Exercice terminé !":"À toi de jouer")+'</strong><p>'+esc(done?"Bravo, tu as parcouru toute la ligne d’ouverture. Tu peux recommencer pour la mémoriser.":feedback)+'</p><small>Joue les coups avec les pièces et les points de destination, comme dans l’onglet Entraînement.</small><button type="button" data-opening-reset>Recommencer</button></aside></div>';
 };
 root.onclick=event=>{
  if(event.target.closest("[data-opening-reset]")){board=new Chess();ply=0;selected=null;feedback="Recommence la ligne : trouve le coup de développement attendu.";applyOpponentMoves();draw();return;}
  const button=event.target.closest("[data-opening-square]");if(!button||ply>=line.length)return;
  const square=button.dataset.openingSquare,piece=board.get(square);
  if(!selected){if(piece&&piece.color===side){selected=square;draw();}return;}
  if(piece&&piece.color===side){selected=square;draw();return;}
  const move=board.moves({square:selected,verbose:true}).find(m=>m.to===square);
  if(!move){selected=null;draw();return;}
  const uci=move.from+move.to+(move.promotion||"");
  if(uci!==line[ply]){feedback="Ce coup est légal, mais il ne correspond pas à la suite de cette variante. Cherche un autre coup de développement.";selected=null;draw();return;}
  board.move({from:move.from,to:move.to,promotion:move.promotion});ply++;selected=null;
  feedback="Bien joué ! Le coup est conforme à cette ligne. Continue à développer tes pièces et à contrôler le centre.";
  applyOpponentMoves();draw();
 };
 draw();
}
document.addEventListener("click",event=>{const button=event.target.closest("[data-opening-family]");if(button){const g=groups.find(x=>x.key===button.dataset.openingFamily);if(g)renderDetail(g);}});
$("opening-color-filter")?.addEventListener("change",render);
window.addEventListener("coach:games-updated",()=>{if($("panel-openings")?.classList.contains("active"))render();});
loadDatabase().then(render);render();
