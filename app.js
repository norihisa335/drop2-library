const roots=["C","C#/Db","D","D#/Eb","E","F","F#/Gb","G","G#/Ab","A","A#/Bb","B"];
const qualities=["Maj7","7","m7","m7♭5"];
const defaults=[["C","Maj7"],["A","m7"],["D","m7"],["G","7"]];

function options(items,selected){return items.map(x=>`<option${x===selected?" selected":""}>${x}</option>`).join("")}

document.querySelector("#chordGrid").innerHTML=defaults.map((d,i)=>`
<article class="chord-card">
<h3>Chord ${i+1}</h3>
<label><span>Root</span><select>${options(roots,d[0])}</select></label>
<label><span>Quality</span><select>${options(qualities,d[1])}</select></label>
</article>`).join("");

let matrix='<div></div>'+[1,2,3,4].map(i=>`<div class="matrix-heading">Chord ${i}</div>`).join("");
for(let r=1;r<=4;r++){matrix+=`<div class="matrix-row-label">${r}</div>`+[1,2,3,4].map(()=>'<button class="mini-diagram">Diagram</button>').join("")}
document.querySelector("#voicingMatrix").innerHTML=matrix;

function showPage(name){
  document.querySelectorAll("[data-page]").forEach(p=>p.classList.toggle("is-active",p.dataset.page===name));
  window.scrollTo(0,0);
  history.replaceState(null,"",name==="home"?"#":`#${name}`);
}
document.addEventListener("click",e=>{
  const open=e.target.closest("[data-open-page]");
  if(open)return showPage(open.dataset.openPage);
  if(e.target.closest("[data-back]"))return showPage("home");
  const seg=e.target.closest(".segmented-control button");
  if(seg)seg.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("is-selected",b===seg));
});
const initial=location.hash.slice(1);
showPage(["form","voicing"].includes(initial)?initial:"home");
