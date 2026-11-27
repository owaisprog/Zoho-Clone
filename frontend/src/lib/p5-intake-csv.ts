// Bounded, single-line RFC-style CSV fields. Multiline cells are not supported.
const headers=["companyName","contactEmail","source"];
function fields(line:string):string[]|null{
 const out:string[]=[];let field="",quoted=false,closed=false;
 for(let i=0;i<line.length;i++){const ch=line[i]!;
 if(quoted){if(ch==='"'){if(line[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;}
 else if(ch===","){out.push(field);field="";closed=false;}
 else if(ch==='"'&&field===""&&!closed)quoted=true;
 else if(ch==='"'||closed)return null;else field+=ch;
 }
 if(quoted)return null;out.push(field);return out;
}
export function parseIntakeCsv(raw:unknown):(string[]|null)[]{
 if(typeof raw!=="string"||raw.length>8000||/[^\x20-\x7e\r\n\t]/.test(raw))throw new Error("CSV_INVALID");
 const lines=raw.replace(/\r\n/g,"\n").split("\n");if(lines.at(-1)==="")lines.pop();
 if(lines.length<2||lines.length>21)throw new Error("CSV_INVALID");
 const header=fields(lines.shift()!);if(!header||header.length!==3||new Set(header).size!==3||headers.some(h=>!header.includes(h)))throw new Error("CSV_HEADERS");
 return lines.map(line=>{const row=fields(line);if(!row||row.length!==3)return null;return headers.map(h=>row[header.indexOf(h)]!.trim());});
}
export function validIntakeRow(row:string[]|null):boolean{return !!row&&row.length===3&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/.test(row[0]!)&&/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(row[1]!)&&["WEBSITE","REFERRAL","EVENT"].includes(row[2]!);}
