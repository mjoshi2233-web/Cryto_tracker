/* app.js — Caesar + Rail Fence simplified cracker */

// ====================== utilities ======================
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AIDX = Object.fromEntries([...ALPHA].map((c, i) => [c, i]));

const BIGRAMS = new Set(["TH","HE","IN","ER","AN","RE","ND","AT","ON","NT","HA","ES","ST","EN","ED","TO","IT","OU","EA","HI","IS","OR","TI","AS","TE","ET","NG","OF","AL","DE"]);
const COMMON_WORDS = new Set("THE OF AND TO IN IS YOU THAT IT HE WAS FOR ON ARE AS WITH HIS THEY I AT BE THIS HAVE FROM OR ONE HAD BY WORD BUT NOT WHAT ALL WERE WE WHEN YOUR CAN SAID THERE USE AN EACH WHICH SHE DO HOW THEIR IF NOT WHO MORE ABOUT OUT UP INTO THAN COULD WOULD SHOULD".split(" "));

const el = id => document.getElementById(id);
function updateStatus(msg){ const s = el("status"); if(s) s.textContent = msg; }

function onlyLetters(s){ return (s||"").replace(/[^A-Za-z]/g,"").toUpperCase(); }
function cleanKeepSpaces(s){ return (s||"").replace(/[^A-Za-z ]/g," ").replace(/\s+/g," ").trim().toUpperCase(); }

const EXPECTED_FREQ = {'E':12.70,'T':9.06,'A':8.17,'O':7.51,'I':6.97,'N':6.75,'S':6.33,'H':6.09,'R':5.99,'D':4.25,'L':4.03,'C':2.78,'U':2.76,'M':2.41,'W':2.36,'F':2.23,'G':2.02,'Y':1.97,'P':1.93,'B':1.49,'V':0.98,'K':0.77,'J':0.15,'X':0.15,'Q':0.10,'Z':0.07};

function chiSquaredText(text){
  const s = onlyLetters(text); const n = s.length; if(!n) return Infinity;
  const counts = {}; for(const ch of s) counts[ch]=(counts[ch]||0)+1;
  let chi=0; for(const ch in EXPECTED_FREQ){
    const obs = counts[ch]||0; const exp = EXPECTED_FREQ[ch]*n/100.0; chi += Math.pow(obs-exp,2)/(exp||1);
  } return chi;
}
function bigramScore(text){
  const s = onlyLetters(text); let c=0;
  for(let i=0;i<s.length-1;i++) if(BIGRAMS.has(s.slice(i,i+2))) c++;
  return c/Math.max(1,s.length);
}
function wordScore(text){
  const words = cleanKeepSpaces(text).split(" ").filter(Boolean);
  if(!words.length) return 0;
  let sc=0; for(const w of words){ if(COMMON_WORDS.has(w)) sc+=2; else if(w.length>=4 && /ING|ION|ED|ER|TH|CH|SH|LY|MENT|NESS/.test(w)) sc+=0.5; }
  return sc/words.length;
}
function languageScore(text){
  const chi = chiSquaredText(text); const chiGood = 1/(1+chi/300);
  return 0.5*chiGood + 0.3*bigramScore(text) + 0.2*wordScore(text);
}

// ====================== Caesar ======================
function caesarDecrypt(text, shift){
  let out=""; for(const ch of text){
    const up = ch.toUpperCase(); const idx = AIDX[up];
    if(idx>=0){ const n = ALPHA[(idx-shift+26*1000)%26]; out += (ch===up)?n:n.toLowerCase(); }
    else out+=ch;
  } return out;
}
function breakCaesar(ciphertext){
  let bestPT="", bestScore=-1e9, bestShift=0;
  for(let sh=0; sh<26; sh++){
    const pt = caesarDecrypt(ciphertext, sh);
    const sc = languageScore(pt);
    if(sc>bestScore){ bestScore=sc; bestPT=pt; bestShift=sh; }
  }
  return { 
    plaintext: cleanKeepSpaces(bestPT), 
    key: String(bestShift), 
    details: `shift=${bestShift}, score=${bestScore.toFixed(4)}`
  };
}

// ====================== Rail Fence ======================
function extractLettersAndMap(s){
  const nonMap = {}; 
  let letters = "";
  for(let i=0;i<s.length;i++){
    const ch = s[i];
    if(/[A-Za-z]/.test(ch)){
      letters += ch;
    } else {
      nonMap[i] = ch;
    }
  }
  return { letters, nonMap, length: s.length };
}

function reinsertNonLetters(lettersPlain, nonMap, originalLength){
  let res = new Array(originalLength);
  for(const idxStr in nonMap){
    const i = parseInt(idxStr, 10);
    if(i >= 0 && i < originalLength) res[i] = nonMap[idxStr];
  }
  let li = 0;
  for(let i=0;i<originalLength;i++){
    if(typeof res[i] === "undefined"){
      res[i] = lettersPlain[li++] || "";
    }
  }
  return res.join("");
}

function railFencePattern(n, rails){
  const pat = []; let r = 0, dir = 1;
  for(let i=0;i<n;i++){
    pat.push(r);
    r += dir;
    if(r === rails - 1 || r === 0) dir *= -1;
  }
  return pat;
}

function railFenceDecryptWithPreserve(originalText, rails){
  const { letters, nonMap, length: origLen } = extractLettersAndMap(originalText);
  if(letters.length === 0) return originalText;
  const n = letters.length;
  if(rails < 2 || rails >= n) return reinsertNonLetters(letters, nonMap, origLen);
  const pat = railFencePattern(n, rails);
  const counts = Array(rails).fill(0);
  for(const r of pat) counts[r]++;
  const railsArr = Array.from({length: rails}, () => []);
  let idx = 0;
  for(let r = 0; r < rails; r++){
    for(let k = 0; k < counts[r]; k++){
      railsArr[r].push(letters[idx++]);
    }
  }
  const posInRail = Array(rails).fill(0);
  const outLetters = [];
  for(let i = 0; i < n; i++){
    const r = pat[i];
    outLetters.push(railsArr[r][posInRail[r]++]);
  }
  const lettersPlain = outLetters.join("");
  return reinsertNonLetters(lettersPlain, nonMap, origLen);
}

function breakRailFence(ciphertext, maxRails=10){
  const { letters } = extractLettersAndMap(ciphertext);
  if(letters.length < 1) {
    return { plaintext: cleanKeepSpaces(ciphertext), key: "2", details: "no letters" };
  }
  let bestPT = "", bestScore = -1e9, bestRails = 2;
  const upper = Math.max(2, Math.min(maxRails, letters.length));
  for(let r = 2; r <= upper; r++){
    const candidate = railFenceDecryptWithPreserve(ciphertext, r);
    const sc = languageScore(candidate);
    if(sc > bestScore){
      bestScore = sc;
      bestPT = candidate;
      bestRails = r;
    }
  }
  return {
    plaintext: cleanKeepSpaces(bestPT),
    key: String(bestRails),
    details: `rails=${bestRails}, score=${bestScore.toFixed(4)}`
  };
}

// ====================== detection ======================
function detectCipher(text){
  const s = onlyLetters(text);
  const n = s.length;
  if(n < 6) return "caesar";
  if(n >= 30) return "railfence";
  return "caesar";
}

// ====================== glue/UI ======================
function run(){
  const ciphertext = el("ciphertext").value;
  const assume = el("assume").value;

  updateStatus("Working…");
  const t0 = performance.now();

  const ctype = assume || detectCipher(ciphertext);
  let res;
  if(ctype==="caesar") res = breakCaesar(ciphertext);
  else res = breakRailFence(ciphertext, 10);

  const ms = (performance.now()-t0)|0;
  if(el("outType")) el("outType").textContent = ctype.toUpperCase();
  if(el("outKey")) el("outKey").textContent = res.key || "—";
  if(el("outDetails")) el("outDetails").textContent = `${res.details} · ${ms} ms`;
  if(el("outPlain")) el("outPlain").value = res.plaintext || "";
  updateStatus("Done.");
}

function demoCaesar(){
  el("ciphertext").value = "KHOOR ZRUOG";
  el("assume").value = "caesar";
}
function demoRail(){
  el("ciphertext").value = "WECRLTEERDSOEEFEAOCAIVDEN";
  el("assume").value = "railfence";
}

window.addEventListener("DOMContentLoaded", ()=>{
  el("btnRun")?.addEventListener("click", run);
  const b1 = el("btnDemo1"); if(b1) b1.addEventListener("click", demoCaesar);
  const b2 = el("btnDemo2"); if(b2){ b2.textContent = "Demo: Rail Fence"; b2.addEventListener("click", demoRail); }
});
