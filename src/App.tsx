import { useEffect, useMemo, useState } from 'react'
import { Brush, Image as ImageIcon, Hand, Clapperboard, Layers, Settings2, Palette, SlidersHorizontal, Save, FolderOpen, Search, ChevronDown, CircleHelp, CircleCheck, WandSparkles, FileJson, Film, AudioLines, Play, LayoutDashboard, Monitor, Menu } from 'lucide-react'
import './App.css'
import { EngineCatalog } from './EngineCatalog'
import engineCatalog from './engine-catalog.json'
import { Workspaces } from './Workspaces'
import { ProductionStudio } from './ProductionStudio'

type Field = { key:string; title:string; kind?:'choice'|'number'|'switch'|'text'; choices?:string[]; value?:string|number|boolean; help?:string }
type Section = { id:string; title:string; subtitle:string; icon:typeof Brush; fields:Field[] }
const sections:Section[]=[
 {id:'single',title:'Single Scene',subtitle:'Một ảnh, một video vẽ tay',icon:ImageIcon,fields:[]},
 {id:'multi',title:'Multi Scene',subtitle:'Ghép ảnh theo timeline SRT và chuẩn bị video dài',icon:Clapperboard,fields:[]},
 {id:'library',title:'Thư viện 30 style',subtitle:'Danh sách phong cách trực tiếp từ engine',icon:Palette,fields:[]},
 {id:'cli',title:'12 lệnh engine',subtitle:'Thiết lập mọi tham số từ trợ giúp CLI',icon:FileJson,fields:[]},
 {id:'images',title:'Kho ảnh',subtitle:'Nhập, xem trước và quản lý ảnh',icon:ImageIcon,fields:[]},
 {id:'scenes',title:'Quản lý Scene',subtitle:'Nhập SRT, TXT, JSON và chỉnh sửa từng cảnh',icon:Layers,fields:[]},
 {id:'manager',title:'Quản lý Engine',subtitle:'Đường dẫn repo và môi trường Python',icon:Settings2,fields:[]},
 {id:'dashboard',title:'Tổng quan',subtitle:'Trạng thái project và các bước cấu hình',icon:LayoutDashboard,fields:[]},
 {id:'style',title:'Phong cách',subtitle:'Điều chỉnh phong cách hình ảnh và kịch bản',icon:Palette,fields:[
  {key:'style',title:'Phong cách hình ảnh',kind:'choice',choices:engineCatalog.styles.map(s=>s.id),value:'warm-crayon-storybook'},
  {key:'animation-preset',title:'Preset chuyển động',kind:'choice',choices:['classic','block-speedpaint'],value:'classic'},
  {key:'source-fit',title:'Vừa khung hình',kind:'choice',choices:['exact','blur-fill','contain','cover'],value:'contain'},
  {key:'stroke-detail',title:'Chi tiết nét vẽ',kind:'choice',choices:['balanced','rich','max'],value:'rich'}]},
 {id:'image',title:'Xử lý hình ảnh',subtitle:'Chuẩn hóa và trích xuất đường nét',icon:ImageIcon,fields:[
  {key:'lineart-provider',title:'Bộ nhận diện nét',kind:'choice',choices:['auto','informative','anime2sketch','anime','manga'],value:'auto'},
  {key:'preprocess-mode',title:'Xử lý ảnh',kind:'choice',choices:['edges','detail','ink','clean-detail'],value:'edges'},
  {key:'threshold',title:'Ngưỡng phân tách ảnh',kind:'number',value:128},
  {key:'clear-edge',title:'Làm sạch đường viền',kind:'switch',value:true}]},
 {id:'stroke',title:'Nét vẽ',subtitle:'Nét mực, thứ tự vẽ và chuyển động',icon:Brush,fields:[
  {key:'line-reveal',title:'Hiệu ứng hiện nét',kind:'choice',choices:['stroke','detail-wipe'],value:'stroke'},
  {key:'line-thickness',title:'Độ dày đường nét',kind:'number',value:2},
  {key:'lineart-snap-threshold',title:'Ngưỡng bám nét',kind:'number',value:96},
  {key:'no-lineart-snap',title:'Tắt bám nét gốc',kind:'switch',value:false},
  {key:'max-draw-blocks',title:'Số nhóm nét tối đa',kind:'number',value:6},
  {key:'block-order',title:'Thứ tự nhóm nét',kind:'choice',choices:['reading','source'],value:'reading'},
  {key:'block-overlap',title:'Độ chồng lấn',kind:'number',value:0.08}]},
 {id:'hand',title:'Bàn tay & màu',subtitle:'Con trỏ bàn tay và cách tô màu',icon:Hand,fields:[
  {key:'hand',title:'Kiểu bàn tay',kind:'choice',choices:['asian','black','children','white','procedural','none'],value:'asian'},
  {key:'hand-scale',title:'Tỉ lệ bàn tay',kind:'number',value:1},
  {key:'color-fill',title:'Hiệu ứng tô màu',kind:'choice',choices:['fade','contour-wipe','brush-scan','top-down-blocks','left-to-right-gradient'],value:'fade'},
  {key:'block-fill-style',title:'Chất liệu màu',kind:'choice',choices:['crayon','clean','soft-wash','dry-brush'],value:'crayon'},
  {key:'color-fill-scope',title:'Phạm vi tô',kind:'choice',choices:['block','scene'],value:'block'}]},
 {id:'scene',title:'Scene & kịch bản',subtitle:'Quản lý kịch bản, lời thoại và cảnh',icon:Layers,fields:[
  {key:'scenes',title:'Số scene dự kiến',kind:'number',value:10},
  {key:'theme',title:'Chủ đề video',kind:'text',value:''},
  {key:'draw-text-role',title:'Vai trò chữ',kind:'choice',choices:['annotation','caption'],value:'annotation'},
  {key:'draw-text-position',title:'Vị trí chữ',kind:'choice',choices:['top','center','bottom'],value:'bottom'},
  {key:'draw-text-reveal',title:'Hiệu ứng chữ',kind:'choice',choices:['stroke','line-wipe'],value:'stroke'}]},
 {id:'video',title:'Thông số video',subtitle:'Cài đặt đầu ra (chưa thực hiện render)',icon:Clapperboard,fields:[
  {key:'width',title:'Chiều rộng (px)',kind:'number',value:1920},
  {key:'height',title:'Chiều cao (px)',kind:'number',value:1080},
  {key:'fps',title:'Khung hình/giây',kind:'number',value:30},
  {key:'duration',title:'Thời lượng (giây)',kind:'number',value:12},
  {key:'tail-color',title:'Thời gian hiện màu cuối (giây)',kind:'number',value:1}]},
 {id:'system',title:'Hệ thống',subtitle:'Đường dẫn engine và cấu hình ứng dụng',icon:Settings2,fields:[
  {key:'engine',title:'Đường dẫn Whiteboard Engine',kind:'text',value:'D:\\TestTTS\\_whiteboard_engine_lab\\.venv\\Scripts\\whiteboard.exe'},
  {key:'output-dir',title:'Thư mục đầu ra mặc định',kind:'text',value:''},
  {key:'log-level',title:'Mức nhật ký',kind:'choice',choices:['INFO','DEBUG','WARNING','ERROR'],value:'INFO'}]}
]
const base = Object.fromEntries(sections.flatMap(s=>s.fields.map(f=>[f.key,f.value ?? '']))) as Record<string,string|number|boolean>
const storageKey='dvafordev.whiteboard.next.v1'
function App(){
 const [active,setActive]=useState('dashboard')
 const [config,setConfig]=useState<Record<string,string|number|boolean>>(()=>{
  try{return {...base,...JSON.parse(localStorage.getItem(storageKey) || '{}')}}catch{return base}
 })
 const [search,setSearch]=useState('')
 const [side,setSide]=useState(true)
 const [advanced,setAdvanced]=useState(false)
 const [notice,setNotice]=useState('')
 const section=sections.find(s=>s.id===active)!
 const changed=useMemo(()=>Object.keys(config).filter(k=>config[k]!==base[k]).length,[config])
 useEffect(()=>{localStorage.setItem(storageKey,JSON.stringify(config))},[config])
 function set(key:string,val:string|number|boolean){setConfig(p=>({...p,[key]:val}))}
 function download(){
  const blob=new Blob([JSON.stringify({schema:'dvafordev.whiteboard.ui.v1',engineRepo:'gnipbao/whiteboard-video-engine',configuration:config},null,2)],{type:'application/json'})
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='whiteboard-preset.json';a.click();URL.revokeObjectURL(url);setNotice('Đã xuất file cấu hình JSON.')
 }
 async function upload(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return
  try {const data=JSON.parse(await file.text());if(!data.configuration||typeof data.configuration!=='object')throw new Error('Thiếu configuration');setConfig(p=>({...p,...data.configuration}));setNotice('Đã nạp preset.')}catch{setNotice('File JSON không đúng định dạng preset.')} e.target.value=''
 }
 const filtered=sections.filter(s=>s.id!=='cli' && s.title.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
 return <div className="shell">
  <aside className={'sidebar '+(!side?'collapsed':'')}>
   <div className="brand"><div className="brand-icon"><WandSparkles size={21}/></div>{side&&<div><b>DvaForDev</b><small>WHITEBOARD STUDIO</small></div>}<button className="iconbtn toggle" onClick={()=>setSide(!side)} aria-label="Thu gọn menu">{side?<Menu size={18}/>:<ChevronDown size={18}/>}</button></div>
   {side&&<div className="sidebar-label">WORKSPACE</div>}
   {side&&<div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm chức năng..."/></div>}
   <nav>{filtered.map(s=><button key={s.id} title={s.title} className={'nav-item '+(active===s.id?'selected':'')} onClick={()=>setActive(s.id)}><s.icon size={19}/>{side&&<span>{s.title}</span>}{side&&active===s.id&&<div className="active-dot"/>}</button>)}</nav>
   <div className="advanced-block"><button className={'nav-item '+(active==='cli'?'selected':'')} onClick={()=>{setAdvanced(v=>!v);if(active==='cli')setActive('dashboard')}} title="Công cụ nâng cao"><Settings2 size={19}/>{side&&<span>Công cụ nâng cao</span>}{side&&<ChevronDown size={14}/>}</button>{advanced&&<button className={'nav-item advanced-child '+(active==='cli'?'selected':'')} onClick={()=>setActive('cli')} title="12 lệnh Engine"><FileJson size={17}/>{side&&<span>12 lệnh Engine</span>}</button>}</div>
   <div className="sidebar-bottom"><div className="engine-status"><CircleCheck size={16}/>{side&&<span>UI Preview Mode</span>}</div>{side&&<p>Render pipeline chưa kết nối</p>}</div>
  </aside>
  <main className="main">
   <header className="topbar"><div className="breadcrumbs"><span>Whiteboard Studio</span><span className="crumbsep">/</span><strong>{section.title}</strong></div><div className="topactions"><span className="version">V2 · UI FOUNDATION</span><button className="btn subtle" onClick={()=>{setConfig(base);setNotice('Đã khôi phục các giá trị mặc định.')}}>Khôi phục</button><button className="btn primary" onClick={download}><Save size={16}/>Lưu Preset</button></div></header>
   <div className="workspace">
    <div className="heading"><div><div className="eyebrow">ENGINE CONFIGURATION</div><h1>{section.title}</h1><p>{section.subtitle}</p></div><div className="step-pill"><CircleCheck size={15}/>Chỉ cấu hình · Chưa render</div></div>
    {active==='single'||active==='multi'?<ProductionStudio mode={active} config={config}/>:active==='images'||active==='scenes'||active==='manager'?<Workspaces mode={active==='images'?'images':active==='scenes'?'scenes':'manager'}/>:active==='library'||active==='cli'?<EngineCatalog mode={active==='library'?'styles':'cli'} selectedStyle={String(config['style'])} onStyleSelected={v=>set('style',v)}/>:active==='dashboard'?<div className="overview">
     <div className="welcome"><div><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Thiết kế video whiteboard<br/>theo cách của bạn.</h2><p>Khám phá và thiết lập các tính năng của Whiteboard Video Engine với giao diện mới. Render sẽ được tích hợp ở giai đoạn tiếp theo.</p><button className="btn primary" onClick={()=>setActive('style')}>Bắt đầu cấu hình <ChevronDown size={16}/></button></div><div className="welcome-art"><div className="art-board"><div className="art-circle"/><div className="art-stroke"/><WandSparkles size={52}/></div></div></div>
     <div className="metric-row"><div className="metric"><span>Nhóm chức năng</span><strong>7</strong><small>Đã có giao diện</small></div><div className="metric"><span>Thông số có thể chỉnh</span><strong>{Object.keys(base).length}</strong><small>Cấu hình engine</small></div><div className="metric"><span>Thay đổi so với mặc định</span><strong>{changed}</strong><small>Tự lưu trong ứng dụng</small></div></div>
     <h3>Truy cập nhanh</h3><div className="quick-grid">{sections.filter(s=>['style','image','stroke','hand','scene','video'].includes(s.id)).map(s=><button className="quick-card" key={s.id} onClick={()=>setActive(s.id)}><div className="quick-icon"><s.icon size={22}/></div><strong>{s.title}</strong><small>{s.subtitle}</small><ChevronDown className="quick-arrow" size={16}/></button>)}</div>
    </div>:<div className="editor-grid"><section className="setting-card"><div className="card-head"><span><SlidersHorizontal size={18}/> Tùy chỉnh</span><small>{section.fields.length} thông số</small></div><div className="field-grid">{section.fields.map(f=><label className="field" key={f.key}><div className="field-title">{f.title}<span className="field-key">--{f.key}</span></div>{f.kind==='choice'?<div className="select-wrap"><select value={String(config[f.key])} onChange={e=>set(f.key,e.target.value)}>{f.choices?.map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={15}/></div>:f.kind==='switch'?<div className="switch-row"><span>{config[f.key]?'Bật':'Tắt'}</span><input type="checkbox" checked={Boolean(config[f.key])} onChange={e=>set(f.key,e.target.checked)}/></div>:<input type={f.kind==='number'?'number':'text'} step={f.kind==='number'?'any':undefined} value={String(config[f.key])} onChange={e=>set(f.key,f.kind==='number'?Number(e.target.value):e.target.value)}/>}</label>)}</div><div className="card-footer"><CircleHelp size={15}/>Cấu hình lưu cục bộ. Không thực thi lệnh render.</div></section>
     <section className="right-column"><div className="preview-card"><div className="card-head"><span><Monitor size={18}/>Preview Workspace</span><span className="status-dot">Chưa kích hoạt</span></div><div className="preview-body"><div className="preview-image"><div className="play-icon"><Play size={26} fill="currentColor"/></div><p>Khung xem trước</p><small>Video preview sẽ khả dụng khi tích hợp render</small></div><div className="preview-toolbar"><span><Film size={15}/> 1920 × 1080</span><span><AudioLines size={15}/> Chưa có âm thanh</span></div></div></div><div className="preset-card"><h3><FileJson size={18}/> Preset hiện tại</h3><p>Xuất hoặc nhập JSON để sử dụng lại các thiết lập.</p><div className="preset-actions"><button className="btn subtle" onClick={download}><Save size={16}/>Xuất JSON</button><label className="btn subtle"><FolderOpen size={16}/>Nhập JSON<input className="hidden" type="file" accept=".json,application/json" onChange={upload}/></label></div></div></section></div>}
   </div>
   <footer className="footer"><span><span className="green-dot"/> DvaForDev Whiteboard Studio V2</span><span>{notice||'Đang xây dựng giao diện — chưa thực hiện render'}</span><span>Python Engine · UI Only</span></footer>
  </main>
 </div>
}
export default App

