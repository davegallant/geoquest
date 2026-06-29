const WORLD_TOPOJSON = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const ISO_COUNTRIES = window.ISO_COUNTRIES || {};
const COUNTRY_METADATA = window.COUNTRY_METADATA || {};
const COUNTRY_METADATA_BY_NAME = window.COUNTRY_METADATA_BY_NAME || {};
const QUIZ_LENGTH = 10;
const MAX_TRIES = 3;
const HIGH_SCORE_KEY = "geoquest-high-score";

const state = {
  mode: "learn",
  target: null,
  countries: [],
  details: new Map(),
  score: 0,
  attempts: 0,
  questionNumber: 0,
  currentTries: 0,
  highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
  quizPool: [],
  quizActive: false,
  advancing: false,
  awaitingRevealClick: false,
};

const els = {
  map: document.getElementById("worldMap"),
  learnBtn: document.getElementById("learnBtn"),
  quizBtn: document.getElementById("quizBtn"),
  searchForm: document.getElementById("countrySearchForm"),
  searchInput: document.getElementById("countrySearch"),
  searchList: document.getElementById("countrySearchList"),
  prompt: document.getElementById("prompt"),
  continueBtn: document.getElementById("continueBtn"),
  scoreCard: document.querySelector(".score-card"),
  score: document.getElementById("score"),
  question: document.getElementById("question"),
  attempts: document.getElementById("attempts"),
  highScore: document.getElementById("highScore"),
  flag: document.getElementById("flag"),
  flagName: document.getElementById("flagName"),
  countryName: document.getElementById("countryName"),
  capital: document.getElementById("capital"),
  population: document.getElementById("population"),
  gdpPerCapita: document.getElementById("gdpPerCapita"),
  area: document.getElementById("area"),
  currency: document.getElementById("currency"),
  language: document.getElementById("language"),
  region: document.getElementById("region"),
  funFact: document.getElementById("funFact"),
  correctSound: document.getElementById("correctSound"),
  wrongSound: document.getElementById("wrongSound"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomResetBtn: document.getElementById("zoomResetBtn"),
  fireworks: document.getElementById("fireworks"),
};

let zoomBehavior = null;
let currentGeoPath = null;

function countryName(feature) {
  const p = feature.properties || {};
  return p.name || p.NAME || p.admin || p.ADMIN || `Country ${feature.id}`;
}

function countryId(feature) {
  return `country-${String(feature.id || countryName(feature)).replace(/[^a-z0-9_-]/gi, "-")}`;
}

function sameCountry(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null) return String(a.id) === String(b.id);
  return countryName(a) === countryName(b);
}

function isoRecord(feature) {
  return ISO_COUNTRIES[String(feature.id).padStart(3, "0")];
}

function metadataRecord(feature) {
  return COUNTRY_METADATA[String(feature.id).padStart(3, "0")] || COUNTRY_METADATA_BY_NAME[countryName(feature)];
}

function flagUrl(feature) {
  const meta = metadataRecord(feature);
  const iso = isoRecord(feature);
  const alpha2 = meta?.cca2 || iso?.alpha2;
  return alpha2 ? `https://flagcdn.com/${alpha2}.svg` : "flags/clear.jpg";
}

function searchableNames(feature) {
  const meta = metadataRecord(feature) || {};
  return [countryName(feature), meta.name, meta.officialName, meta.cca2, meta.cca3].filter(Boolean);
}

function normalizeSearch(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findCountryByName(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return null;

  return state.countries.find((feature) => searchableNames(feature).some((name) => normalizeSearch(name) === normalized))
    || state.countries.find((feature) => searchableNames(feature).some((name) => normalizeSearch(name).startsWith(normalized)))
    || state.countries.find((feature) => searchableNames(feature).some((name) => normalizeSearch(name).includes(normalized)));
}

function populateSearchList() {
  els.searchList.replaceChildren(...state.countries.map((feature) => {
    const option = document.createElement("option");
    option.value = metadataRecord(feature)?.name || countryName(feature);
    return option;
  }));
}

function play(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function setPrompt(text, status = "") {
  els.prompt.textContent = text;
  els.prompt.className = `prompt ${status}`.trim();
}

function showContinueButton(show) {
  els.continueBtn.hidden = !show;
}

function updateScore() {
  els.score.textContent = `${state.score}/${QUIZ_LENGTH}`;
  els.question.textContent = `${state.questionNumber}/${QUIZ_LENGTH}`;
  els.attempts.textContent = state.mode === "quiz" ? `${state.currentTries}/${MAX_TRIES}` : "0/3";
  els.highScore.textContent = `${state.highScore}/${QUIZ_LENGTH}`;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function fetchDetails(feature) {
  const key = String(feature.id || countryName(feature)).padStart(3, "0");
  if (state.details.has(key)) return state.details.get(key);
  const data = metadataRecord(feature) || null;
  state.details.set(key, data);
  return data;
}

function clearCountryInfo() {
  els.flag.src = "flags/clear.jpg";
  els.flag.alt = "";
  els.flagName.textContent = "—";
  els.countryName.textContent = "Choose a country";
  els.capital.textContent = "—";
  els.area.textContent = "—";
  els.population.textContent = "—";
  els.gdpPerCapita.textContent = "—";
  els.currency.textContent = "—";
  els.language.textContent = "—";
  els.region.textContent = "—";
  els.funFact.textContent = "Click a country to load details.";
}

async function showCountry(feature) {
  const name = countryName(feature);
  const hasFlag = flagUrl(feature) !== "flags/clear.jpg";
  els.flag.src = flagUrl(feature);
  els.flag.alt = hasFlag ? `Flag of ${name}` : "";
  els.flagName.textContent = hasFlag ? `Flag of ${name}` : "—";
  els.countryName.textContent = name;
  els.capital.textContent = "Loading…";
  els.area.textContent = "—";
  els.population.textContent = "—";
  els.gdpPerCapita.textContent = "—";
  els.currency.textContent = "—";
  els.language.textContent = "—";
  els.region.textContent = "—";
  els.funFact.textContent = "Loading country details…";

  const details = await fetchDetails(feature);
  if (!details || els.countryName.textContent !== name) {
    els.capital.textContent = "—";
    els.region.textContent = isoRecord(feature)?.region || "—";
    els.funFact.textContent = "Country details were not available, but this country is still playable in the map quiz.";
    return;
  }

  els.flag.src = details.flag || flagUrl(feature);
  els.flag.alt = `Flag of ${details.name || name}`;
  els.flagName.textContent = `Flag of ${details.name || name}`;
  els.countryName.textContent = details.name || name;
  els.capital.textContent = details.capital || "—";
  els.population.textContent = details.population ? `${details.population.toLocaleString()}${details.populationYear ? ` (${details.populationYear})` : ""}` : "—";
  els.gdpPerCapita.textContent = details.gdpPerCapita ? `$${details.gdpPerCapita.toLocaleString()}${details.gdpPerCapitaYear ? ` (${details.gdpPerCapitaYear})` : ""}` : "No World Bank data";
  els.area.textContent = details.area ? details.area.toLocaleString() : "—";
  els.currency.textContent = details.currency || "—";
  els.language.textContent = details.language || "—";
  els.region.textContent = [details.region, details.subregion].filter(Boolean).join(" / ") || "—";
  els.funFact.textContent = details.officialName && details.officialName !== (details.name || name) ? `Official name: ${details.officialName}` : "Click another country to compare details.";
}

function clearStatusClasses() {
  d3.selectAll(".country").classed("selected correct wrong reveal", false).attr("fill", null);
}

function mark(feature, className) {
  d3.select(`#${countryId(feature)}`).classed(className, true);
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showFireworks() {
  const colors = ["#f7c948", "#ff8a3d", "#27ae60", "#4dabf7", "#d946ef"];
  els.fireworks.replaceChildren();

  for (let burst = 0; burst < 3; burst += 1) {
    const originX = 35 + Math.random() * 30;
    const originY = 24 + Math.random() * 28;
    for (let i = 0; i < 18; i += 1) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * i) / 18;
      const distance = 55 + Math.random() * 95;
      particle.className = "firework";
      particle.style.left = `${originX}%`;
      particle.style.top = `${originY}%`;
      particle.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--color", colors[(i + burst) % colors.length]);
      particle.style.animationDelay = `${burst * 180}ms`;
      els.fireworks.append(particle);
    }
  }

  setTimeout(() => els.fireworks.replaceChildren(), 2000);
}

function startQuiz() {
  state.score = 0;
  state.attempts = 0;
  state.questionNumber = 0;
  state.currentTries = 0;
  state.quizPool = shuffled(state.countries).slice(0, QUIZ_LENGTH);
  state.quizActive = true;
  state.advancing = false;
  state.awaitingRevealClick = false;
  showContinueButton(false);
  updateScore();
  chooseTarget();
}

function endQuiz() {
  state.quizActive = false;
  state.target = null;
  state.awaitingRevealClick = false;
  showContinueButton(false);
  clearStatusClasses();
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
    setPrompt(`Quiz complete! New high score: ${state.score}/${QUIZ_LENGTH}.`, "correct");
  } else {
    setPrompt(`Quiz complete! Score: ${state.score}/${QUIZ_LENGTH}. Best: ${state.highScore}/${QUIZ_LENGTH}.`);
  }
  updateScore();
}

function advanceQuiz(delay = 0) {
  state.advancing = true;
  setTimeout(() => {
    state.advancing = false;
    if (state.questionNumber >= QUIZ_LENGTH) endQuiz();
    else chooseTarget();
  }, delay);
}

function chooseTarget() {
  const next = state.quizPool[state.questionNumber];
  if (!next) {
    endQuiz();
    return;
  }

  state.target = next;
  state.questionNumber += 1;
  state.currentTries = 0;
  state.awaitingRevealClick = false;
  showContinueButton(false);
  clearStatusClasses();
  clearCountryInfo();
  updateScore();
  setPrompt(`Question ${state.questionNumber}/${QUIZ_LENGTH}: Find ${countryName(next)}. You have ${MAX_TRIES} tries.`);
}

function setMode(mode) {
  state.mode = mode;
  els.learnBtn.classList.toggle("active", mode === "learn");
  els.quizBtn.classList.toggle("active", mode === "quiz");
  els.scoreCard.hidden = mode !== "quiz";
  els.searchForm.hidden = mode === "quiz";
  if (mode === "quiz") els.searchInput.value = "";
  clearStatusClasses();
  if (mode === "quiz") startQuiz();
  else {
    state.quizActive = false;
    state.target = null;
    state.awaitingRevealClick = false;
    showContinueButton(false);
    state.questionNumber = 0;
    state.currentTries = 0;
    updateScore();
    setPrompt("Click a country on the map to see facts, search for a country, or switch to Quiz mode.");
  }
}

function selectCountry(feature, promptText = `${countryName(feature)} selected.`) {
  showCountry(feature);
  clearStatusClasses();
  mark(feature, "selected");
  focusCountry(feature);
  setPrompt(promptText);
}

function handleSearch(event) {
  event.preventDefault();
  if (state.mode !== "learn") return;

  const feature = findCountryByName(els.searchInput.value);
  if (!feature) {
    setPrompt(`No country found for “${els.searchInput.value}”. Try another name.`, "wrong");
    return;
  }

  selectCountry(feature, `${countryName(feature)} found.`);
}

function handleCountryClick(feature) {
  if (state.mode === "learn") {
    selectCountry(feature);
    return;
  }

  if (!state.quizActive || state.advancing) return;

  if (state.awaitingRevealClick) {
    setPrompt(`Press Continue when you're ready for the next question.`);
    return;
  }

  state.attempts += 1;
  state.currentTries += 1;
  if (sameCountry(feature, state.target)) {
    showCountry(feature);
    state.score += 1;
    mark(feature, "correct");
    focusCountry(feature);
    setPrompt(`Correct! That is ${countryName(feature)}. Press Continue when you're ready.`, "correct");
    play(els.correctSound);
    showFireworks();
    state.awaitingRevealClick = true;
    showContinueButton(true);
    updateScore();
  } else {
    clearCountryInfo();
    mark(feature, "wrong");
    play(els.wrongSound);
    if (state.currentTries >= MAX_TRIES) {
      showCountry(state.target);
      mark(state.target, "reveal");
      focusCountry(state.target);
      state.awaitingRevealClick = true;
      showContinueButton(true);
      setPrompt(`Out of tries. The answer is highlighted: ${countryName(state.target)}. Press Continue when you're ready.`, "wrong");
      updateScore();
    } else {
      setPrompt(`Not ${countryName(feature)}. Try ${state.currentTries + 1}/${MAX_TRIES}: find ${countryName(state.target)}.`, "wrong");
      updateScore();
    }
  }
}

function panMap(dx, dy) {
  if (!zoomBehavior) return;
  const transform = d3.zoomTransform(els.map);
  d3.select(els.map)
    .transition()
    .duration(80)
    .call(zoomBehavior.translateBy, dx / transform.k, dy / transform.k);
}

function focusCountry(feature) {
  if (!zoomBehavior) return;
  const country = document.getElementById(countryId(feature));
  if (!country) return;

  const { x, y, width, height } = country.getBBox();
  const rect = els.map.getBoundingClientRect();
  const mapWidth = Math.max(640, rect.width || 900);
  const mapHeight = Math.max(420, rect.height || 650);
  const crossesMapSeam = width > mapWidth * 0.4 && height < mapHeight * 0.2;
  const relativeSize = crossesMapSeam ? height / mapHeight : Math.max(width / mapWidth, height / mapHeight);
  const scale = Math.max(2, Math.min(8, 0.42 / Math.max(relativeSize, 0.001)));
  const centroid = currentGeoPath?.centroid(feature) || [x + width / 2, y + height / 2];
  const centerX = Number.isFinite(centroid[0]) ? centroid[0] : x + width / 2;
  const centerY = Number.isFinite(centroid[1]) ? centroid[1] : y + height / 2;
  const transform = d3.zoomIdentity
    .translate(mapWidth / 2, mapHeight / 2)
    .scale(scale)
    .translate(-centerX, -centerY);

  d3.select(els.map)
    .transition()
    .duration(700)
    .call(zoomBehavior.transform, transform);
}

function drawMap() {
  const rect = els.map.getBoundingClientRect();
  const width = Math.max(640, rect.width || 900);
  const height = Math.max(420, rect.height || 650);
  els.map.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
  const path = d3.geoPath(projection);
  currentGeoPath = path;

  const svg = d3.select(els.map);
  svg.selectAll("*").remove();

  const mapLayer = svg.append("g").attr("class", "zoom-layer");
  mapLayer.append("path").datum({ type: "Sphere" }).attr("class", "sphere").attr("d", path);
  mapLayer.append("path").datum(d3.geoGraticule10()).attr("class", "graticule").attr("d", path);

  const countryPaths = mapLayer.append("g")
    .selectAll("path")
    .data(state.countries)
    .join("path")
    .attr("id", countryId)
    .attr("class", "country")
    .attr("d", path)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", countryName)
    .on("click", (_, feature) => handleCountryClick(feature))
    .on("keydown", (event, feature) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCountryClick(feature);
      }
    });

  let queuedTransform = null;
  let animationFrame = null;

  function applyQueuedTransform() {
    if (queuedTransform) mapLayer.attr("transform", queuedTransform);
    queuedTransform = null;
    animationFrame = null;
  }

  zoomBehavior = d3.zoom()
    .scaleExtent([1, 12])
    .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.018 : 0.0012))
    .translateExtent([[-width * 0.5, -height * 0.5], [width * 1.5, height * 1.5]])
    .filter((event) => {
      // Keep normal page scrolling usable. Trackpads/mice zoom the map when the
      // pointer is over it; right-clicks and double-click zoom are disabled.
      return !event.button && event.type !== "dblclick";
    })
    .on("zoom", (event) => {
      queuedTransform = event.transform;
      if (!animationFrame) animationFrame = requestAnimationFrame(applyQueuedTransform);
    });

  svg.call(zoomBehavior).on("dblclick.zoom", null);
}

async function init() {
  if (!window.d3 || !window.topojson) {
    setPrompt("World map libraries could not load. Check your internet connection or vendor the D3/topojson files locally.", "wrong");
    return;
  }

  try {
    const topology = await d3.json(WORLD_TOPOJSON);
    state.countries = topojson.feature(topology, topology.objects.countries).features
      .filter((feature) => countryName(feature) !== "Antarctica")
      .sort((a, b) => countryName(a).localeCompare(countryName(b)));
    drawMap();
    populateSearchList();
    setPrompt("Click a country on the map to see facts, search for a country, or switch to Quiz mode.");
  } catch (error) {
    console.error(error);
    setPrompt("Could not load the world map data. This page needs internet access for the world-atlas dataset.", "wrong");
  }
}

els.learnBtn.addEventListener("click", () => setMode("learn"));
els.quizBtn.addEventListener("click", () => setMode("quiz"));
els.searchForm.addEventListener("submit", handleSearch);
els.continueBtn.addEventListener("click", () => {
  if (!state.awaitingRevealClick || state.advancing) return;
  state.awaitingRevealClick = false;
  showContinueButton(false);
  setPrompt(`Moving on from ${countryName(state.target)}…`);
  if (zoomBehavior) {
    d3.select(els.map)
      .transition()
      .duration(600)
      .call(zoomBehavior.transform, d3.zoomIdentity);
  }
  advanceQuiz(650);
});
els.zoomInBtn.addEventListener("click", () => zoomBehavior && d3.select(els.map).transition().duration(180).call(zoomBehavior.scaleBy, 1.6));
els.zoomOutBtn.addEventListener("click", () => zoomBehavior && d3.select(els.map).transition().duration(180).call(zoomBehavior.scaleBy, 1 / 1.6));
els.zoomResetBtn.addEventListener("click", () => zoomBehavior && d3.select(els.map).transition().duration(180).call(zoomBehavior.transform, d3.zoomIdentity));
window.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) return;

  event.preventDefault();
  const step = event.shiftKey ? 140 : 70;
  if (event.key === "ArrowLeft") panMap(step, 0);
  if (event.key === "ArrowRight") panMap(-step, 0);
  if (event.key === "ArrowUp") panMap(0, step);
  if (event.key === "ArrowDown") panMap(0, -step);
});
window.addEventListener("resize", () => state.countries.length && drawMap());
updateScore();
init();
