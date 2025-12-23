let SITES = [];
let historyStack = [];
let historyIndex = -1;

const $ = (id) => document.getElementById(id);

const viewer = $("viewer");
const addressBar = $("addressBar");
const homeSearch = $("homeSearch");

const pinnedGrid = $("pinnedGrid");
const results = $("results");
const resultsList = $("resultsList");
const resultsCount = $("resultsCount");
const notFound = $("notFound");
const nfText = $("nfText");

const btnBack = $("btnBack");
const btnForward = $("btnForward");
const btnReload = $("btnReload");
const btnGo = $("btnGo");
const btnHome = $("btnHome");
const btnHome2 = $("btnHome2");
const homeBtn = $("homeBtn");

function norm(s){
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}

function findSiteByAddress(addr){
  const a = norm(addr);
  return SITES.find(s => norm(s.address) === a) || null;
}

function siteMatches(site, q){
  const nq = norm(q);
  const hay = [site.address, site.title, site.description, ...(site.keywords||[])]
    .map(norm).join(" ");
  return hay.includes(nq);
}

function showPanel(mode){
  results.classList.toggle("hidden", mode !== "results");
  notFound.classList.toggle("hidden", mode !== "notFound");
}

function syncNav(){
  btnBack.disabled = historyIndex <= 0;
  btnForward.disabled = historyIndex >= historyStack.length - 1;
  btnReload.disabled = !viewer.src || viewer.src === "about:blank";
}

function pushHistory(entry){
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(entry);
  historyIndex = historyStack.length - 1;
  syncNav();
}

function renderPinned(){
  pinnedGrid.innerHTML = "";
  SITES.filter(s => s.pinned).forEach(s => {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = `<div class="tileTitle">${s.title}</div><div class="tileAddr">${s.address}</div>`;
    div.onclick = () => openSite(s, true);
    pinnedGrid.appendChild(div);
  });
}

function setHash(addr){
  // permet refresh + lien direct
  if(!addr) location.hash = "";
  else location.hash = encodeURIComponent(addr);
}

function openPath(path, address, addHistory){
  viewer.src = path;
  addressBar.value = address || "";
  showPanel("none");
  if(addHistory) pushHistory({type:"site", address: address || path});
  setHash(address || "");
  syncNav();
}

function openSite(site, addHistory){
  openPath(site.path, site.address, addHistory);
}

function showResults(query, matches, addHistory){
  resultsList.innerHTML = "";
  resultsCount.textContent = `${matches.length} résultat(s) pour “${query}”`;

  matches.forEach(s => {
    const card = document.createElement("div");
    card.className = "resultCard";
    card.innerHTML = `
      <div class="resultTitle">${s.title}</div>
      <div class="resultDesc">${s.description || ""}</div>
      <div class="tileAddr">${s.address}</div>
    `;
    card.onclick = () => openSite(s, true);
    resultsList.appendChild(card);
  });

  showPanel("results");
  if(addHistory) pushHistory({type:"results", query});
  setHash(""); // on ne bookmark pas une recherche par défaut
  syncNav();
}

function showNotFound(msg, addHistory){
  nfText.textContent = msg;
  showPanel("notFound");
  if(addHistory) pushHistory({type:"notFound", msg});
  syncNav();
}

async function tryOpenUnlistedAddress(addr){
  // règle "dark web": si pas référencé, on tente /pages/<addr>.html
  const safe = addr.replace(/[^\w.\-]/g, "");
  const guess = `pages/${safe}.html`;

  try {
    const res = await fetch(guess, { method: "GET", cache: "no-store" });
    if(res.ok){
      openPath(guess, addr, true);
      return true;
    }
  } catch (e) {}
  return false;
}

async function navigate(input, addHistory){
  const v = (input || "").trim();
  if(!v){
    viewer.src = "about:blank";
    addressBar.value = "";
    showPanel("none");
    if(addHistory) pushHistory({type:"home"});
    setHash("");
    syncNav();
    return;
  }

  const exact = findSiteByAddress(v);
  if(exact) return openSite(exact, addHistory);

  const matches = SITES.filter(s => siteMatches(s, v));
  if(matches.length) return showResults(v, matches, addHistory);

  // pas référencé -> tentative auto (dark web)
  if(await tryOpenUnlistedAddress(v)) return;

  showNotFound(`Aucun site référencé pour “${v}”.`, addHistory);
}

function loadFromHash(){
  const h = decodeURIComponent((location.hash || "").replace("#","")).trim();
  if(h) navigate(h, true);
}

async function init(){
  const res = await fetch("data/sites.json", {cache:"no-store"});
  const data = await res.json();
  SITES = data.sites || [];

  renderPinned();
  viewer.src = "about:blank";
  pushHistory({type:"home"});
  loadFromHash();
  syncNav();

  btnGo.onclick = () => navigate(addressBar.value, true);
  addressBar.onkeydown = (e) => { if(e.key === "Enter") btnGo.click(); };

  homeBtn.onclick = () => navigate(homeSearch.value, true);
  homeSearch.onkeydown = (e) => { if(e.key === "Enter") homeBtn.click(); };

  btnHome.onclick = () => navigate("", true);
  btnHome2.onclick = () => navigate("", true);

  btnBack.onclick = () => {
    if(historyIndex <= 0) return;
    historyIndex--;
    const it = historyStack[historyIndex];
    if(it.type === "site") navigate(it.address, false);
    else if(it.type === "results") showResults(it.query, SITES.filter(s=>siteMatches(s,it.query)), false);
    else navigate("", false);
    syncNav();
  };

  btnForward.onclick = () => {
    if(historyIndex >= historyStack.length-1) return;
    historyIndex++;
    const it = historyStack[historyIndex];
    if(it.type === "site") navigate(it.address, false);
    else if(it.type === "results") showResults(it.query, SITES.filter(s=>siteMatches(s,it.query)), false);
    else navigate("", false);
    syncNav();
  };

  btnReload.onclick = () => {
    if(viewer.src && viewer.src !== "about:blank") viewer.src = viewer.src;
  };

  window.addEventListener("hashchange", loadFromHash);

  // navigation depuis les pages (iframe) via postMessage
  window.addEventListener("message", (ev) => {
    if(ev?.data?.type === "navigate" && typeof ev.data.address === "string"){
      navigate(ev.data.address, true);
    }
  });
}

init().catch(() => showNotFound("Erreur: impossible de charger data/sites.json", true));
