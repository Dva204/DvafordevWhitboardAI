import { useMemo, useState } from 'react'
import { BookOpen, Search, ListFilter, FileCode2, ClipboardCopy } from 'lucide-react'
import catalog from './engine-catalog.json'
import './EngineCatalog.css'
import { styleDescriptionsVi } from './styleDescriptionsVi'
type Style = {id:string;order:number;name_en:string;name_zh:string;compatibility:string;summary:string;best_for:string[];palette?:string; aesthetic?:string}
type Args = Record<string,string|boolean>
const allStyles = catalog.styles as Style[]
const commands = catalog.commands as Record<string,{help:string;exitCode:number}>
function parseOptions(help:string){
 const groups = help.split(/\noptions:\s*\n/);const lines=(groups[1]||'').split('\n');const options:{flag:string;arg?:string;desc:string}[]=[]
 for(const line of lines){
  const m=line.match(/^\s+(?:-[a-z],\s*)?(--[a-z][\w-]*)(?:\s+(\{[^}]+\}|[A-Z][A-Z_0-9-]*))?(?:\s{2,}(.*))?$/)
  if(m && m[1]!=='--help')options.push({flag:m[1],arg:m[2],desc:m[3]||''})
  else if(options.length && /^\s{20,}\S/.test(line)) options[options.length-1].desc+=' '+line.trim()
 }
 return options
}
export function EngineCatalog({mode,onStyleSelected,selectedStyle}:{mode:'styles'|'cli';onStyleSelected:(v:string)=>void;selectedStyle:string}){
 const [filter,setFilter]=useState('')
 const [kind,setKind]=useState('all')
 const [command,setCommand]=useState('render-photo')
 const [args,setArgs]=useState<Record<string,Args>>({})
 const styles=useMemo(()=>allStyles.filter(s=>(kind==='all'||s.compatibility===kind) &&
 (s.name_en+' '+s.id+' '+s.name_zh+' '+s.summary+' '+(styleDescriptionsVi[s.id]||'')).toLocaleLowerCase().includes(filter.toLocaleLowerCase())),[filter,kind])
 const choices=[...new Set(allStyles.map(s=>s.compatibility))]
 const specs=parseOptions(commands[command].help)
 const current=args[command]||{}
 const update=(k:string,v:string|boolean)=>setArgs(p=>({...p,[command]:{...p[command],[k]:v}}))
 function save(){
  const b=new Blob([JSON.stringify({schema:'dvafordev.whiteboard.command-config.v1',command,options:current},null,2)],{type:'application/json'})
  const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='whiteboard-'+command+'-config.json';a.click();URL.revokeObjectURL(url)
 }
 const output=['whiteboard',command,...Object.entries(current).flatMap(([k,v])=>v===false||v===''?[]:v===true?[k]:[k,JSON.stringify(v)])].join(' ')
 return <section className="catalog">
 {mode==='styles'?<>
  <div className="catalog-header"><div><h2><BookOpen size={19}/> Thư viện phong cách của engine</h2><p>{allStyles.length} phong cách được lấy từ bản engine cài trên máy · chọn để cập nhật preset</p></div><div className="catalog-tools"><div className="catalog-search"><Search size={16}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tìm phong cách..."/></div><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Tất cả</option>{choices.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
  <div className="catalog-count"><ListFilter size={15}/> {styles.length} kết quả · Đang chọn: {selectedStyle}</div>
  <div className="style-grid">{styles.map(s=><button className={'style-card '+(selectedStyle===s.id?'active':'')} key={s.id} onClick={()=>onStyleSelected(s.id)}>
    <span className="style-index">{String(s.order).padStart(2,'0')}</span><strong>{s.name_en}</strong><small>{s.id}</small><div className="style-summary">{styleDescriptionsVi[s.id] || s.name_en}</div><span className="style-compat">{s.compatibility}</span></button>)}</div>
 </>:<>
  <div className="catalog-header"><div><h2><FileCode2 size={19}/> Danh mục lệnh CLI</h2><p>Đầy đủ {Object.keys(commands).length} lệnh hiện có · chỉ chỉnh và xuất cấu hình, không thực thi</p></div><button className="btn primary" onClick={save}>Xuất JSON lệnh</button></div>
  <div className="command-layout"><div className="command-menu">{Object.keys(commands).map(c=><button key={c} onClick={()=>setCommand(c)} className={c===command?'chosen':''}>{c}</button>)}</div>
  <div className="command-panel"><h3>{command}</h3><p className="command-hint">{commands[command].help.split('\n')[0]}</p><div className="command-form">{specs.map(spec=>{
  const sel=spec.arg?.startsWith('{')?spec.arg.slice(1,-1).split(','):null
  return <label className="command-field" key={spec.flag}><span>{spec.flag}</span><small>{spec.desc}</small>
    {sel?<select value={String(current[spec.flag]||'')} onChange={e=>update(spec.flag,e.target.value)}><option value="">Theo mặc định</option>{sel.map(c=><option key={c} value={c}>{c}</option>)}</select>
      :spec.arg?<input placeholder={spec.arg} value={String(current[spec.flag]||'')} onChange={e=>update(spec.flag,e.target.value)}/>
      :<input type="checkbox" checked={Boolean(current[spec.flag])} onChange={e=>update(spec.flag,e.target.checked)}/>}</label>
  })}</div><h4>Câu lệnh tham khảo (chưa chạy)</h4><div className="command-preview"><code>{output}</code><button aria-label="Sao chép" title="Sao chép" onClick={()=>navigator.clipboard?.writeText(output)}><ClipboardCopy size={16}/></button></div>
  <details className="raw-help"><summary>Xem trợ giúp CLI nguyên bản</summary><pre>{commands[command].help}</pre></details>
  </div></div>
 </>}</section>
}
