<script>
(() => {
  // ===== Supabase inicializacija - VNESITE SVOJE PODATKE =====
  const SUPABASE_URL = 'https://tizjimlwfkoniixbetgr.supabase.co'; 
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpemppbWx3ZmtvbmlpeGJldGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNDgyNzgsImV4cCI6MjA3MDkyNDI3OH0.Oess7TCevLH3mO0aWxfL5M0Kb_XHEKUBYRYRXKQkdgk'; 
  const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Stanja bodo naložena asinhrono
  let TERMS = [];
  let swimmers = [];
  let attendance = {};
  let termStatus = {};

  const DAYNAME = ["","Ponedeljek","Torek","Sreda","Četrtek","Petek","Sobota","Nedelja"];
  const DAY_SHORT_MAP = {
    "ponedeljek": 1, "pon": 1,
    "torek": 2, "tor": 2,
    "sreda": 3, "sre": 3,
    "cetrtek": 4, "cet": 4,
    "petek": 5, "pet": 5,
    "sobota": 6, "sob": 6,
    "nedelja": 7, "ned": 7
  };

  // ===== UI elementi =====
  const elMonthLabel = document.getElementById("monthLabel");
  const elCalendarGrid = document.getElementById("calendarGrid");
  const elPrev = document.getElementById("prevBtn");
  const elNext = document.getElementById("nextBtn");
  const elSummaryBox = document.getElementById("summaryBox");
  const elNewFirst = document.getElementById("newFirst");
  const elNewLast = document.getElementById("newLast");
  const elAddSwimmerBtn = document.getElementById("addSwimmerBtn");
  const elSwimmerSelect = document.getElementById("swimmerSelect");
  const elTermSelect = document.getElementById("termSelect");
  const elAssignTermBtn = document.getElementById("assignTermBtn");
  const elRemoveTermBtn = document.getElementById("removeTermBtn");
  const elSwimmerInfo = document.getElementById("swimmerInfo");
  const elCsvInput = document.getElementById("csvInput");
  const elCsvTermsInput = document.getElementById("csvTermsInput");
  // Export elementi
  const elExportMonthSelect = document.getElementById("exportMonthSelect");
  const elExportYearSelect = document.getElementById("exportYearSelect");
  const elExportCsvBtn = document.getElementById("exportCsvBtn");
  // Novi termini
  const elNewTermDay = document.getElementById("newTermDay");
  const elNewTermStart = document.getElementById("newTermStart");
  const elNewTermEnd = document.getElementById("newTermEnd");
  const elNewTermDateFrom = document.getElementById("newTermDateFrom");
  const elNewTermDateTo = document.getElementById("newTermDateTo");
  const elAddTermBtn = document.getElementById("addTermBtn");
  // Upravljanje terminov
  const elTermList = document.getElementById("termList");
  // Modal
  const elModal = document.getElementById("eventModal");
  const elModalTitle = document.getElementById("modalTitle");
  const elModalMeta = document.getElementById("modalMeta");
  const elAttendanceTable = document.getElementById("attendanceTable").querySelector("tbody");
  const elToggleEventBtn = document.getElementById("toggleEventBtn");
  const elCloseModalBtn = document.getElementById("closeModalBtn");
  const elModalSwimmerSelect = document.getElementById("modalSwimmerSelect");
  const elAddToEventBtn = document.getElementById("addToEventBtn");
  // Modal note
  const elInactiveNote = document.getElementById("inactiveNote");
  const elInactiveNoteText = document.getElementById("inactiveNoteText");
  // Modal za izbiro dneva (mobilna verzija)
  const elDayModal = document.getElementById("dayModal");
  const elDayModalTitle = document.getElementById("dayModalTitle");
  const elDayModalList = document.getElementById("dayModalList");
  const elCloseDayModalBtn = document.getElementById("closeDayModalBtn");
  // Modal za urejanje terminov
  const elEditTermModal = document.getElementById("editTermModal");
  const elEditTermModalTitle = document.getElementById("editTermModalTitle");
  const elEditTermDateFrom = document.getElementById("editTermDateFrom");
  const elEditTermDateTo = document.getElementById("editTermDateTo");
  const elSaveEditTermBtn = document.getElementById("saveEditTermBtn");
  const elCloseEditTermModalBtn = document.getElementById("closeEditTermModalBtn");


  // ===== Pomožne funkcije =====
  function mkSwimmer(first,last,terms=[]){ return { first_name:first, last_name:last, terms:[...new Set(terms)] }; }
  function iso(d){ return d.toISOString().slice(0,10); }
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function isToday(d){ const t=new Date(); return d.getFullYear()==t.getFullYear() && d.getMonth()==t.getMonth() && d.getDate()==t.getDate(); }
  function isPast(d){ const t=new Date(); t.setHours(0,0,0,0); return d.getTime() < t.getTime(); }
  function startWeekday(y,m){ let w=new Date(y,m,1).getDay(); return w===0?7:w; } // pon=1

  function parseDate(dateStr) {
    const parts = dateStr.split(/[\s/.]/).filter(Boolean);
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return iso(date);
  }

  function formatDate(isoStr) {
    if (!isoStr) return "";
    const [y, m, d] = isoStr.split('-').map(Number);
    return `${String(d).padStart(2, '0')} / ${String(m).padStart(2, '0')} / ${y}`;
  }

  function getTermsForDate(date) {
    const w = date.getDay() === 0 ? 7 : date.getDay();
    const isoDate = iso(date);
    return TERMS.filter(t => isoDate >= t.date_from && isoDate <= t.date_to && t.day == w);
  }
  function termById(id){ return TERMS.find(t=>t.id===id); }

  function getAttendanceStatus(date, termId) {
    const ymd = iso(date);
    const assigned = swimmers.filter(s => s.terms.includes(termId));
    if (assigned.length === 0) return 'complete';
    
    const termAtt = attendance[ymd]?.[termId] || {};
    const hasUnmarked = assigned.some(s => termAtt[s.id] === undefined);
    return hasUnmarked ? 'unfilled' : 'complete';
  }
  
  function getTermStatus(date, termId){
    const ymd = iso(date);
    const status = termStatus[ymd]?.[termId]?.status || "active";
    const note = termStatus[ymd]?.[termId]?.note || "";
    return { status, note };
  }
  function isInactive(date, termId){ return getTermStatus(date, termId).status === "inactive"; }


  // ===== Pogled meseca =====
  let viewDate = new Date(); viewDate.setDate(1);

  function renderMonth(){
    const y=viewDate.getFullYear(), m=viewDate.getMonth();
    elMonthLabel.textContent = new Date(y,m,1).toLocaleDateString("sl-SI", {month:"long",year:"numeric"});
    elCalendarGrid.innerHTML = "";

    const pad = startWeekday(y,m)-1;
    for(let i=0;i<pad;i++){
      const div=document.createElement("div"); div.className="day disabled"; elCalendarGrid.appendChild(div);
    }

    const dim = daysInMonth(y,m);
    for(let d=1; d<=dim; d++){
      const date = new Date(y,m,d);
      const day = document.createElement("div");
      day.className="day"+(isToday(date)?" today":"");
      const num = document.createElement("div"); num.className="num"; num.textContent=d; day.appendChild(num);

      const todays = getTermsForDate(date);
      todays.sort((a,b)=> a.start_time.localeCompare(b.start_time));

      todays.forEach(t=>{
        const e = document.createElement("div");
        e.className = "event";

        const dateIsTodayOrPast = isToday(date) || isPast(date);
        if (dateIsTodayOrPast) {
            const status = getAttendanceStatus(date, t.id);
            e.classList.add(status);
        }
        if (isInactive(date, t.id)) {
            e.classList.add("disabled");
        }
        
        if (window.innerWidth <= 768) {
          e.innerHTML = `<span class="time">${t.start_time.slice(0, 5)}</span>`;
        } else {
          e.innerHTML = `<span class="time">${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}</span>`;
        }

        e.title = t.label;
        e.dataset.termId = t.id;
        day.appendChild(e);
      });

      if (todays.length > 0) {
        day.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.innerWidth <= 768) {
            openDayModal(date);
          } else {
            if (todays.length === 1) {
              openEvent(date, todays[0].id);
            } else {
              openDayModal(date);
            }
          }
        });
      }

      if (window.innerWidth <= 768 && todays.length > 3) {
        const more = document.createElement("div");
        more.className = "more-events-indicator";
        more.textContent = `+ ${todays.length - 3} več...`;
        day.appendChild(more);
      }
      
      elCalendarGrid.appendChild(day);
    }
    const summaryData = calculateSummaryData(y, m);
    renderSummary(summaryData);
  }

  // ===== NOV MODAL: izbira termina na določen dan (za mobilno verzijo) =====
  function openDayModal(date) {
    const todaysTerms = getTermsForDate(date).sort((a,b) => a.start_time.localeCompare(b.start_time));
    elDayModalTitle.textContent = `Termini za ${date.toLocaleDateString("sl-SI", { weekday: 'long', day: 'numeric', month: 'long' })}`;
    elDayModalList.innerHTML = "";

    if (todaysTerms.length === 0) {
      elDayModalList.innerHTML = "<p class='muted' style='text-align: center;'>Na ta dan ni terminov.</p>";
    } else {
      todaysTerms.forEach(t => {
        const e = document.createElement("div");
        e.className = "event";
        
        const dateIsTodayOrPast = isToday(date) || isPast(date);
        if (dateIsTodayOrPast) {
            const status = getAttendanceStatus(date, t.id);
            e.classList.add(status);
        }
        if (isInactive(date, t.id)) {
            e.classList.add("disabled");
        }

        e.innerHTML = `<span class="time">${t.start_time.slice(0, 5)}–${t.end_time.slice(0, 5)}</span>`;
        e.addEventListener("click", () => {
          closeDayModal();
          openEvent(date, t.id);
        });
        elDayModalList.appendChild(e);
      });
    }
    openModal(elDayModal);
  }

  function closeDayModal() { closeModal(elDayModal); }
  elCloseDayModalBtn.addEventListener("click", closeDayModal);
  elDayModal.addEventListener("click", (e) => { if (e.target === elDayModal) closeDayModal(); });

  // ===== MODAL: odpiranje dogodka =====
  let modalCtx = { date:null, termId:null };

  async function openEvent(date, termId){
    modalCtx = { date:new Date(date), termId };
    const t = termById(termId);
    elModalTitle.textContent = `${t.label}`;
    elModalMeta.innerHTML = `
      <span class="chip">${formatDate(iso(date))}</span>
      <span class="chip">${DAYNAME[t.day]}</span>
    `;

    const ymd = iso(date);
    
    // Asinhrono pridobivanje prisotnosti za ta termin na ta dan
    const { data, error } = await supabase
      .from('attendance')
      .select('swimmer_id, status')
      .eq('date', ymd)
      .eq('term_id', termId);
    
    if (error) {
        console.error('Napaka pri nalaganju prisotnosti:', error);
        return;
    }
    
    const termAtt = data.reduce((acc, row) => {
        acc[row.swimmer_id] = row.status;
        return acc;
    }, {});
    attendance[ymd] = { [termId]: termAtt };

    const assigned = swimmers.filter(s => s.terms.includes(termId));
    const assignedIds = new Set(assigned.map(s => s.id));
    const oneDaySwimmers = Object.keys(termAtt)
      .filter(swimmerId => !assignedIds.has(swimmerId))
      .map(swimmerId => swimmers.find(s => s.id === swimmerId));
    const allSwimmersForEvent = [...new Set([...assigned, ...oneDaySwimmers])];

    elAttendanceTable.innerHTML = "";
    if(allSwimmersForEvent.length===0){
      const tr=document.createElement("tr");
      const td=document.createElement("td"); td.colSpan=2; td.className="muted"; td.textContent="Ni dodeljenih plavalcev za ta termin.";
      tr.appendChild(td); elAttendanceTable.appendChild(tr);
    } else {
      allSwimmersForEvent.sort((a,b)=> (a.last_name+a.first_name).localeCompare(b.last_name+b.first_name)).forEach(s=>{
        const tr=document.createElement("tr");
        const td1=document.createElement("td"); td1.textContent = `${s.first_name} ${s.last_name}`;
        
        const td2=document.createElement("td");
        td2.style.display = "flex"; td2.style.gap = "4px";
        td2.style.alignItems = "center";

        const status = termAtt[s.id];
        const btnPresent = document.createElement("button");
        btnPresent.textContent = "Prisoten";
        btnPresent.className = "btn";
        if (isInactive(date, termId)) { btnPresent.disabled = true; }
        if (status === true) { btnPresent.classList.add("ok"); } else { btnPresent.classList.add("neutral"); }
        btnPresent.addEventListener("click", async ()=>{
          const { error } = await supabase
            .from('attendance')
            .upsert({ date: ymd, term_id: termId, swimmer_id: s.id, status: true }, { onConflict: ['date', 'term_id', 'swimmer_id'] });
          if (error) { console.error('Napaka pri posodabljanju prisotnosti:', error); } else {
            openEvent(date, termId);
            renderMonth();
          }
        });
        
        const btnAbsent = document.createElement("button");
        btnAbsent.textContent = "Odsoten";
        btnAbsent.className = "btn";
        if (isInactive(date, termId)) { btnAbsent.disabled = true; }
        if (status === false) { btnAbsent.classList.add("warn"); } else { btnAbsent.classList.add("neutral"); }
        btnAbsent.addEventListener("click", async ()=>{
          const { error } = await supabase
            .from('attendance')
            .upsert({ date: ymd, term_id: termId, swimmer_id: s.id, status: false }, { onConflict: ['date', 'term_id', 'swimmer_id'] });
          if (error) { console.error('Napaka pri posodabljanju prisotnosti:', error); } else {
            openEvent(date, termId);
            renderMonth();
          }
        });
        
        const btnRemove = document.createElement("button");
        btnRemove.innerHTML = "✖";
        btnRemove.className = "btn remove-btn";
        if (isInactive(date, termId)) { btnRemove.disabled = true; }
        btnRemove.addEventListener("click", async ()=>{
            const { error } = await supabase
              .from('attendance')
              .delete()
              .eq('date', ymd)
              .eq('term_id', termId)
              .eq('swimmer_id', s.id);
            if (error) { console.error('Napaka pri brisanju prisotnosti:', error); } else {
                openEvent(date, termId);
                renderMonth();
            }
        });
        
        tr.appendChild(td1); tr.appendChild(td2); 
        
        td2.appendChild(btnPresent);
        td2.appendChild(btnAbsent);
        td2.appendChild(btnRemove);
        
        elAttendanceTable.appendChild(tr);
      });
    }

    elModalSwimmerSelect.innerHTML = "";
    const currentEventSwimmerIds = allSwimmersForEvent.map(s => s.id);
    const unassigned = swimmers.filter(s => !currentEventSwimmerIds.includes(s.id))
      .sort((a,b)=> (a.last_name+a.first_name).localeCompare(b.last_name+b.first_name));
    
    if (unassigned.length > 0) {
      unassigned.forEach(s => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = `${s.first_name} ${s.last_name}`;
        elModalSwimmerSelect.appendChild(o);
      });
      elAddToEventBtn.style.display = "inline-block";
      elModalSwimmerSelect.style.display = "inline-block";
    } else {
      const o = document.createElement("option");
      o.textContent = "Vsi plavalci so že dodeljeni.";
      elModalSwimmerSelect.appendChild(o);
      elAddToEventBtn.style.display = "none";
      elModalSwimmerSelect.style.display = "none";
    }

    const termStatusObj = getTermStatus(date, termId);
    if (termStatusObj.status === "inactive") {
      elToggleEventBtn.textContent = "Aktiviraj trening";
      elInactiveNoteText.textContent = termStatusObj.note;
      elInactiveNote.style.display = "block";
    } else {
      elToggleEventBtn.textContent = "Deaktiviraj trening";
      elInactiveNoteText.textContent = "";
      elInactiveNote.style.display = "none";
    }

    elToggleEventBtn.onclick = async ()=>{
      const currentStatus = getTermStatus(date, termId).status;
      if (currentStatus === "active") {
        const note = prompt("Prosim, vnesite opombo za deaktivacijo:");
        if (note === null) return;
        const { error } = await supabase
          .from('term_status')
          .upsert({ date: ymd, term_id: termId, status: "inactive", note }, { onConflict: ['date', 'term_id'] });
        if (error) { console.error('Napaka pri posodabljanju statusa:', error); return; }
        termStatus[ymd] = termStatus[ymd] || {};
        termStatus[ymd][termId] = { status: "inactive", note };
      } else {
        const { error } = await supabase
          .from('term_status')
          .delete()
          .eq('date', ymd)
          .eq('term_id', termId);
        if (error) { console.error('Napaka pri brisanju statusa:', error); return; }
        if (termStatus[ymd]) delete termStatus[ymd][termId];
      }
      openEvent(date, termId);
      renderMonth();
    };

    openModal(elModal);
  }

  function openModal(modalEl){ modalEl.style.display="flex"; modalEl.setAttribute("aria-hidden","false"); }
  function closeModal(modalEl){ modalEl.style.display="none"; modalEl.setAttribute("aria-hidden","true"); }

  elCloseModalBtn.addEventListener("click", () => closeModal(elModal));
  elModal.addEventListener("click", (e)=>{ if(e.target === elModal) closeModal(elModal); });

  elAddToEventBtn.addEventListener("click", async ()=>{
    const swimmerId = elModalSwimmerSelect.value;
    const swimmer = swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return;
    
    const ymd = iso(modalCtx.date);
    const { error } = await supabase
      .from('attendance')
      .upsert({ date: ymd, term_id: modalCtx.termId, swimmer_id: swimmer.id, status: true }, { onConflict: ['date', 'term_id', 'swimmer_id'] });
    
    if (error) { console.error('Napaka pri dodajanju plavalca v trening:', error); } else {
      openEvent(modalCtx.date, modalCtx.termId);
      refreshSwimmerPanel();
      renderMonth();
    }
  });

  // ===== POVZETEK - POPRAVLJENA FUNKCIJA =====
  function calculateSummaryData(year, month){
    const res = swimmers.reduce((acc,s)=>{
      acc[s.id]={first:s.first_name,last:s.last_name,att:0,pos:0};
      return acc;
    }, {});
    
    const dim = daysInMonth(year, month);
    for(let d=1; d<=dim; d++){
      const date = new Date(year, month, d);
      const ymd = iso(date);
      const todaysTerms = getTermsForDate(date);
      
      todaysTerms.forEach(term => {
        if (isInactive(date, term.id)) return;
        
        const termAttendees = new Set();
        swimmers.filter(s => s.terms.includes(term.id)).forEach(s => termAttendees.add(s.id));
        
        if (attendance[ymd] && attendance[ymd][term.id]) {
          Object.keys(attendance[ymd][term.id]).forEach(sId => termAttendees.add(sId));
        }
        
        termAttendees.forEach(swimmerId => {
          const s = swimmers.find(sw => sw.id === swimmerId);
          if (!s || !res[s.id]) return;
          
          res[s.id].pos += 1;
          const attStatus = attendance[ymd]?.[term.id]?.[swimmerId];
          if (attStatus === true) {
            res[s.id].att += 1;
          }
        });
      });
    }
    return res;
  }
  
  function renderSummary(summaryData){
    let html = `<table><thead><tr><th>Plavalec</th><th>Obiskani</th><th>Možni</th><th>Delež (%)</th></tr></thead><tbody>`;
    const rows = Object.values(summaryData).sort((a,b)=> (a.last+a.first).localeCompare(b.last+b.first));
    if(rows.length===0) html += `<tr><td colspan="4" class="muted">Ni plavalcev.</td></tr>`;
    rows.forEach(r=>{
      const pct = r.pos > 0 ? (r.att/r.pos*100).toFixed(1) : "0.0";
      html += `<tr><td>${r.first} ${r.last}</td><td>${r.att}</td><td>${r.pos}</td><td>${pct}</td></tr>`;
    });
    html += `</tbody></table>`;
    elSummaryBox.innerHTML = html;
  }

  // ===== Panel: upravljanje plavalcev in terminov =====
  async function refreshSwimmerPanel(){
    elSwimmerSelect.innerHTML = "";
    swimmers.slice().sort((a,b)=> (a.last_name+a.first_name).localeCompare(b.last_name+b.first_name)).forEach(s=>{
      const o=document.createElement("option"); o.value=s.id; o.textContent=`${s.first_name} ${s.last_name}`; elSwimmerSelect.appendChild(o);
    });
    elTermSelect.innerHTML = "";
    TERMS.forEach(t=>{
      const o=document.createElement("option"); o.value=t.id; o.textContent=t.label; elTermSelect.appendChild(o);
    });
    showSwimmerInfo();
    renderTermsList();
  }

  function showSwimmerInfo(){
    const sid = elSwimmerSelect.value;
    const s = swimmers.find(x=>x.id===sid);
    if(!s){ elSwimmerInfo.textContent=""; return; }
    const chips = s.terms.map(id => `<span class="chip">${termById(id)?.label || id}</span>`).join(" ");
    elSwimmerInfo.innerHTML = `<div><strong>Termini:</strong> ${chips || "<span class='muted'>ni dodeljenih</span>"}</div>`;
  }
  elSwimmerSelect.addEventListener("change", showSwimmerInfo);
  elAddSwimmerBtn.addEventListener("click", async ()=>{
    const f=elNewFirst.value.trim(), l=elNewLast.value.trim();
    if(!f||!l){ alert("Vnesi ime in priimek."); return; }
    if(swimmers.some(s=> s.first_name.toLowerCase()===f.toLowerCase() && s.last_name.toLowerCase()===l.toLowerCase())){
      alert("Plavalec s tem imenom že obstaja."); return;
    }
    const newSwimmer = mkSwimmer(f, l, []);
    const { data, error } = await supabase
      .from('swimmers')
      .insert([newSwimmer])
      .select();
    
    if (error) {
      alert('Napaka pri dodajanju plavalca.');
      console.error(error);
    } else {
      swimmers.push(data[0]); // Dodaj nov podatek, vključno z ID-jem
      elNewFirst.value=""; elNewLast.value="";
      refreshSwimmerPanel();
      renderMonth();
      alert("Plavalec uspešno dodan.");
    }
  });
  elAssignTermBtn.addEventListener("click", async ()=>{
    const sid=elSwimmerSelect.value, tid=elTermSelect.value;
    const s=swimmers.find(x=>x.id===sid); if(!s) return;
    if(!s.terms.includes(tid)) s.terms.push(tid);
    
    const { error } = await supabase
      .from('swimmers')
      .update({ terms: s.terms })
      .eq('id', sid);
    
    if (error) {
      alert('Napaka pri dodeljevanju termina.');
      console.error(error);
    } else {
      showSwimmerInfo();
      renderMonth();
      alert("Termin dodeljen in shranjen.");
    }
  });
  elRemoveTermBtn.addEventListener("click", async ()=>{
    const sid=elSwimmerSelect.value, tid=elTermSelect.value;
    const s=swimmers.find(x=>x.id===sid); if(!s) return;
    s.terms = s.terms.filter(x=>x!==tid);
    
    const { error } = await supabase
      .from('swimmers')
      .update({ terms: s.terms })
      .eq('id', sid);
    
    if (error) {
      alert('Napaka pri odstranjevanju termina.');
      console.error(error);
    } else {
      showSwimmerInfo();
      renderMonth();
      alert("Termin odstranjen in shranjen.");
    }
  });

  // ===== NOV TERMIN - DODANA FUNKCIJA =====
  elAddTermBtn.addEventListener("click", async ()=>{
    const day = parseInt(elNewTermDay.value, 10);
    const start = elNewTermStart.value;
    const end = elNewTermEnd.value;
    const dateFrom = parseDate(elNewTermDateFrom.value);
    const dateTo = parseDate(elNewTermDateTo.value);

    if (!day || !start || !end || !dateFrom || !dateTo) {
      alert("Prosim, izpolni vsa polja in preveri format datuma (dd / mm / yyyy).");
      return;
    }
    
    const newTermId = `${DAYNAME[day].toLowerCase().slice(0,3)}-${start.replace(':','-')}-${end.replace(':','-')}`;
    const newLabel = `${DAYNAME[day]} ${start}–${end}`;

    const newTerm = {
      id: newTermId,
      day: day,
      start_time: start,
      end_time: end,
      label: newLabel,
      date_from: dateFrom,
      date_to: dateTo
    };

    const { data, error } = await supabase
      .from('terms')
      .insert([newTerm]);
    
    if (error) {
        alert("Napaka pri dodajanju termina. Morda že obstaja ID s to kombinacijo dneva in časa.");
        console.error(error);
    } else {
        TERMS.push(newTerm);
        elNewTermStart.value = "";
        elNewTermEnd.value = "";
        elNewTermDateFrom.value = "";
        elNewTermDateTo.value = "";
        
        refreshSwimmerPanel();
        renderMonth();
        alert("Nov termin uspešno dodan!");
    }
  });
  
  // ===== UREJANJE TERMINOV - SPREMENJENA FUNKCIJA =====
  let editingTermId = null;

  function renderTermsList() {
    elTermList.innerHTML = "";
    if (TERMS.length === 0) {
      elTermList.textContent = "Ni dodanih terminov.";
      elTermList.style.color = "var(--mut)";
      return;
    }
    elTermList.style.color = "inherit";

    TERMS.forEach(t => {
      const div = document.createElement("div");
      div.className = "term-item";
      
      const infoDiv = document.createElement("div");
      infoDiv.className = "term-item-info";

      const labelSpan = document.createElement("span");
      labelSpan.className = "term-item-label";
      labelSpan.textContent = t.label;

      const datesSpan = document.createElement("span");
      datesSpan.className = "term-item-dates";
      datesSpan.textContent = `Od: ${formatDate(t.date_from)}, do: ${formatDate(t.date_to)}`;

      infoDiv.appendChild(labelSpan);
      infoDiv.appendChild(datesSpan);
      div.appendChild(infoDiv);

      const actionsDiv = document.createElement("div");

      const editBtn = document.createElement("button");
      editBtn.innerHTML = "Uredi";
      editBtn.className = "btn neutral";
      editBtn.style.marginRight = "6px";
      editBtn.onclick = () => openEditTermModal(t.id);
      actionsDiv.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "✖";
      deleteBtn.className = "btn remove-btn";
      deleteBtn.onclick = () => deleteTerm(t.id);
      actionsDiv.appendChild(deleteBtn);
      
      div.appendChild(actionsDiv);

      elTermList.appendChild(div);
    });
  }

  async function deleteTerm(termId) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta termin? To bo izbrisalo tudi vse povezane podatke plavalcev in evidence prisotnosti.")) {
      return;
    }

    const { error: attError } = await supabase
      .from('attendance')
      .delete()
      .eq('term_id', termId);
    
    if (attError) { console.error("Napaka pri brisanju prisotnosti:", attError); alert("Napaka pri brisanju evidence prisotnosti. Preverite konzolo."); return; }

    const { error: statusError } = await supabase
      .from('term_status')
      .delete()
      .eq('term_id', termId);
      
    if (statusError) { console.error("Napaka pri brisanju statusa termina:", statusError); alert("Napaka pri brisanju statusa termina. Preverite konzolo."); return; }

    const { error: termError } = await supabase
      .from('terms')
      .delete()
      .eq('id', termId);

    if (termError) { console.error("Napaka pri brisanju termina:", termError); alert("Napaka pri brisanju termina. Preverite konzolo."); return; }

    for (const swimmer of swimmers) {
        if (swimmer.terms.includes(termId)) {
            swimmer.terms = swimmer.terms.filter(t => t !== termId);
            await supabase.from('swimmers').update({ terms: swimmer.terms }).eq('id', swimmer.id);
        }
    }

    TERMS = TERMS.filter(t => t.id !== termId);
    refreshSwimmerPanel();
    renderMonth();
    alert("Termin uspešno izbrisan.");
  }

  function openEditTermModal(termId) {
    editingTermId = termId;
    const term = termById(termId);
    if (!term) return;

    elEditTermModalTitle.textContent = `Uredi termin: ${term.label}`;
    elEditTermDateFrom.value = formatDate(term.date_from);
    elEditTermDateTo.value = formatDate(term.date_to);
    
    openModal(elEditTermModal);
  }

  elCloseEditTermModalBtn.addEventListener("click", () => closeModal(elEditTermModal));
  elEditTermModal.addEventListener("click", (e) => { if (e.target === elEditTermModal) closeModal(elEditTermModal); });
  elSaveEditTermBtn.addEventListener("click", async () => {
    const term = termById(editingTermId);
    if (!term) return;

    const newDateFrom = parseDate(elEditTermDateFrom.value);
    const newDateTo = parseDate(elEditTermDateTo.value);

    if (!newDateFrom || !newDateTo) {
      alert("Prosim, izpolnite oba datuma v pravilnem formatu (dd / mm / yyyy).");
      return;
    }

    const { error } = await supabase
        .from('terms')
        .update({ date_from: newDateFrom, date_to: newDateTo })
        .eq('id', editingTermId);

    if (error) {
        alert("Napaka pri posodabljanju termina.");
        console.error(error);
    } else {
        term.date_from = newDateFrom;
        term.date_to = newDateTo;
        closeModal(elEditTermModal);
        renderTermsList();
        renderMonth();
        alert("Termin uspešno posodobljen.");
    }
  });


  // ===== CSV: uvoz plavalcev z možnostjo prepisa od danes naprej - SPREMENJENA LOGIKA =====
  elCsvInput.addEventListener("change", async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const txt = await file.text();
    const lines = txt.split(/\r?\n/).filter(x=>x.trim().length>0);
    if(lines.length<2){ alert("CSV je prazen ali napačno oblikovan."); return; }
    const header = lines[0].split(",").map(h=>h.trim());
    const idxFirst = header.findIndex(h=> h==="first_name");
    const idxLast = header.findIndex(h=> h==="last_name");
    const termIdx = header.findIndex(h=> h==="terms");
    
    if (idxFirst === -1 || idxLast === -1 || termIdx === -1) {
      alert("CSV mora imeti stolpce 'first_name', 'last_name' in 'terms'.");
      return;
    }
    
    const today = iso(new Date());
    let importedSwimmers = [];
    
    for(let i=1;i<lines.length;i++){
      const cols = splitCsvLine(lines[i]); if(cols.length < termIdx) continue;
      const first = (cols[idxFirst]||"").trim();
      const last = (cols[idxLast]||"").trim();
      if(!first || !last) continue;
      const csvTermsRaw = (cols[termIdx] || "").split(",").map(t => t.trim()).filter(Boolean);
      const csvTerms = csvTermsRaw.filter(id => TERMS.some(t=>t.id===id));
      importedSwimmers.push({ first_name: first, last_name: last, terms: [...new Set(csvTerms)] });
    }

    if (importedSwimmers.length === 0) {
        alert("Ni plavalcev za uvoz.");
        return;
    }

    const { data: existingSwimmers, error: fetchError } = await supabase
        .from('swimmers')
        .select('id, first_name, last_name');
    
    if (fetchError) {
        console.error("Napaka pri nalaganju plavalcev:", fetchError);
        alert("Napaka pri nalaganju plavalcev. Preverite konzolo.");
        return;
    }

    const updates = [];
    const inserts = [];

    importedSwimmers.forEach(sData => {
        const existing = existingSwimmers.find(s => s.first_name === sData.first_name && s.last_name === sData.last_name);
        if (existing) {
            updates.push({ id: existing.id, terms: sData.terms });
        } else {
            inserts.push(sData);
        }
    });

    const { error: insertError } = await supabase.from('swimmers').insert(inserts);
    if (insertError) { console.error("Napaka pri vstavljanju novih plavalcev:", insertError); alert("Napaka pri vstavljanju novih plavalcev."); return; }
    
    for (const update of updates) {
        const { error } = await supabase.from('swimmers').update({ terms: update.terms }).eq('id', update.id);
        if (error) { console.error("Napaka pri posodabljanju plavalca:", error); }
    }

    const { error: attError } = await supabase.from('attendance').delete().gte('date', today);
    const { error: statusError } = await supabase.from('term_status').delete().gte('date', today);

    if (attError || statusError) {
        console.warn("Opozorilo: Napaka pri čiščenju zgodovine od danes naprej.", attError, statusError);
    }

    await loadDataFromSupabase();
    refreshSwimmerPanel();
    renderMonth();
    alert(`Uvoz končan. Uvoženih plavalcev: ${importedSwimmers.length}. Vse nastavitve plavalcev so posodobljene.`);
    e.target.value = "";
  });

  // ===== CSV: uvoz terminov - NOVA FUNKCIJA =====
  elCsvTermsInput.addEventListener("change", async (e)=>{
    const file = e.target.files[0]; if (!file) return;
    const txt = await file.text();
    const lines = txt.split(/\r?\n/).filter(x => x.trim().length > 0);
    if (lines.length < 2) { alert("CSV je prazen ali napačno oblikovan."); return; }

    const header = lines[0].split(",").map(h => h.trim());
    const idxId = header.findIndex(h => h === "id");
    const idxDay = header.findIndex(h => h === "day");
    const idxStart = header.findIndex(h => h === "start_time");
    const idxEnd = header.findIndex(h => h === "end_time");
    const idxFrom = header.findIndex(h => h === "date_from");
    const idxTo = header.findIndex(h => h === "date_to");
    
    if (idxId === -1 || idxDay === -1 || idxStart === -1 || idxEnd === -1 || idxFrom === -1 || idxTo === -1) {
      alert("CSV mora vsebovati stolpce 'id', 'day', 'start_time', 'end_time', 'date_from' in 'date_to'.");
      return;
    }

    let importedTerms = [];
    let errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length < 6) continue;

      const id = (cols[idxId] || "").trim();
      const day = parseInt(cols[idxDay], 10);
      const start = (cols[idxStart] || "").trim();
      const end = (cols[idxEnd] || "").trim();
      const dateFrom = parseDate(cols[idxFrom] || "");
      const dateTo = parseDate(cols[idxTo] || "");

      if (!id || isNaN(day) || !start || !end || !dateFrom || !dateTo) {
        errors.push(`Vrsta ${i+1}: manjkajoči podatki ali napačen format.`);
        continue;
      }

      const label = `${DAYNAME[day]} ${start}–${end}`;
      importedTerms.push({ id, day, start_time: start, end_time: end, label, date_from: dateFrom, date_to: dateTo });
    }

    if (errors.length > 0) {
      alert("Napake pri uvozu: \n" + errors.join("\n"));
      return;
    }
    
    const { error } = await supabase
        .from('terms')
        .upsert(importedTerms);
    
    if (error) {
        alert("Napaka pri uvozu terminov.");
        console.error(error);
    } else {
        await loadDataFromSupabase();
        refreshSwimmerPanel();
        renderMonth();
        alert(`Uvoz končan. Uvoženih terminov: ${importedTerms.length}.`);
    }
    e.target.value = "";
  });


  function splitCsvLine(line){
    const out=[]; let cur=""; let q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='\"'){ if(q && line[i+1]==='\"'){ cur+='\"'; i++; } else q=!q; }
      else if(c===',' && !q){ out.push(cur); cur=""; }
      else cur+=c;
    }
    out.push(cur); return out;
  }

  // ===== CSV: izvoz mesečne evidence - SPREMENJENA FUNKCIJA =====
  function populateExportSelects() {
    elExportMonthSelect.innerHTML = "";
    const monthNames = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
    monthNames.forEach((name, i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = name;
      elExportMonthSelect.appendChild(option);
    });

    elExportYearSelect.innerHTML = "";
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      const option = document.createElement("option");
      option.value = y;
      option.textContent = y;
      elExportYearSelect.appendChild(option);
    }
    elExportYearSelect.value = currentYear;
    elExportMonthSelect.value = new Date().getMonth();
  }

  elExportCsvBtn.addEventListener("click", ()=>{
    const year = parseInt(elExportYearSelect.value, 10);
    const month = parseInt(elExportMonthSelect.value, 10);
    const summaryData = calculateSummaryData(year, month);
    
    const rows = [["Plavalec","Obiskani","Možni","Delež (%)"]];
    const data = Object.values(summaryData).sort((a,b)=> (a.last+a.first).localeCompare(b.last+b.first));
    
    data.forEach(r=>{
      const pct = r.pos > 0 ? (r.att/r.pos*100).toFixed(1) : "0.0";
      rows.push([`${r.first} ${r.last}`, r.att, r.pos, pct]);
    });

    const csv = rows.map(r=> r.map(v=>{
      const s=(v??"").toString(); return /[",\n]/.test(s)? `"${s.replace(/"/g,'""')}"` : s;
    }).join(",")).join("\n");

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    const monthName = String(month+1).padStart(2,'0');
    const fname=`povzetek_${year}-${monthName}.csv`;
    a.download=fname; document.body.appendChild(a); a.click(); a.remove();
  });

  // ===== Navigacija meseca =====
  elPrev.addEventListener("click", ()=>{ viewDate.setMonth(viewDate.getMonth()-1); renderMonth(); });
  elNext.addEventListener("click", ()=>{ viewDate.setMonth(viewDate.getMonth()+1); renderMonth(); });

  // ===== Init (asinhrono nalaganje podatkov) =====
  async function loadDataFromSupabase() {
    // Nalaganje terminov
    const { data: termsData, error: termsError } = await supabase
        .from('terms')
        .select('*');
    if (termsError) { console.error('Napaka pri nalaganju terminov:', termsError); } else { TERMS = termsData; }

    // Nalaganje plavalcev
    const { data: swimmersData, error: swimmersError } = await supabase
      .from('swimmers')
      .select('*');
    if (swimmersError) { console.error('Napaka pri nalaganju plavalcev:', swimmersError); } else { swimmers = swimmersData; }

    // Nalaganje evidence prisotnosti
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*');
    if (attendanceError) {
      console.error('Napaka pri nalaganju evidence:', attendanceError);
    } else {
      attendance = attendanceData.reduce((acc, row) => {
          const { date, term_id, swimmer_id, status } = row;
          if (!acc[date]) acc[date] = {};
          if (!acc[date][term_id]) acc[date][term_id] = {};
          acc[date][term_id][swimmer_id] = status;
          return acc;
      }, {});
    }

    // Nalaganje statusov terminov
    const { data: termStatusData, error: termStatusError } = await supabase
      .from('term_status')
      .select('*');
    if (termStatusError) {
      console.error('Napaka pri nalaganju statusov terminov:', termStatusError);
    } else {
      termStatus = termStatusData.reduce((acc, row) => {
          const { date, term_id, status, note } = row;
          if (!acc[date]) acc[date] = {};
          acc[date][term_id] = { status, note };
          return acc;
      }, {});
    }
  }

  async function init() {
    await loadDataFromSupabase();
    refreshSwimmerPanel();
    populateExportSelects();
    renderMonth();
    elSummaryBox.textContent = "Ni podatkov."
  }

  init();
})();
</script>