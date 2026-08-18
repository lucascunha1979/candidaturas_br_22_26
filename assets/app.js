const ALL="__ALL__";

let DATA=null;
let GEO=null;
let ROWS=[];
let UF_NAMES={};

const nf=new Intl.NumberFormat("pt-BR");
const pf=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

const COLORS={
  year2022:"#6C3CF0",
  year2026:"#00A97F",
  diffPos:"#00A56A",
  diffNeg:"#E04444",
  pctPos:"#F08C00",
  border:"#263746",
  muted:"#627387"
};

function nfmt(v){ return nf.format(Number(v||0)); }
function diffFmt(v){ v=Number(v||0); return (v>0?"+":"")+nf.format(v); }

function pct(v22,v26){
  v22=Number(v22||0); v26=Number(v26||0);
  if(v22===0) return v26===0 ? 0 : null;
  return ((v26-v22)/v22)*100;
}

function pctFmt(v22,v26){
  const p=pct(v22,v26);
  if(p===null) return "—";
  return (p>0?"+":"")+pf.format(p)+"%";
}

function metricLabel(metric){
  if(metric==="2022") return "Total 2022";
  if(metric==="2026") return "Total 2026";
  if(metric==="pct") return "Variação percentual";
  return "Diferença absoluta";
}

function filters(){
  return {
    uf:document.getElementById("ufFilter").value,
    cargo:document.getElementById("cargoFilter").value,
    partido:document.getElementById("partyFilter").value,
    metrica:document.getElementById("mapMetric").value
  };
}

function isNational(cargo){ return cargo==="Presidente" || cargo==="Vice-presidente"; }
function labelUF(uf){ return uf===ALL ? "Brasil" : (UF_NAMES[uf] ? `${UF_NAMES[uf]} (${uf})` : uf); }
function labelCargo(cargo){ return cargo===ALL ? "Todos os cargos" : cargo; }
function labelPartido(partido){ return partido===ALL ? "Todos os partidos" : partido; }

function labelFiltersLine(){
  const f=filters();
  return `UF: ${labelUF(f.uf)} • Cargo: ${labelCargo(f.cargo)} • Partido: ${labelPartido(f.partido)} • Métrica: ${metricLabel(f.metrica)}`;
}

function soma(ano,uf=ALL,cargo=ALL,partido=ALL,territorial=false){
  let total=0;
  for(const r of ROWS){
    if(r.ano!==ano) continue;
    if(territorial && r.uf==="BR") continue;
    if(uf!==ALL && r.uf!==uf) continue;
    if(cargo!==ALL && r.cargo!==cargo) continue;
    if(partido!==ALL && r.partido!==partido) continue;
    total+=r.n;
  }
  return total;
}

function cards(){
  const f=filters();
  const v22=soma(2022,f.uf,f.cargo,f.partido);
  const v26=soma(2026,f.uf,f.cargo,f.partido);
  const d=v26-v22;
  const p=pct(v22,v26);

  document.getElementById("v22").textContent=nfmt(v22);
  document.getElementById("v26").textContent=nfmt(v26);
  document.getElementById("vdiff").textContent=diffFmt(d);
  document.getElementById("vpct").textContent=pctFmt(v22,v26);
  document.getElementById("vdiff").className="value "+(d>0?"positive":d<0?"negative":"");
  document.getElementById("vpct").className="value "+(p>0?"positive":p<0?"negative":"");
  document.getElementById("selection").textContent=`Seleção atual: ${labelFiltersLine()}`;

  const parte=document.getElementById("partWhole");
  if(f.uf!==ALL && !isNational(f.cargo)){
    const br22=soma(2022,ALL,f.cargo,f.partido,true);
    const br26=soma(2026,ALL,f.cargo,f.partido,true);
    const s22=br22 ? (v22/br22)*100 : 0;
    const s26=br26 ? (v26/br26)*100 : 0;
    parte.textContent=`Participação da UF no Brasil: 2022 ${pf.format(s22)}% | 2026 ${pf.format(s26)}%`;
  } else {
    parte.textContent="Diferença = 2026 menos 2022.";
  }
}

function updateContexts(){
  const line=labelFiltersLine();
  document.getElementById("mapContext").textContent=`Filtro do mapa: ${line}`;
  document.getElementById("rankingContext").textContent=`Filtro do ranking: ${line}`;
  document.getElementById("tableContext").textContent=`Filtro da tabela: ${line}`;
}

function valoresUF(uf,cargo,partido){
  const a=soma(2022,uf,cargo,partido);
  const b=soma(2026,uf,cargo,partido);
  return {a,b,d:b-a,p:pct(a,b)};
}

function mapChart(){
  const f=filters();

  if(isNational(f.cargo)){
    Plotly.react("map",[],{
      annotations:[{
        text:"Presidente e Vice-presidente possuem abrangência nacional.<br>O mapa por UF não se aplica a esse filtro.",
        x:.5,y:.5,xref:"paper",yref:"paper",showarrow:false,font:{size:16,color:"#5f6f82"}
      }],
      xaxis:{visible:false},yaxis:{visible:false},margin:{l:0,r:0,t:0,b:0},paper_bgcolor:"#fff",plot_bgcolor:"#fff"
    },{responsive:true,displayModeBar:false});
    return;
  }

  const loc=[], z=[], custom=[];

  for(const feat of GEO.features){
    const uf=feat.properties.SIGLA_UF;
    const nome=feat.properties.NM_UF;
    const v=valoresUF(uf,f.cargo,f.partido);
    let valor;
    if(f.metrica==="2022") valor=v.a;
    else if(f.metrica==="2026") valor=v.b;
    else if(f.metrica==="pct") valor=v.p;
    else valor=v.d;

    loc.push(uf);
    z.push(valor);
    custom.push([nome,nfmt(v.a),nfmt(v.b),diffFmt(v.d),pctFmt(v.a,v.b)]);
  }

  const trace={
    type:"choropleth",
    geojson:GEO,
    featureidkey:"properties.SIGLA_UF",
    locations:loc,
    z:z,
    customdata:custom,
    marker:{line:{color:COLORS.border,width:1.5}},
    hovertemplate:
      "<b>%{customdata[0]} (%{location})</b><br>"+
      "2022: %{customdata[1]}<br>"+
      "2026: %{customdata[2]}<br>"+
      "Diferença: %{customdata[3]}<br>"+
      "Variação: %{customdata[4]}<extra></extra>",
    colorbar:{thickness:15,outlinewidth:0}
  };

  if(f.metrica==="2022" || f.metrica==="2026"){
    trace.colorscale=[
      [0,"#E2ECF7"],
      [0.18,"#A9D0F5"],
      [0.42,"#55A5ED"],
      [0.68,"#1278D1"],
      [1,"#084C8D"]
    ];
    trace.zmin=0;
  } else {
    const validos=z.filter(v=>v!==null && Number.isFinite(v));
    const maxAbs=Math.max(1,...validos.map(v=>Math.abs(v)));
    trace.colorscale=[
      [0,"#D62828"],
      [0.25,"#FF7B6B"],
      [0.5,"#DCE4EA"],
      [0.75,"#4FD1B5"],
      [1,"#007A63"]
    ];
    trace.zmin=-maxAbs;
    trace.zmax=maxAbs;
    trace.zmid=0;
  }

  const traces=[trace];
  if(f.uf!==ALL){
    traces.push({
      type:"choropleth",geojson:GEO,featureidkey:"properties.SIGLA_UF",locations:[f.uf],z:[1],
      colorscale:[[0,"rgba(0,0,0,0)"],[1,"rgba(0,0,0,0)"]],showscale:false,hoverinfo:"skip",
      marker:{line:{color:"#000000",width:3.4}}
    });
  }

  Plotly.react("map",traces,{
    margin:{l:0,r:0,t:10,b:0},
    geo:{fitbounds:"locations",visible:false,bgcolor:"#ffffff",projection:{type:"mercator"}},
    paper_bgcolor:"#fff"
  },{responsive:true,displayModeBar:false});
}

function rankingData(){
  const f=filters();
  const lista=(f.partido===ALL ? DATA.meta.partidos : [f.partido]).slice();
  const dados=[];

  for(const partido of lista){
    const a=soma(2022,f.uf,f.cargo,partido);
    const b=soma(2026,f.uf,f.cargo,partido);
    const d=b-a;
    const p=pct(a,b);
    if(a>0 || b>0 || f.partido!==ALL) dados.push({partido,a,b,d,p});
  }

  if(f.metrica==="2022") dados.sort((x,y)=>y.a-x.a);
  else if(f.metrica==="2026") dados.sort((x,y)=>y.b-x.b);
  else if(f.metrica==="pct") dados.sort((x,y)=>{
    const py=(y.p===null?-Infinity:y.p), px=(x.p===null?-Infinity:x.p);
    return py-px;
  });
  else dados.sort((x,y)=>y.d-x.d);

  return dados;
}

function rankingChart(){
  const f=filters();
  const dados=rankingData();
  const chart=document.getElementById("rankingChart");

  if(!dados.length){
    chart.style.height="620px";
    Plotly.react("rankingChart",[],{
      annotations:[{text:"Sem dados para o filtro selecionado.",x:.5,y:.5,xref:"paper",yref:"paper",showarrow:false,font:{size:16,color:COLORS.muted}}],
      xaxis:{visible:false},yaxis:{visible:false},margin:{l:0,r:0,t:0,b:0},paper_bgcolor:"#fff",plot_bgcolor:"#fff"
    },{responsive:true,displayModeBar:false});
    return;
  }

  const altura=Math.max(620,dados.length*42+120);
  chart.style.height=altura+"px";
  const yLabels=dados.map(d=>d.partido);
  let traces=[];
  let layout={};

  if(f.metrica==="diff"){
    traces=[{
      type:"bar",orientation:"h",y:yLabels,x:dados.map(d=>d.d),
      marker:{color:dados.map(d=>d.d>=0?COLORS.diffPos:COLORS.diffNeg)},
      text:dados.map(d=>diffFmt(d.d)),textposition:"outside",cliponaxis:false,
      customdata:dados.map(d=>[nfmt(d.a),nfmt(d.b),diffFmt(d.d),pctFmt(d.a,d.b)]),
      hovertemplate:"<b>%{y}</b><br>2022: %{customdata[0]}<br>2026: %{customdata[1]}<br>Diferença: %{customdata[2]}<br>Variação: %{customdata[3]}<extra></extra>"
    }];
    const maxAbs=Math.max(1,...dados.map(d=>Math.abs(d.d)));
    layout={
      barmode:"group",bargap:0.5,
      margin:{l:115,r:85,t:20,b:60},
      xaxis:{title:"Diferença absoluta (2026 − 2022)",range:[-maxAbs*1.18,maxAbs*1.18],zeroline:true,zerolinecolor:"#5E6B75",gridcolor:"#E7EDF3"},
      yaxis:{automargin:true,categoryorder:"array",categoryarray:yLabels.slice().reverse()},
      paper_bgcolor:"#fff",plot_bgcolor:"#fff",showlegend:false
    };
  } else if(f.metrica==="pct"){
    const vals=dados.map(d=>d.p===null?0:d.p);
    traces=[{
      type:"bar",orientation:"h",y:yLabels,x:vals,
      marker:{color:dados.map(d=>d.p===null?"#9AA8B4":d.p>=0?COLORS.pctPos:COLORS.diffNeg)},
      text:dados.map(d=>d.p===null?"—":((d.p>0?"+":"")+pf.format(d.p)+"%")),textposition:"outside",cliponaxis:false,
      customdata:dados.map(d=>[nfmt(d.a),nfmt(d.b),diffFmt(d.d),pctFmt(d.a,d.b)]),
      hovertemplate:"<b>%{y}</b><br>2022: %{customdata[0]}<br>2026: %{customdata[1]}<br>Diferença: %{customdata[2]}<br>Variação: %{customdata[3]}<extra></extra>"
    }];
    const maxAbs=Math.max(1,...vals.map(v=>Math.abs(v)));
    layout={
      barmode:"group",bargap:0.5,
      margin:{l:115,r:95,t:20,b:60},
      xaxis:{title:"Variação percentual",range:[-maxAbs*1.18,maxAbs*1.18],zeroline:true,zerolinecolor:"#5E6B75",gridcolor:"#E7EDF3",ticksuffix:"%"},
      yaxis:{automargin:true,categoryorder:"array",categoryarray:yLabels.slice().reverse()},
      paper_bgcolor:"#fff",plot_bgcolor:"#fff",showlegend:false
    };
  } else {
    traces=[
      {type:"bar",orientation:"h",y:yLabels,x:dados.map(d=>d.a),name:"2022",marker:{color:COLORS.year2022},hovertemplate:"<b>%{y}</b><br>2022: %{x}<extra></extra>"},
      {type:"bar",orientation:"h",y:yLabels,x:dados.map(d=>d.b),name:"2026",marker:{color:COLORS.year2026},hovertemplate:"<b>%{y}</b><br>2026: %{x}<extra></extra>"}
    ];
    layout={
      barmode:"group",bargap:0.5,bargroupgap:0.18,
      margin:{l:115,r:35,t:30,b:60},
      xaxis:{title:"Número de candidaturas",rangemode:"tozero",gridcolor:"#E7EDF3"},
      yaxis:{automargin:true,categoryorder:"array",categoryarray:yLabels.slice().reverse()},
      legend:{orientation:"h",y:1.06,x:0},paper_bgcolor:"#fff",plot_bgcolor:"#fff"
    };
  }

  Plotly.react("rankingChart",traces,layout,{responsive:true,displayModeBar:false});
}

function tableUF(){
  const f=filters();
  const tbody=document.getElementById("ufBody");
  const lista=[];

  for(const feat of GEO.features){
    const uf=feat.properties.SIGLA_UF;
    const nome=feat.properties.NM_UF;
    const v=valoresUF(uf,f.cargo,f.partido);
    lista.push({uf,nome,a:v.a,b:v.b,d:v.d,p:v.p});
  }

  lista.sort((x,y)=>y.b-x.b);
  tbody.innerHTML=lista.map(r=>{
    const selected=(r.uf===f.uf)?"selected":"";
    const dc=r.d>0?"positive":r.d<0?"negative":"";
    const pc=r.p>0?"positive":r.p<0?"negative":"";
    return `<tr class="${selected}"><td>${r.uf}</td><td>${r.nome}</td><td>${nfmt(r.a)}</td><td>${nfmt(r.b)}</td><td class="${dc}">${diffFmt(r.d)}</td><td class="${pc}">${pctFmt(r.a,r.b)}</td></tr>`;
  }).join("");
}

function notes(){
  const apt=DATA.meta.aptidao_2022||{};
  const aptos=Number(apt["Apto"]||0), inaptos=Number(apt["Inapto"]||0);
  const total=aptos+inaptos;
  const pa=total?(aptos/total)*100:0;

  const jul=DATA.meta.julgamento_2026||{};
  const aguardando=Number(jul["Aguardando julgamento"]||0);
  const tj=Object.values(jul).reduce((a,b)=>a+Number(b||0),0);
  const pj=tj?(aguardando/tj)*100:0;

  document.getElementById("notes").innerHTML=`
    <h2>Notas metodológicas</h2>
    <p><b>2022:</b> a base contém ${nfmt(DATA.meta.total_2022)} registros. ${nfmt(aptos)} (${pf.format(pa)}%) foram classificados como aptos e ${nfmt(inaptos)} (${pf.format(100-pa)}%) como inaptos.</p>
    <p><b>2026:</b> a base contém atualmente ${nfmt(DATA.meta.total_2026)} registros. ${nfmt(aguardando)} (${pf.format(pj)}%) constavam como “Aguardando julgamento” na extração utilizada.</p>
    <p><b>Cargos agregados:</b> 1º e 2º Suplentes foram reunidos em <i>Suplente</i>. Deputado Estadual e Deputado Distrital foram reunidos em <i>Deputado Estadual/Distrital</i>.</p>
    <p><b>Partidos:</b> as siglas foram preservadas conforme cada eleição. Apenas a grafia PC do B foi padronizada para PCDOB.</p>
    <p><b>Leitura:</b> Diferença = 2026 − 2022. Variação percentual = (2026 − 2022) / 2022 × 100. Quando 2022 é zero, a variação percentual aparece como “—”.</p>`;
}

function nationalControl(){
  const cargo=document.getElementById("cargoFilter").value;
  const uf=document.getElementById("ufFilter");
  if(isNational(cargo)){ uf.value=ALL; uf.disabled=true; }
  else uf.disabled=false;
}

function update(){
  nationalControl();
  updateContexts();
  cards();
  mapChart();
  rankingChart();
  tableUF();
}

function fillFilters(){
  const ufSelect=document.getElementById("ufFilter");
  ufSelect.innerHTML=`<option value="${ALL}">Brasil</option>`;
  const features=GEO.features.slice().sort((a,b)=>a.properties.NM_UF.localeCompare(b.properties.NM_UF,"pt-BR"));

  for(const feat of features){
    const p=feat.properties;
    UF_NAMES[p.SIGLA_UF]=p.NM_UF;
    ufSelect.insertAdjacentHTML("beforeend",`<option value="${p.SIGLA_UF}">${p.NM_UF} (${p.SIGLA_UF})</option>`);
  }

  const cargo=document.getElementById("cargoFilter");
  cargo.innerHTML=`<option value="${ALL}">Todos os cargos</option>`;
  DATA.meta.cargos.forEach(c=>cargo.insertAdjacentHTML("beforeend",`<option value="${c}">${c}</option>`));

  const partido=document.getElementById("partyFilter");
  partido.innerHTML=`<option value="${ALL}">Todos os partidos</option>`;
  DATA.meta.partidos.forEach(p=>partido.insertAdjacentHTML("beforeend",`<option value="${p}">${p}</option>`));
}

async function exportPDF(){
  const botao=document.getElementById("pdfButton");
  const status=document.getElementById("pdfStatus");
  botao.disabled=true; status.textContent="Gerando PDF...";

  try{
    const elemento=document.getElementById("report");
    const canvas=await html2canvas(elemento,{scale:1.15,backgroundColor:"#ffffff",useCORS:true,logging:false});
    const img=canvas.toDataURL("image/jpeg",.90);
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF("p","mm","a4");
    const pw=210,ph=297,margem=6,iw=pw-(margem*2),ih=canvas.height*iw/canvas.width;
    let restante=ih,pos=margem;
    pdf.addImage(img,"JPEG",margem,pos,iw,ih);
    restante-=ph-(margem*2);
    while(restante>0){
      pos=margem-(ih-restante);
      pdf.addPage();
      pdf.addImage(img,"JPEG",margem,pos,iw,ih);
      restante-=ph-(margem*2);
    }
    const f=filters();
    const nome=["candidaturas",f.uf===ALL?"Brasil":f.uf,f.cargo===ALL?"TodosCargos":f.cargo,f.partido===ALL?"TodosPartidos":f.partido].join("_").replace(/[^A-Za-z0-9_-]+/g,"-");
    pdf.save(nome+".pdf");
    status.textContent="PDF gerado.";
  }catch(e){ console.error(e); status.textContent="Erro ao gerar PDF."; }
  finally{ botao.disabled=false; setTimeout(()=>status.textContent="",3000); }
}

async function init(){
  const responses=await Promise.all([fetch("data/painel.json"),fetch("data/br_ufs.geojson")]);
  if(!responses[0].ok) throw new Error("Erro ao carregar painel.json");
  if(!responses[1].ok) throw new Error("Erro ao carregar br_ufs.geojson");

  DATA=await responses[0].json();
  GEO=await responses[1].json();
  ROWS=DATA.rows.map(r=>({ano:Number(r[0]),uf:String(r[1]),partido:String(r[2]),cargo:String(r[3]),n:Number(r[4])}));

  fillFilters();
  notes();
  ["ufFilter","cargoFilter","partyFilter","mapMetric"].forEach(id=>document.getElementById(id).addEventListener("change",update));

  document.getElementById("resetButton").addEventListener("click",()=>{
    document.getElementById("ufFilter").value=ALL;
    document.getElementById("cargoFilter").value=ALL;
    document.getElementById("partyFilter").value=ALL;
    document.getElementById("mapMetric").value="diff";
    update();
  });

  document.getElementById("pdfButton").addEventListener("click",exportPDF);
  update();

  document.getElementById("map").on("plotly_click",evt=>{
    if(!evt || !evt.points || !evt.points.length) return;
    const uf=evt.points[0].location;
    if(!uf) return;
    const seletor=document.getElementById("ufFilter");
    seletor.value=(seletor.value===uf?ALL:uf);
    update();
  });
}

init().catch(e=>{
  console.error(e);
  document.body.insertAdjacentHTML("beforeend",`<div style="padding:20px;color:#a00;font-family:Arial"><b>Erro ao carregar o painel.</b><br>${e.message}</div>`);
});
