const USERNAME = "gone_1950";
const STORAGE_KEY = "coach-echecs-v1";
let games = [];
const $ = (id) => document.getElementById(id);

function readStoredGames(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return []}}
function saveGames(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(games))}catch(e){setMessage("Le stockage du navigateur est plein. Tu peux exporter tes parties en PGN pour les conserver.")}}
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
  return {...p,id:g.url||p.id||String(Math.random()),date:g.end_time?new Date(g.end_time*1000).toISOString().slice(0,10):p.date,white:g.white?.username||p.white,black:g.black?.username||p.black,result:g.white?.result==="win"?"1-0":g.black?.result==="win"?"0-1":(["agreed","repetition","stalemate","insufficient","50move","timevsinsufficient"].includes(g.white?.result)?"1/2-1/2":p.result),timeControl:g.time_control||p.timeControl,eco:g.eco||p.eco,opening:g.pgn?.match(/\[Opening "([^"]+)"/)?.[1]||p.opening,pgn:g.pgn||p.pgn,whiteElo:g.white?.rating||p.whiteElo,blackElo:g.black?.rating||p.blackElo,url:g.url||p.url};
}
function outcome(game){
  const me=USERNAME.toLowerCase(), white=(game.white||"").toLowerCase(), black=(game.black||"").toLowerCase();
  if(game.result==="1/2-1/2")return "draw";
  if((white===me&&game.result==="1-0")||(black===me&&game.result==="0-1"))return "win";
  if((white===me&&game.result==="0-1")||(black===me&&game.result==="1-0"))return "loss";
  return "unknown";
}
function formatDate(d){if(!d)return "Date inconnue";const [y,m,day]=d.split(".").length===3?d.split("."):d.split("-");return day&&m&&y?new Date(Number(y),Number(m)-1,Number(day)).toLocaleDateString("fr-FR"):"Date inconnue"}
function resultLabel(o){return o==="win"?"Victoire":o==="loss"?"Défaite":o==="draw"?"Nulle":"Résultat inconnu"}
function opponent(g){return (g.white||"").toLowerCase()===USERNAME.toLowerCase()?g.black:g.white}
function render(){
  const wins=games.filter(g=>outcome(g)==="win").length, draws=games.filter(g=>outcome(g)==="draw").length, losses=games.filter(g=>outcome(g)==="loss").length;
  $("stat-games").textContent=games.length;$("stat-wins").textContent=wins;$("stat-draws").textContent=draws;$("stat-losses").textContent=losses;
  const decided=wins+draws+losses;$("stat-winrate").textContent=decided?Math.round((wins+draws/2)/decided*100)+" % de score": "En attente de tes parties";
  $("sync-state").textContent=games.length?"Données à jour dans ce navigateur":"Données non synchronisées";
  const sorted=[...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("recent-games").innerHTML=sorted.length?sorted.slice(0,4).map(gameHtml).join(""):'<div class="empty-state">Tes parties apparaîtront ici après l’import.</div>';
  renderGames(sorted);renderBars(wins,draws,losses);
  const openings={};games.forEach(g=>{if(g.opening)openings[g.opening]=(openings[g.opening]||0)+1});
  const top=Object.entries(openings).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("opening-state").innerHTML=top.length?top.map(([name,count])=>'<div class="focus-line">'+escapeHtml(name)+' <span>· '+count+' partie(s)</span></div>').join(""):'Importe tes parties pour commencer.';
}
function gameHtml(g){const o=outcome(g);return '<div class="game-row"><div><div class="game-opponent">vs '+escapeHtml(opponent(g)||"Adversaire")+'</div><div class="game-meta">'+formatDate(g.date)+' · '+escapeHtml(g.timeControl||"Cadence inconnue")+(g.opening?" · "+escapeHtml(g.opening):"")+'</div></div><span class="game-result '+o+'">'+resultLabel(o)+'</span></div>'}
function renderGames(sorted){const q=($("game-search").value||"").toLowerCase(),f=$("result-filter").value;const filtered=sorted.filter(g=>(opponent(g)||"").toLowerCase().includes(q)&&(f==="all"||outcome(g)===f));$("games-list").innerHTML=filtered.length?filtered.map(gameHtml).join(""):'<div class="empty-state">Aucune partie ne correspond à ce filtre.</div>'}
function renderBars(w,d,l){const n=w+d+l;if(!n){$("result-bars").innerHTML='<p class="muted">Les statistiques apparaîtront après l’import.</p>';return}const rows=[["Victoires",w],["Nulles",d],["Défaites",l]];$("result-bars").innerHTML=rows.map(([label,v])=>'<div class="bar-item"><span>'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(v/n*100)+'%"></div></div><strong>'+v+'</strong></div>').join("")}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function syncChessCom(){
  const buttons=[$("sync-button"),$("sync-button-games")];buttons.forEach(b=>{b.disabled=true;b.textContent="Synchronisation…"});
  setMessage("Connexion à l'archive publique Chess.com…");
  try{
    const response=await fetch("https://api.chess.com/pub/player/"+USERNAME+"/games/archives",{headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("Chess.com a répondu "+response.status);
    const archiveData=await response.json(), urls=(archiveData.archives||[]).slice(-3).reverse();
    if(!urls.length)throw new Error("Aucune archive trouvée pour ce compte.");
    let imported=[];
    for(const url of urls){
      setMessage("Récupération de "+url.split("/").slice(-2).join("/")+"…");
      const res=await fetch(url,{headers:{"Accept":"application/json"}});
      if(!res.ok)continue;
      const data=await res.json();imported=imported.concat((data.games||[]).map(normalizeGame));
    }
    if(!imported.length)throw new Error("Aucune partie trouvée dans les trois dernières archives.");
    const byId=new Map(games.map(g=>[g.id,g]));imported.forEach(g=>byId.set(g.id,g));games=[...byId.values()].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    saveGames();render();setMessage(imported.length+" parties récupérées ou actualisées. Les données sont conservées sur cet appareil.");$("sync-state").textContent="Synchronisé";
  }catch(e){setMessage("La synchronisation automatique n'a pas abouti : "+e.message+". Tu peux importer un fichier PGN depuis Chess.com.");}
  finally{buttons.forEach((b,i)=>{b.disabled=false;b.textContent=i?"Synchroniser":"Récupérer mes parties"})}
}
function importPgnFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{const added=parsePgn(String(reader.result||""));if(!added.length){setMessage("Je n'ai pas reconnu de parties dans ce fichier PGN.");return}const byId=new Map(games.map(g=>[g.id,g]));added.forEach(g=>byId.set(g.id,g));games=[...byId.values()];saveGames();render();setMessage(added.length+" partie(s) importée(s) depuis le fichier PGN.")};reader.onerror=()=>setMessage("Impossible de lire ce fichier.");reader.readAsText(file)}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll(".panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+btn.dataset.tab))}));
document.querySelectorAll("[data-goto]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector('[data-tab="'+btn.dataset.goto+'"]').click()));
$("sync-button").addEventListener("click",syncChessCom);$("sync-button-games").addEventListener("click",syncChessCom);$("pgn-file").addEventListener("change",e=>importPgnFile(e.target.files[0]));$("game-search").addEventListener("input",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));$("result-filter").addEventListener("change",()=>renderGames([...games].sort((a,b)=>(b.date||"").localeCompare(a.date||""))));
games=readStoredGames();render();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
