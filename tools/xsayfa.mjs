import { acSayfalari } from "../tools/xsheets.mjs";
const s=(await acSayfalari(process.argv[2])).find(x=>x.ad===process.argv[3]);
for(const r of (s.satirlar||[]).slice(0,Number(process.argv[4]||30))){
  const c=Object.entries(r).filter(([k])=>k!=="r").sort((a,b)=>a[0].length-b[0].length||a[0].localeCompare(b[0]));
  if(c.length) console.log(`R${r.r}: `+c.map(([k,v])=>`${k}=${v}`).join(" | "));
}
