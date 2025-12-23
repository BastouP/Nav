let SITES = [];
let historyStack = [];
let historyIndex = -1;

const $ = (id) => document.getElementById(id);

const topbar = $("topbar");

const viewHome = $("viewHome");
const viewResults = $("viewResults");
const viewSite = $("viewSite");

const viewer = $("viewer");

const addressBar = $("addressBar");
const homeSearch = $("homeSearch");

const pinnedGrid = $("pinnedGrid");
const resultsList = $("resultsList");
const resultsCount = $("resultsCount");

const notFound = $("notFound");
const nfText = $("nfText");

const btnBack = $("btnBack");
const btnForward = $("btnForward");
const btnReload = $("btnReload");
const btnHomeTop = $("btnHomeTop");

const btnGo = $("btnGo");
const homeBtn = $("homeBtn");

function norm(s){
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}

function setView(mode){
  // mode: home | results | site
  const isHome = mode === "home";
  topbar.classList.toggle("hidden", isHome);

  viewHome.classList.toggle("hidden", mode !== "home");
  viewResults.classList.toggle("hidden", mode !== "results");
  viewSite.classList.toggle("hidden", mode !== "site");
}

function syncNav(){
  btnBack.disabled = historyIndex <= 0;
  btnForward.disabled = historyIndex >= historyStack.length - 1;
  btnReload.disabled = !(historyStack[historyIndex]?.type === "site");
}

function pushHistory(entry){
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(entry);
  historyIndex = historyStack.length - 1;
  syncNav();
}

// --- URL style helpers ---
// Accept:
// - https://domain.tld/path (we ignore path for now)
// - domain.tld
// - id (optional)
function parseAddress(input){
  let s = (input || "").trim();
  if(!s) return { kind:"empty" };

  // Strip protocol
  s = s.replace(/^https?:\/\//i, "");
  // Strip trailing slash
  s = s.replace(/\/+$/,"");

  // Remove any path/query after domain
  const domainOnly = s.split(/[/?#]/)[0];

  return { kind:"address", value: domainOnly };
}

function formatAsUrl(domain){
  return `https://${domain}/`;
}

function findSiteByDomainOrId(addr){
  const a = norm(addr);
  return SITES.find(s => norm(s.domain) === a || norm(s.id) === a) || null;
}

function siteMatches(site, q){
  const nq = norm(q);
  const hay = [site.domain, site.id, site.title, site.description, ...(site.keywords||[])]
    .map(norm).join(" ");
  return hay.includes(nq);
}

function renderPinned(){
  pinnedGrid.innerHTML = "";
  SITES.filter(s => s.pinned).forEach(s => {
    const div = document.createElement("div");
    div.className = "tile";
    div.innerHTML = `<div class="tileTitle">${s.title}</div><div class="tileAddr">${formatAsUrl(s.domain)}</div>`;
    div.onclick = () => openSite(s, true);
    pinnedGrid.appendChild(div);
  });
}

function setHash(domain){
  if(!domain) location.hash = "";
  else location.hash = encodeURIComponent(domain);
}

function openSite(site, addHistory){
  viewer.src = site.path;
  addressBar.value = formatAsUrl(site.domain);
  setView("site");

  if(addHistory) pushHistory({ type:"site", domain: site.domain });
  setHash(site.domain);
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
      <div class="resultMeta">${formatAsUrl(s.domain)} • ${s.path}</div>
    `;
    card.onclick = () => openSite(s, true);
    resultsList.appendChild(card);
  });

  notFound.classList.add("hidden");
  setView("results");
  addressBar.value = query; // la barre montre la recherche
  if(addHistory) pushHistory({ type:"results", query });
  setHash(""); // pas de bookmark sur recherche
}

function showNotFound(msg, addHistory){
  nfText.textContent = msg;
  notFound.classList.remove("hidden");
  resultsList.innerHTML = "";
  resultsCount.textContent = "";

  setView("results");
  if(addHistory) pushHistory({ type:"notFound", msg });
  setHash("");
}

async function tryOpenUnlistedDomain(domain){
  // "dark web": si pas dans JSON, on tente pages/<domain>.html (sanitisé)
  const safe = domain.replace(/[^\w.\-]/g, "");
  const guess = `pages/${safe}.html`;
  try{
    const res = await fetch(guess, { cache:"no-store" });
    if(res.ok){
      viewer.src = guess;
      addressBar.value = formatAsUrl(domain);
      setView("site");
      pushHistory({ type:"site", domain });
      setHash(domain);
      return true;
    }
  } catch {}
  return false;
}

async function navigate(raw, addHistory){
  const parsed = parseAddress(raw);

  if(parsed.kind === "empty"){
    viewer.src = "about:blank";
    setView("home");
    if(addHistory) pushHistory({ type:"home" });
    setHash("");
    return;
  }

  const addr = parsed.value;

  // 1) adresse exacte domain/id
  const exact = findSiteByDomainOrId(addr);
  if(exact) return openSite(exact, addHistory);

  // 2) sinon recherche
  const matches = SITES.filter(s => siteMatches(s, addr));
  if(matches.length) return showResults(addr, matches, addHistory);

  // 3) "dark web": domaine non référencé => tentative pages/<domain>.html
  if(await tryOpenUnlistedDomain(addr)) return;

  showNotFound(`Aucun site référencé pour “${addr}”.`, addHistory);
}

function loadFromHash(){
  const h = decodeURIComponent((location.hash || "").replace("#","")).trim();
  if(h) navigate(formatAsUrl(h), true);
}

async function init(){
  const res = await fetch("data/sites.json", { cache:"no-store" });
  const data = await res.json();
  SITES = data.sites || [];

  renderPinned();
  setView("home");
  pushHistory({ type:"home" });
  syncNav();

  loadFromHash();

  // home search
  homeBtn.onclick = () => navigate(homeSearch.value, true);
  homeSearch.onkeydown = (e) => { if(e.key === "Enter") homeBtn.click(); };

  // topbar go
  btnGo.onclick = () => navigate(addressBar.value, true);
  addressBar.onkeydown = (e) => { if(e.key === "Enter") btnGo.click(); };

  // nav buttons
  btnHomeTop.onclick = () => navigate("", true);

  btnBack.onclick = () => {
    if(historyIndex <= 0) return;
    historyIndex--;
    const it = historyStack[historyIndex];
    if(it.type === "site") navigate(formatAsUrl(it.domain), false);
    else if(it.type === "results") showResults(it.query, SITES.filter(s=>siteMatches(s,it.query)), false);
    else navigate("", false);
    syncNav();
  };

  btnForward.onclick = () => {
    if(historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    const it = historyStack[historyIndex];
    if(it.type === "site") navigate(formatAsUrl(it.domain), false);
    else if(it.type === "results") showResults(it.query, SITES.filter(s=>siteMatches(s,it.query)), false);
    else navigate("", false);
    syncNav();
  };

  btnReload.onclick = () => {
    if(historyStack[historyIndex]?.type === "site") viewer.src = viewer.src;
  };

  window.addEventListener("hashchange", loadFromHash);

  // navigation depuis pages internes (iframe)
  window.addEventListener("message", (ev) => {
    if(ev?.data?.type === "navigate" && typeof ev.data.address === "string"){
      navigate(ev.data.address, true);
    }
  });
}

init().catch(() => {
  // fallback simple si JSON non accessible
  setView("results");
  showNotFound("Erreur: impossible de charger data/sites.json", true);
});
