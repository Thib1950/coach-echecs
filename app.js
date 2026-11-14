const USERNAME = "gone_1950";
const STORAGE_KEY = "coach-echecs-v1";
let games = [];
const $ = (id) => document.getElementById(id);

function readStoredGames(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return []}}
function saveGames(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(games))}catch(e){setMessage("Le stockage du navigateur est plein. Exporte tes parties en PGN pour les conserver.")}}
function setMessage(message){$("sync-message").textContent=message}
function parsePgn(pgn){
  const chunks=pgn.replace(/\r/g,"").split(/(?=\[Event )/g).filter(x=>x.trim());
  return chunks.map((text,i)=>{
    const headers={}; for(const m of text.matchAll(/^\[([^ ]+)\s+"(.*)"\]$/gm)) headers[m[1]]=m[2];
    if(!headers.White&&!headers.Black)return null;
    return {id:headers.Link||headers.UUID||[headers.Date,headers.White,headers.Black,i].join("-"),date:headers.Date||"",white:headers.White||"?",black:headers.Black||"?",result:headers.Result||"*",timeControl:headers.TimeControl||"Non précisé",eco:headers.ECO||"",opening:headers.Opening||"",pgn:text,whiteElo:headers.WhiteElo||"",blackElo:headers.BlackElo||"",url:headers.Link||""};
  }).filter(Boolean);
}
function normalizeGame(g){
  const p=parsePgn(g.pgn||"")[0]||{};
  const ecoMatch=String(g.eco||"").match(/\b([A-E]\d{2})\b/i);
  const ecoCode=p.eco||(ecoMatch?ecoMatch[1].toUpperCase():"");
  return {...p,id:g.url||p.id||String(Math.random()),date:g.end_time?new Date(g.end_time*1000).toISOString().slice(0,10):p.date,white:g.white?.username||p.white,black:g.black?.username||p.black,result:g.white?.result==="win"?"1-0":g.black?.result==="win"?"0-1":(["agreed","repetition","stalemate","insufficient","50move","timevsinsufficient"].includes(g.white?.result)?"1/2-1/2":p.result),timeControl:g.time_control||p.timeControl,eco:ecoCode,opening:g.pgn?.match(/\[Opening "([^"]+)"/)?.[1]||p.opening,pgn:g.pgn||p.pgn,whiteElo:g.white?.rating||p.whiteElo,blackElo:g.black?.rating||p.blackElo,url:g.url||p.url};
}
function outcome(game){
  const me=USERNAME.toLowerCase(), white=(game.white||"").toLowerCase(), black=(game.black||"").toLowerCase();
  if(game.result==="1/2-1/2")return "draw";
  if((white===me&&game.result==="1-0")||(black===me&&game.result==="0-1"))return "win";
  if((white===me&&game.result==="0-1")||(black===me&&game.result==="1-0"))return "loss";
  return "unknown";
}
function userColor(g){return (g.white||"").toLowerCase()===USERNAME.toLowerCase()?"white":(g.black||"").toLowerCase()===USERNAME.toLowerCase()?"black":"unknown"}
function formatDate(d){if(!d)return "Date inconnue";const [y,m,day]=d.split(".").length===3?d.split("."):d.split("-");return day&&m&&y?new Date(Number(y),Number(m)-1,Number(day)).toLocaleDateString("fr-FR"):"Date inconnue"}
function resultLabel(o){return o==="win"?"Victoire":o==="loss"?"Défaite":o==="draw"?"Nulle":"Résultat inconnu"}
function opponent(g){return (g.white||"").toLowerCase()===USERNAME.toLowerCase()?g.black:g.white}
function openingName(g){const name=(g.opening||"").trim();if(name)return name;const eco=(g.eco||"").trim();return eco?"Code ECO "+eco:""}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function groupOpenings(source){const groups=new Map();source.forEach(g=>{const name=openingName(g);if(!name)return;const key=name; if(!groups.has(key))groups.set(key,{name,games:[],wins:0,draws:0,losses:0,white:0,black:0});const x=groups.get(key);x.games.push(g);const o=outcome(g);if(o==="win")x.wins++;if(o==="draw")x.draws++;if(o==="loss")x.losses++;if(userColor(g)==="white")x.white++;if(userColor(g)==="black")x.black++});return [...groups.values()].map(x=>({...x,count:x.games.length,score:(x.wins+x.draws/2)/(x.wins+x.draws+x.losses||1)*100})).sort((a,b)=>b.count-a.count)}
function render(){
  const wins=games.filter(g=>outcome(g)==="win").length, draws=games.filter(g=>outcome(g)==="draw").length, losses=games.filter(g=>outcome(g)==="loss").length;
  $("stat-games").textContent=games.length;$("stat-wins").textContent=wins;$("stat-draws").textContent=draws;$("stat-losses").textContent=losses;
  const decided=wins+draws+losses;$("stat-winrate").textContent=decided?Math.round((wins+draws/2)/decided*100)+" % de score":"En attente de tes parties";
  $("sync-state").textContent="Version publiée · 14/11/2026";
  const sorted=[...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("recent-games").innerHTML=sorted.length?sorted.slice(0,4).map(recentGameHtml).join(""):'<div class="empty-state">Tes parties apparaîtront ici après l’import.</div>';
  renderGames(sorted);renderBars(wins,draws,losses);renderOpenings();renderTraining();
}
function gameHtml(g){
 const o=outcome(g),accuracy=g.analysis?.accuracy;
 const accuracyText=accuracy!==null&&accuracy!==undefined&&Number.isFinite(Number(accuracy))?Math.round(accuracy)+" %":"—";
 const side=userColor(g),opponentElo=side==="white"?g.blackElo:side==="black"?g.whiteElo:"";
 return '<div class="game-row"><div><div class="game-opponent">vs '+escapeHtml(opponent(g)||"Adversaire")+' <span class="opponent-elo">'+(opponentElo?escapeHtml(opponentElo)+" Elo":"Elo —")+'</span></div><div class="game-meta">'+formatDate(g.date)+' · '+escapeHtml(g.timeControl||"Cadence inconnue")+(openingName(g)?" · "+escapeHtml(openingName(g)):"")+'</div><div class="game-elo"><span>Ma précision <b>'+accuracyText+'</b></span></div></div><span class="game-result '+o+'">'+resultLabel(o)+'</span><button type="button" class="lesson-launch" data-open-game="'+escapeHtml(g.id)+'">Revoir / analyser →</button></div>';
}
function recentGameHtml(g){
 const side=userColor(g),opponentElo=side==="white"?g.blackElo:side==="black"?g.whiteElo:"";
 const accuracy=g.analysis?.accuracy;
 const accuracyText=accuracy!==null&&accuracy!==undefined&&Number.isFinite(Number(accuracy))?Math.round(accuracy)+" %":"—";
 return '<div class="recent-game-row"><div class="recent-game-main"><div class="recent-game-opponent">vs '+escapeHtml(opponent(g)||"Adversaire")+' <span class="opponent-elo">'+(opponentElo?escapeHtml(opponentElo)+" Elo":"Elo —")+'</span></div><div class="recent-game-meta">'+formatDate(g.date)+' · '+escapeHtml(g.timeControl||"Cadence inconnue")+'</div></div><div class="recent-game-precision"><span>MA PRÉCISION</span><strong>'+accuracyText+'</strong></div><button type="button" class="recent-review-button" data-open-game="'+escapeHtml(g.id)+'" aria-label="Revoir cette partie">↗</button></div>';
}
function renderGames(sorted){const q=($("game-search").value||"").toLowerCase(),f=$("result-filter").value;const filtered=sorted.filter(g=>(opponent(g)||"").toLowerCase().includes(q)&&(f==="all"||outcome(g)===f));$("games-list").innerHTML=filtered.length?filtered.map(gameHtml).join(""):'<div class="empty-state">Aucune partie ne correspond à ce filtre.</div>'}
function renderBars(w,d,l){const n=w+d+l;if(!n){$("result-bars").innerHTML='<p class="muted">Les statistiques apparaîtront après l’import.</p>';return}const rows=[["Victoires",w],["Nulles",d],["Défaites",l]];$("result-bars").innerHTML=rows.map(([label,v])=>'<div class="bar-item"><span>'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(v/n*100)+'%"></div></div><strong>'+v+'</strong></div>').join("")}
function renderOpenings(){
  const all=groupOpenings(games), qualified=all.filter(x=>x.wins+x.draws+x.losses>0);
  $("opening-count").textContent=all.length;
  const main=all[0];$("opening-main").textContent=main?main.name:"—";$("opening-main-count").textContent=main?main.count+" partie(s)":"Aucune ouverture identifiée";
  const best=qualified.filter(x=>x.count>=3).sort((a,b)=>b.score-a.score)[0];$("opening-best").textContent=best?Math.round(best.score)+" %":"—";$("opening-best-name").textContent=best?best.name:"Minimum 3 parties pour comparer";
  drawOpeningTable();
}
function drawOpeningTable(){
  const color=$("opening-color-filter").value;let data=groupOpenings(games);
  if(color!=="all")data=data.map(x=>{const selected=x.games.filter(g=>userColor(g)===color);const wins=selected.filter(g=>outcome(g)==="win").length,draws=selected.filter(g=>outcome(g)==="draw").length,losses=selected.filter(g=>outcome(g)==="loss").length;return {...x,count:selected.length,wins,draws,losses,score:(wins+draws/2)/(wins+draws+losses||1)*100}}).filter(x=>x.count);
  if(!data.length){$("opening-table").innerHTML='<div class="empty-state">Aucune ouverture identifiée dans les PGN importés. Les parties restent bien enregistrées ; certaines archives ne fournissent simplement pas le nom de l’ouverture.</div>';return}
  $("opening-table").innerHTML='<div class="opening-head"><span>OUVERTURE</span><span>PARTIES</span><span>V / N / D</span><span>SCORE</span></div>'+data.slice(0,25).map(x=>'<div class="opening-row"><strong>'+escapeHtml(x.name)+'</strong><span>'+x.count+'</span><span>'+x.wins+' / '+x.draws+' / '+x.losses+'</span><span class="score-cell">'+Math.round(x.score)+' %</span></div>').join("");
}
function renderTraining(){
  const losses=games.filter(g=>outcome(g)==="loss").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const analyzed=games.filter(g=>!g.analysis?.partial&&Array.isArray(g.analysis?.moves)).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const accuracyForGroup=group=>{
    const values=group.flatMap(g=>(g.analysis?.moves||[]).filter(m=>m.loss!==null&&m.loss!==undefined&&Number.isFinite(Number(m.loss))).map(m=>100*Math.exp(-0.01*Math.sqrt(Math.max(0,Number(m.loss))))));
    return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  };
  const recent=analyzed.slice(0,25),previous=analyzed.slice(25,50);
  const recentAccuracy=recent.length===25?accuracyForGroup(recent):null;
  const previousAccuracy=previous.length===25?accuracyForGroup(previous):null;
  const lossNode=$("training-losses");if(lossNode)lossNode.textContent=losses.length;
  const accuracyNode=$("training-accuracy");if(accuracyNode)accuracyNode.textContent=recentAccuracy===null?"—":Math.round(recentAccuracy)+" %";
  const deltaNode=$("training-accuracy-delta"),countNode=$("training-accuracy-count");
  if(deltaNode){
    if(recentAccuracy!==null&&previousAccuracy!==null){
      const delta=Math.round(recentAccuracy-previousAccuracy);
      deltaNode.textContent=(delta>0?"+":"")+delta+" pts";
      deltaNode.className=delta>0?"trend-up":delta<0?"trend-down":"trend-neutral";
    }else{deltaNode.textContent="—";deltaNode.className="trend-neutral";}
  }
  if(countNode){
    if(recentAccuracy===null)countNode.textContent="Il faut 25 parties entièrement analysées pour calculer cette moyenne.";
    else if(previousAccuracy===null)countNode.textContent="Moyenne de tes 25 dernières parties analysées · encore 25 pour mesurer l’évolution.";
    else countNode.textContent="25 dernières parties comparées aux 25 précédentes.";
  }
  $("training-games").innerHTML=losses.length?losses.slice(0,5).map(g=>'<div class="game-row"><div><div class="game-opponent">Défaite contre '+escapeHtml(opponent(g)||"Adversaire")+'</div><div class="game-meta">'+formatDate(g.date)+' · '+escapeHtml(g.timeControl||"Cadence inconnue")+(openingName(g)?" · "+escapeHtml(openingName(g)):"")+'</div></div>'+'<button type="button" class="lesson-launch" data-open-game="'+escapeHtml(g.id)+'">Analyser cette partie dans le coach →</button>'+'</div>').join(""):'<div class="empty-state">Aucune défaite enregistrée dans les parties importées.</div>';
}
async function syncChessCom(){
  const buttons=[$("sync-button"),$("sync-button-games")];buttons.forEach(b=>{b.disabled=true;b.textContent="Synchronisation…"});
  setMessage("Connexion à l'archive publique Chess.com…");
  try{
    const response=await fetch("https://api.chess.com/pub/player/"+USERNAME+"/games/archives",{headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("Chess.com a répondu "+response.status);
    const archiveData=await response.json(), urls=(archiveData.archives||[]).slice(-3).reverse();
    if(!urls.length)throw new Error("Aucune archive trouvée pour ce compte.");
    let imported=[];
    for(const url of urls){setMessage("Récupération de "+url.split("/").slice(-2).join("/")+"…");const res=await fetch(url,{headers:{"Accept":"application/json"}});if(!res.ok)continue;const data=await res.json();imported=imported.concat((data.games||[]).map(normalizeGame))}
    if(!imported.length)throw new Error("Aucune partie trouvée dans les trois dernières archives.");
    const byId=new Map(games.map(g=>[g.id,g]));imported.forEach(g=>byId.set(g.id,g));games=[...byId.values()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    saveGames();render();setMessage(imported.length+" parties récupérées ou actualisées. Les données sont conservées sur cet appareil.");$("sync-state").textContent="Version publiée · 14/11/2026";
  }catch(e){setMessage("La synchronisation automatique n'a pas abouti : "+e.message+". Tu peux importer un fichier PGN depuis Chess.com.")}
  finally{buttons.forEach((b,i)=>{b.disabled=false;b.textContent=i?"Synchroniser":"Récupérer mes parties"})}
}
function importPgnFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{const added=parsePgn(String(reader.result||""));if(!added.length){setMessage("Je n'ai pas reconnu de parties dans ce fichier PGN.");return}const byId=new Map(games.map(g=>[g.id,g]));added.forEach(g=>byId.set(g.id,g));games=[...byId.values()];saveGames();render();setMessage(added.length+" partie(s) importée(s) depuis le fichier PGN.")};reader.onerror=()=>setMessage("Impossible de lire ce fichier.");reader.readAsText(file)}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab))}));
document.querySelectorAll("[data-goto]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector('[data-tab="'+btn.dataset.goto+'"]').click()));
$("sync-button").addEventListener("click",syncChessCom);$("sync-button-games").addEventListener("click",syncChessCom);$("pgn-file").addEventListener("change",e=>importPgnFile(e.target.files[0]));$("game-search").addEventListener("input",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));$("result-filter").addEventListener("change",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));$("opening-color-filter").addEventListener("change",drawOpeningTable);
document.addEventListener("click",e=>{const b=e.target.closest("[data-open-game]");if(!b)return;e.preventDefault();if(window.CoachReview?.open){window.CoachReview.open(b.dataset.openGame);return;}window.dispatchEvent(new CustomEvent("coach:review-game",{detail:{gameId:b.dataset.openGame}}));});
games=readStoredGames();render();
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      registration.update().catch(()=>{});
    }catch(error){console.warn("Mise à jour hors ligne indisponible",error);}
  });
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(refreshing)return;
    refreshing=true;
    location.reload();
  });
}


// Interface publique minimale pour le module d'analyse moteur.
window.CoachApp = { getGames: () => games, saveGames: () => saveGames() };
const renderBeforeAnalysis = render;
render = function(){ renderBeforeAnalysis(); window.dispatchEvent(new Event("coach:games-updated")); };
render();
