
  // utility
  const $ = id => document.getElementById(id);
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

  // --- NEW LOGIC: Payoff Logic and Happiness Threshold ---

  // Base is now mostly for structure, the calculation is direct in dynamicPayoffs
  const base = {
    // SS: 2 + (Boost - Penalty)
    SS:{A:0,B:0},
    // SN: A: -4, B: (Boost - Penalty)
    SN:{A:0,B:0},
    // NS: A: (Boost - Penalty), B: -4
    NS:{A:0,B:0},
    // NN: (0.0, 0.0)
    NN:{A:0.0,B:0.0}
  };

  // The Happiness Threshold remains the same
  const HAPPY_THRESHOLD = 1.0; 

  // Function to determine Happiness Status
  function getHappinessStatus(hp){
    if(hp >= HAPPY_THRESHOLD) return 'Happy 🙂';
    if(hp >= 0.0) return 'Meh 😐';
    return 'Sad 😔';
  }

  // --- END NEW LOGIC ---

  // hobby pool
  const hobbyList = ['Sports','Music','Coding','Cooking','Movies','Art','Hiking','Gaming','Reading','Dance','Travel','Fitness','Photography','Yoga','Painting'];

  // state
  let state = { A: new Set(['Sports','Coding','Music']), B: new Set(['Music','Movies','Hiking']) };

  // render hobby pills (restored to original logic)
  function renderHobbyPickers(){
    const a=$('hobbiesA'), b=$('hobbiesB'); a.innerHTML=''; b.innerHTML='';
    hobbyList.forEach(h=>{
      const pillA = document.createElement('div'); pillA.className='tag'; pillA.textContent=h;
      pillA.style.cursor='pointer';
      if(state.A.has(h)){ pillA.style.background='linear-gradient(90deg,#ffd9ec,#ffc6e2)'; pillA.style.color='#6b1f47'; }
      pillA.onclick = ()=>{ state.A.has(h)?state.A.delete(h):state.A.add(h); updateAll(); };
      a.appendChild(pillA);

      const pillB = document.createElement('div'); pillB.className='tag'; pillB.textContent=h;
      pillB.style.cursor='pointer';
      if(state.B.has(h)){ pillB.style.background='linear-gradient(90deg,#ffd9ec,#ffc6e2)'; pillB.style.color='#6b1f47'; }
      pillB.onclick = ()=>{ state.B.has(h)?state.B.delete(h):state.B.add(h); updateAll(); };
      b.appendChild(pillB);
    });
  }
  const renderHobbies = renderHobbyPickers; // alias correct renderHobbies name used earlier


  // 3. Similarity calculation for the required payoff logic
  function computeSimilarity(){
    const ageA = Number($('inputAgeA').value);
    const ageB = Number($('inputAgeB').value);
    const ageDiff = Math.abs(ageA - ageB);
    let shared = 0; state.A.forEach(t=>{ if(state.B.has(t)) shared++; });

    // IMPORTANT: wH maps to 'a' (Hobby Sim Index) and wA maps to 'b' (Age Penalty Index).
    // Since 'a' and 'b' should be POSITIVE in the requested payoff formula, we use the ABSOLUTE value of wA
    // to simplify the code, and adjust the slider limits and reset button accordingly.

    const a = Number($('wH').value); // Hobby Similarity Index (a)
    const b = Number($('wA').value); // Age Penalty Index (b)

    // x = shared (number of shared hobbies)
    // y = ageDiff (age difference)
    const hobbyBoost = shared * a;
    const agePenalty = ageDiff * b;

    // The similarity score S (used for calculating q) still needs to be defined based on the ratio.
    // Using the ratio from the previous discussion: S = (Hobby Boost) / (Hobby Boost + Age Penalty + epsilon)
    const numerator = hobbyBoost;
    const denominator = hobbyBoost + agePenalty + 0.001;

    let S_score = 0;
    if (denominator > 0.001) {
      S_score = numerator / denominator;
    }
    const S = clamp(S_score, 0, 1);

    // The required PAYOFF FACTOR (Hobby Boost - Age Penalty) is:
    const payoffFactor = hobbyBoost - agePenalty;


    return {S, shared, ageDiff, wH: a, wA: b, payoffFactor};
  }

  // 4. Dynamic payoffs (Implementing the new requested logic)
  function dynamicPayoffs(){
    const {payoffFactor} = computeSimilarity();

    const dyn = {
      // Payoffs for both signaling should be 2 + (hobbyBoost - agePenalty) for both
      SS: { 
        A: +(2 + payoffFactor).toFixed(3), 
        B: +(2 + payoffFactor).toFixed(3) 
      },
      // Payoffs for one signaling and the other not (A signals, B waits):
      // A: -4, B: (hobbyBoost - agePenalty)
      SN: { 
        A: -4.0, 
        B: Math.max(0, +payoffFactor.toFixed(3))
      },
      // Payoffs for one signaling and the other not (A waits, B signals):
      // A: (hobbyBoost - agePenalty), B: -4
      NS: { 
        A: Math.max(0, +payoffFactor.toFixed(3)),
        B: -4.0 
      },
      // Payoffs for both doing nothing should just be 0 for both
      NN: { 
        A: 0.0, 
        B: 0.0 
      }
    };
    return dyn;
  }

  // q from similarity (B's probability of Signaling) - uses S score
  function computeQ(){
    const {S} = computeSimilarity();
    // B is more likely to Signal (q) if similarity (S) is high.
    const q = clamp(0.1 + S * 0.8, 0.05, 0.95);
    return q;
  }

  // expected payoffs
  function expectedPayoffs(p,q,dyn){
    const probSS = p*q, probSN = p*(1-q), probNS = (1-p)*q, probNN = (1-p)*(1-q);
    const expA = probSS*dyn.SS.A + probSN*dyn.SN.A + probNS*dyn.NS.A + probNN*dyn.NN.A;
    const expB = probSS*dyn.SS.B + probSN*dyn.SN.B + probNS*dyn.NS.B + probNN*dyn.NN.B;
    return {expA, expB, probs:{probSS,probSN,probNS,probNN}};
  }

  // simulation
  function simulateRuns(p,q,n=1000){
    const counts={SS:0,SN:0,NS:0,NN:0};
    for(let i=0;i<n;i++){
      const A = Math.random() < p;
      const B = Math.random() < q;
      if(A && B) counts.SS++; else if(A && !B) counts.SN++; else if(!A && B) counts.NS++; else counts.NN++;
    }
    return counts;
  }

  // update bars
  function updateBars(counts,n){
    const ss = counts.SS/n, sn = counts.SN/n, ns = counts.NS/n, nn = counts.NN/n;
    $('barSS').style.height = (ss*100 + 6) + '%';
    $('barSN').style.height = (sn*100 + 6) + '%';
    $('barNS').style.height = (ns*100 + 6) + '%';
    $('barNN').style.height = (nn*100 + 6) + '%';
    $('pctSS').textContent = `SS ${(ss*100).toFixed(1)}%`;
    $('pctSN').textContent = `SN ${(sn*100).toFixed(1)}%`;
    $('pctNS').textContent = `NS ${(ns*100).toFixed(1)}%`;
    $('pctNN').textContent = `NN ${(nn*100).toFixed(1)}%`;
  }

  // find pure NE (dynamic)
  function findPureNE(dyn){
    const A_when_B_yes = (dyn.SS.A >= dyn.NS.A) ? 'S' : 'N';
    const A_when_B_no  = (dyn.SN.A >= dyn.NN.A) ? 'S' : 'N';
    const B_when_A_S   = (dyn.SS.B >= dyn.SN.B) ? 'S' : 'N';
    const B_when_A_N   = (dyn.NS.B >= dyn.NN.B) ? 'S' : 'N';
    const nes=[];
    if(A_when_B_yes==='S' && B_when_A_S==='S') nes.push('SS');
    if(A_when_B_no==='S' && B_when_A_S==='N') nes.push('SN');
    if(A_when_B_yes==='N' && B_when_A_N==='S') nes.push('NS');
    if(A_when_B_no==='N' && B_when_A_N==='N') nes.push('NN');
    return nes;
  }

  // UI updates
  function renderProfiles(){
    $('avatarA').textContent = ($('inputNameA').value || 'A')[0].toUpperCase();
    $('avatarB').textContent = ($('inputNameB').value || 'B')[0].toUpperCase();
    $('nameAview').innerHTML = `${$('inputNameA').value || 'Your Name'}, <span id="ageAview">${$('inputAgeA').value||18}</span>`;
    $('nameBview').innerHTML = `${$('inputNameB').value || 'B'}, <span id="ageBview">${$('inputAgeB').value||19}</span>`;
    $('tagsA').innerHTML = ''; $('tagsB').innerHTML='';
    state.A.forEach(t=>{ const d=document.createElement('div'); d.className='tag'; d.textContent=t; $('tagsA').appendChild(d); });
    state.B.forEach(t=>{ const d=document.createElement('div'); d.className='tag'; d.textContent=t; $('tagsB').appendChild(d); });
  }

  function highlightNE(nes){
    ['cellSS','cellSN','cellNS','cellNN'].forEach(id=>$(id).classList.remove('nash'));
    if(nes.length){
      nes.forEach(code=>$( 'cell' + code ).classList.add('nash'));
      // show badge
      $('neBadge').innerHTML = `<div class="ne-popup">Pure NE: ${nes.join(', ')}</div>`;
    } else {
      $('neBadge').innerHTML = '';
    }
  }

  function updateAll(){
    renderHobbies();
    renderProfiles();

    // Display positive index values for UI, even if wA is internally negative/positive.
    // We display the magnitude (b) for wA to match the logic of 'Age Penalty Index (b)'.
    $('wHval').textContent = Number($('wH').value).toFixed(2);
    $('wAval').textContent = Number($('wA').value).toFixed(3); 
    $('pVal').textContent = Number($('pSlider').value).toFixed(2);

    const dyn = dynamicPayoffs();
    $('ssA').textContent = dyn.SS.A; $('ssB').textContent = dyn.SS.B;
    $('snA').textContent = dyn.SN.A; $('snB').textContent = dyn.SN.B;
    $('nsA').textContent = dyn.NS.A; $('nsB').textContent = dyn.NS.B;
    $('nnA').textContent = dyn.NN.A; $('nnB').textContent = dyn.NN.B;

    const q = computeQ();
    $('qVal').textContent = q.toFixed(3);

    // expected payoffs if A chooses S vs N (B plays q)
    const exIfS = q * dyn.SS.A + (1-q) * dyn.SN.A;
    const exIfN = q * dyn.NS.A + (1-q) * dyn.NN.A;

    // 5. Happiness Status in Recommendation
    const happinessS = getHappinessStatus(exIfS);
    const happinessN = getHappinessStatus(exIfN);

    let rec = '';
    if (exIfS > exIfN) {
      rec = `Signal (S) — Expected: ${happinessS}`;
    } else if (exIfS < exIfN) {
      rec = `Signal No (N) — Expected: ${happinessN}`;
    } else {
      rec = `S and N yield same expected payoff — Status: ${happinessS}`;
    }

    $('expA').textContent = `S: ${exIfS.toFixed(3)} ${happinessS} · N: ${exIfN.toFixed(3)} ${happinessN}`;
    $('recommend').textContent = rec;


    // Nash detection
    const nes = findPureNE(dyn);
    highlightNE(nes);
  }

  // event wiring
  function wire(){
    $('inputNameA').addEventListener('input', updateAll);
    $('inputAgeA').addEventListener('input', updateAll);
    $('inputNameB').addEventListener('input', updateAll);
    $('inputAgeB').addEventListener('input', updateAll);
    $('wH').addEventListener('input', updateAll);
    $('wA').addEventListener('input', updateAll);
    $('pSlider').addEventListener('input', ()=>{ $('pVal').textContent = Number($('pSlider').value).toFixed(2); updateAll(); });

    $('btnCompute').addEventListener('click', updateAll);

    $('btnRandom').addEventListener('click', ()=>{
      // randomize B
      const randomHobby = ()=> hobbyList[Math.floor(Math.random()*hobbyList.length)];
      state.B = new Set();
      const picks = Math.floor(Math.random()*4)+1;
      while(state.B.size < picks) state.B.add(randomHobby());
      $('inputAgeB').value = 18 + Math.floor(Math.random()*8);
      updateAll();
    });

    $('btnReset').addEventListener('click', ()=>{
      $('inputNameA').value='Your Name'; $('inputAgeA').value=18;
      $('inputNameB').value='B'; $('inputAgeB').value=19;
      state.A = new Set(['Sports','Coding','Music']);
      state.B = new Set(['Music','Movies','Hiking']);
      // Set sensible defaults for the new logic: wH=a, wA=b (positive index values)
      $('wH').value=0; // Hobby Similarity Index 'a'
      $('wA').value=0; // Age Penalty Index 'b' (must be used as magnitude)
      $('pSlider').value=0.5;
      updateAll();
    });

    // A manual actions
    $('btnSignal').addEventListener('click', ()=>{
      const q = computeQ(); const dyn = dynamicPayoffs();
      const bS = Math.random() < q;
      const outcome = bS ? 'SS' : 'SN';
      const payoffA = bS ? dyn.SS.A : dyn.SN.A;
      const payoffB = bS ? dyn.SS.B : dyn.SN.B;
      $('simResult').textContent = `Result: ${outcome} — A: ${payoffA} · B: ${payoffB} (q=${q.toFixed(3)})`;
      const counts = {SS:0,SN:0,NS:0,NN:0}; counts[outcome]=1; updateBars(counts,1);
    });

    $('btnNo').addEventListener('click', ()=>{
      const q = computeQ(); const dyn = dynamicPayoffs();
      const bS = Math.random() < q;
      const outcome = bS ? 'NS' : 'NN';
      const payoffA = bS ? dyn.NS.A : dyn.NN.A;
      const payoffB = bS ? dyn.NS.B : dyn.NN.B;
      $('simResult').textContent = `Result: ${outcome} — A: ${payoffA} · B: ${payoffB} (q=${q.toFixed(3)})`;
      const counts = {SS:0,SN:0,NS:0,NN:0}; counts[outcome]=1; updateBars(counts,1);
    });

    $('btnSim').addEventListener('click', ()=>{
      const p = Number($('pSlider').value);
      const q = computeQ();
      const runs = 1000;
      const counts = simulateRuns(p,q,runs);
      updateBars(counts,runs);
      const ex = expectedPayoffs(p,q,dynamicPayoffs());
      $('simResult').textContent = `Simulated ${runs} runs — SS ${(counts.SS/runs*100).toFixed(1)}% · SN ${(counts.SN/runs*100).toFixed(1)}% · NS ${(counts.NS/runs*100).toFixed(1)}% · NN ${(counts.NN/runs*100).toFixed(1)}%`;
    });
  }

  // initial boot
  renderHobbyPickers();
  wire();

  // Set sensible defaults for the new logic before initial updateAll
  // wH (Hobby Sim Index 'a')
  $('wH').value=0;
  // wA (Age Penalty Index 'b') - set to positive for magnitude use
  $('wA').value=0; 

  updateAll();

  // default tiny bars
  updateBars({SS:10,SN:10,NS:10,NN:10},40);
