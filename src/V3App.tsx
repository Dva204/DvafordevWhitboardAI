import {useState,useRef,useEffect} from 'react'
import {invoke,isTauri} from '@tauri-apps/api/core'
import {open} from '@tauri-apps/plugin-dialog'
import {Image,Palette,SlidersHorizontal,Settings,FolderOpen,Play,Square,Save,Upload,Monitor,Search} from 'lucide-react'
import catalog from './engine-catalog.json'
import {styleDescriptionsVi} from './styleDescriptionsVi'
import ModelManager from './ModelManager'
import './V3App.css'
type Value=string|number|boolean
type Config=Record<string,Value>
const defaults:Config={'engine':'D:\\TestTTS\\_whiteboard_engine_lab\\.venv\\Scripts\\whiteboard.exe','outputFolder':'','width':1280,'height':720,'fps':24,'duration':8,'method':'render-image','source-fit':'contain','hand':'asian','hand-scale':1,'stroke-detail':'rich','line-reveal':'stroke','line-thickness':2,'tail-color':1,'color-fill':'fade','block-fill-style':'crayon','color-fill-scope':'block','animation-preset':'classic','lineart-provider':'auto','lineart-snap-threshold':96,'no-lineart-snap':false,'max-draw-blocks':6,'block-overlap':0.08,'block-order':'reading','draw-text':'','draw-text-role':'annotation','draw-text-position':'bottom','draw-text-reveal':'stroke','draw-text-align':'center','draw-text-order':'after','draw-text-width':0.85,'draw-text-max-height':0.3,'draw-text-line-spacing':1.2,'draw-text-font-size':32,'story-text':'','draw-blocks':4,'block-sequence':'','base-line-opacity':0,'color-blocks':4,'style':'warm-crayon-storybook'}
const nav=[{id:'single',label:'Single Scene',icon:Image},{id:'styles',label:'Style & Hand',icon:Palette},{id:'advanced',label:'Advanced Draw',icon:SlidersHorizontal},{id:'system',label:'System',icon:Settings},{id:'models',label:'Engine & Model AI',icon:FolderOpen}] as const
type FieldSpec=[string,string,string[]?]
const sections:[{title:string;fields:FieldSpec[]},...{title:string;fields:FieldSpec[]}[]]=[
 {title:'Hiệu ứng nét',fields:[['stroke-detail','Độ chi tiết nét',['balanced','rich','max']],['line-reveal','Cách nét xuất hiện',['stroke','detail-wipe']],['line-thickness','Độ dày nét'],['lineart-snap-threshold','Ngưỡng bám nét'],['no-lineart-snap','Tắt bám nét'],['max-draw-blocks','Số nhóm nét tối đa'],['block-order','Thứ tự nhóm nét',['reading','source']],['block-overlap','Độ chồng nhóm'],['draw-blocks','Số khối vẽ',],['block-sequence','Thứ tự khối (VD: 1,0)']]},
 {title:'Tô màu & chuyển động',fields:[['color-fill','Cách tô màu',['fade','contour-wipe','brush-scan','top-down-blocks','left-to-right-gradient']],['block-fill-style','Chất liệu màu',['crayon','clean','soft-wash','dry-brush']],['color-fill-scope','Phạm vi tô',['block','scene']],['color-blocks','Số khối tô màu'],['base-line-opacity','Độ đậm nền nét'],['tail-color','Thời gian tô cuối'],['animation-preset','Kiểu animation',['classic','block-speedpaint']]]},
 {title:'Bàn tay & nét AI',fields:[['hand','Kiểu bàn tay',catalog.hands],['hand-scale','Kích thước bàn tay'],['lineart-provider','Model tách nét (render-photo)',['auto','informative','anime2sketch','anime','manga']]]},
 {title:'Chữ trên video',fields:[['draw-text','Nội dung chữ'],['draw-text-role','Vai trò chữ',['annotation','caption']],['draw-text-position','Vị trí chữ',['bottom','top','center']],['draw-text-reveal','Hiệu ứng chữ',['stroke','line-wipe']],['draw-text-align','Canh chữ',['left','center','right']],['draw-text-order','Thứ tự hiện chữ',['before','after']],['draw-text-width','Bề rộng chữ (0.1-1)'],['draw-text-max-height','Chiều cao chữ (0.1-1)'],['draw-text-line-spacing','Giãn dòng'],['draw-text-font-size','Cỡ chữ (px)'],['story-text','Chữ kể chuyện (legacy)']]},
]
function exportJson(name:string,data:unknown){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.download=name;a.href=u;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function load(){try{return {...defaults,...JSON.parse(localStorage.getItem('dvafordev.single.v3')||'{}')}}catch{return defaults}}
export default function V3App(){
 const [tab,setTab]=useState('single'),[cfg,setCfg]=useState<Config>(load),[file,setFile]=useState<File|null>(null)
 const [img,setImg]=useState(''),[status,setStatus]=useState('Sẵn sàng'),[working,setWorking]=useState(false)
 const [result,setResult]=useState(''),[video,setVideo]=useState(''),[log,setLog]=useState('')
 const [doctorResult,setDoctorResult]=useState('')
 const [filter,setFilter]=useState(''),[advancedOpen,setAdvancedOpen]=useState<string[]>(['Hiệu ứng nét'])
 const cancelling=useRef(false)
 useEffect(()=>{localStorage.setItem('dvafordev.single.v3',JSON.stringify(cfg))},[cfg])
 function set(k:string,v:Value){setCfg(p=>({...p,[k]:v}))}
 function field(f:FieldSpec){const [key,title]=f;const opts=f[2]||null;return <label className="v3-field" key={key}><span>{title}<small>{key}</small></span>{opts?<select value={String(cfg[key])} onChange={e=>set(key,e.target.value)}>{opts.map(o=><option key={o}>{o}</option>)}</select>:typeof cfg[key]==='boolean'?<input type="checkbox" checked={Boolean(cfg[key])} onChange={e=>set(key,e.target.checked)}/>:<input type={typeof cfg[key]==='number'?'number':'text'} step="any" value={String(cfg[key]??'')} onChange={e=>set(key,typeof cfg[key]==='number'?Number(e.target.value):e.target.value)}/>}</label>}
 async function pickEngine(){if(!isTauri()){setStatus('Cần chạy trong Tauri desktop');return}const p=await open({multiple:false,filters:[{name:'Executable',extensions:['exe']}]});if(typeof p==='string')set('engine',p)}
 async function checkDoctor(){if(!isTauri()){setStatus('Cần chạy trong Tauri desktop');return}setDoctorResult('Đang kiểm tra...');try{setDoctorResult(await invoke<string>('doctor_engine',{exe:String(cfg.engine)}))}catch(e){setDoctorResult(String(e))}}
 async function pickFolder(){if(!isTauri()){setStatus('Hãy mở ứng dụng bằng npm exec tauri dev để chọn thư mục.');return}try{const v=await open({directory:true,multiple:false,title:'Chọn thư mục xuất MP4'});if(typeof v==='string')set('outputFolder',v)}catch(e){setStatus(String(e))}}
 async function render(){
  if(!isTauri()){setStatus('Không thể render trên trình duyệt. Mở bằng npm exec tauri dev.');return}
  if(!file){setStatus('Hãy chọn một ảnh đầu vào.');return}
  if(cfg.method==='render-photo'&&!window.confirm('render-photo cần model AI tách nét. Chọn OK để chuyển sang render-image, hoặc Cancel để dừng render.')){setStatus('Cần cài model AI để chạy render-photo.');return}
  const selectedMethod=cfg.method==='render-photo'?'render-image':cfg.method;
  if(selectedMethod!==cfg.method)set('method',selectedMethod)
  if(!Number.isFinite(Number(cfg.duration))||Number(cfg.duration)<=0){setStatus('Thời lượng không hợp lệ.');return}
  if(!cfg.outputFolder){setStatus('Hãy chọn thư mục xuất video.');return}
  if(working)return
  setWorking(true);cancelling.current=false;setResult('');setLog('');if(video)URL.revokeObjectURL(video);setVideo('')
  const project='single_'+Date.now()
  try{
   setStatus('Đang lưu ảnh đầu vào...')
   const ext=(file.name.split('.').pop()||'png').replace(/[^a-z0-9]/gi,'').toLowerCase()
   const input=await invoke<string>('save_input',{project,name:'input.'+ext,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))})
   if(cancelling.current)throw new Error('Đã hủy')
   setStatus('Đang xử lý nét và render video...')
   const args={exe:String(cfg.engine),project,command:selectedMethod,image:input,clips:null,output:'whiteboard_'+Date.now()+'.mp4',outputFolder:String(cfg.outputFolder),duration:Number(cfg.duration),fps:Number(cfg.fps),width:Number(cfg.width),height:Number(cfg.height),sourceFit:cfg['source-fit'],hand:cfg.hand,handScale:Number(cfg['hand-scale']),strokeDetail:cfg['stroke-detail'],lineReveal:cfg['line-reveal'],colorFill:cfg['color-fill'],lineThickness:Number(cfg['line-thickness']),tailColor:Number(cfg['tail-color']),animationPreset:cfg['animation-preset'],blockFillStyle:cfg['block-fill-style'],colorFillScope:cfg['color-fill-scope'],lineartProvider:cfg['lineart-provider'],lineartSnapThreshold:Number(cfg['lineart-snap-threshold']),noLineartSnap:Boolean(cfg['no-lineart-snap']),maxDrawBlocks:Number(cfg['max-draw-blocks']),blockOverlap:Number(cfg['block-overlap']),blockOrder:cfg['block-order'],drawText:String(cfg['draw-text']),drawTextRole:cfg['draw-text-role'],drawTextPosition:cfg['draw-text-position'],drawTextReveal:cfg['draw-text-reveal'],extras:Object.fromEntries(['color-blocks','base-line-opacity','draw-text-width','draw-text-max-height','draw-text-line-spacing','draw-text-font-size','draw-blocks','draw-text-align','draw-text-order','story-text','block-sequence'].map(k=>[k,cfg[k]]))}
   const path=await invoke<string>('run_engine',args)
   setResult(path);setStatus('Render hoàn tất')
   try{const bytes=await invoke<number[]>('read_preview',{path});setVideo(URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'video/mp4'})))}catch(e){setLog('Không tải được preview nội bộ: '+String(e))}
  }catch(e){setStatus('Render lá»—i');setLog(String(e))}
  finally{setWorking(false)}
 }
 async function stop(){cancelling.current=true;try{await invoke('cancel_render');setStatus('Đã yêu cầu hủy render')}catch(e){setLog(String(e))}}
 async function importPreset(f:File){try{const x=JSON.parse(await f.text());const obj=x.configuration||x;if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON không hợp lệ');setCfg(p=>({...p,...Object.fromEntries(Object.entries(obj).filter(([k,v])=>k in defaults && (typeof v === typeof defaults[k]))) as Config}));setStatus('Đã nạp preset')}catch(e){setStatus('Không thể nạp preset: '+String(e))}}
 function applyStyle(id:string){
  const selected=catalog.styles.find(item=>item.id===id)
  if(!selected){setStatus('Không tìm thấy phong cách');return}
  const r=selected.render
  setCfg(prev=>({...prev,style:id,
   'block-fill-style':r.block_fill_style,
   'color-fill-scope':r.color_fill_scope,
   'stroke-detail':r.stroke_detail,
   'line-thickness':r.line_thickness,
   'no-lineart-snap':!r.line_art_snap,
   'lineart-snap-threshold':r.line_art_snap_threshold,
   'max-draw-blocks':r.max_draw_blocks,
   'draw-blocks':r.draw_blocks,
   'block-overlap':r.block_overlap,
   'block-order':r.block_order
  }))
  setStatus('Đã áp dụng 10 thiết lập render từ phong cách: '+selected.name_en)
 }
 const currentStyle=catalog.styles.find(item=>item.id===cfg.style)
 const styles=catalog.styles.filter(s=>(s.name_en+' '+s.id+' '+(styleDescriptionsVi[s.id]||'')).toLowerCase().includes(filter.toLowerCase()))
 return <div className="v3"><aside className="v3-sidebar"><div className="v3-brand"><strong>DvaForDev</strong><small>WHITEBOARD STUDIO V3</small></div>{nav.map(n=><button className={tab===n.id?'active':''} key={n.id} onClick={()=>setTab(n.id)}><n.icon size={18}/>{n.label}</button>)}<p>Single Scene • Python Engine</p></aside><main className="v3-main"><header><div><h1>{nav.find(x=>x.id===tab)?.label}</h1><small>{status}</small></div><div className="v3-top"><button onClick={()=>exportJson('whiteboard-single-preset.json',{schema:'single-v3',configuration:cfg})}><Save size={16}/> Lưu preset</button><label><Upload size={16}/> Nạp preset<input type="file" accept=".json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importPreset(f)}}/></label></div></header>
 {tab==='single'&&<div className="v3-content"><div className="v3-cols"><section className="v3-panel"><h2>1. Ảnh đầu vào</h2><label className="v3-upload"><Image size={22}/> Chọn ảnh PNG / JPG / WebP<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f){if(img)URL.revokeObjectURL(img);setImg(URL.createObjectURL(f));setFile(f)}}}/></label><div className="v3-image">{img?<img src={img} alt="Ảnh đầu vào"/>:'Chưa chọn ảnh'}</div><small>{file?.name||'Chỉ một ảnh mỗi lần render'}</small></section><section className="v3-panel"><h2>2. Render</h2>{[['method','Phương thức render',['render-image','render-photo']],['duration','Thời lượng'],['fps','FPS'],['width','Chiều rộng'],['height','Chiều cao'],['source-fit','Vừa khung',['contain','cover','exact','blur-fill']],['hand','Bàn tay',catalog.hands],['stroke-detail','Chi tiết nét',['balanced','rich','max']]].map(f=>field(f as FieldSpec))}<button className="v3-link" onClick={()=>setTab('advanced')}>Mở toàn bộ tùy chọn vẽ →</button></section></div><section className="v3-panel"><h2>3. Thư mục xuất MP4</h2><div className="v3-folder"><input value={String(cfg.outputFolder)} readOnly placeholder="Chưa chọn thư mục output"/><button onClick={()=>void pickFolder()}><FolderOpen size={16}/> Chọn folder</button></div><div className="v3-actions"><button className="v3-primary" disabled={working} onClick={()=>void render()}><Play size={17}/> {working?'Đang render...':'Bắt đầu render'}</button><button disabled={!working} onClick={()=>void stop()}><Square size={16}/> Hủy</button></div>{working&&<progress/>}{log&&<div className="v3-error">{log}</div>}{result&&<div className="v3-result"><strong>MP4:</strong> {result}<button onClick={()=>void invoke('reveal_output',{path:result})}><FolderOpen size={15}/> Mở thư mục</button></div>}</section><section className="v3-panel"><h2><Monitor size={18}/> Preview MP4</h2>{video?<video src={video} controls playsInline/>:<div className="v3-placeholder">Video sẽ xuất hiện sau khi render thành công (tối đa 40 MB).</div>}</section></div>}
 {tab==='styles'&&<div className="v3-content"><section className="v3-panel"><h2>30 phong cách vẽ</h2><div className="v3-search"><Search size={16}/><input placeholder="Tìm phong cách..." value={filter} onChange={e=>setFilter(e.target.value)}/></div><div className="v3-styles">{styles.map(s=><button key={s.id} className={cfg.style===s.id?'selected':''} onClick={()=>applyStyle(s.id)}><strong>{s.name_en}</strong><small>{s.id}</small><p>{styleDescriptionsVi[s.id]}</p></button>)}</div></section><section className="v3-panel"><h2>Bàn tay</h2>{field(['hand','Kiểu bàn tay',catalog.hands])}{field(['hand-scale','Tỉ lệ bàn tay'])}</section><section className="v3-panel"><h2>Phong cách đang chọn</h2><strong>{currentStyle?.name_en||'Chưa chọn'}</strong><p className="v3-hint">Đã ánh xạ trực tiếp 10 giá trị cấu hình render chính xác từ recipe gốc. Bạn có thể tinh chỉnh tại Advanced Draw; nút dưới sẽ khôi phục recipe của style đang chọn. Những đặc tính thẩm mỹ về màu sắc, giấy và cách vẽ của nguồn ảnh không được chuyển thành tham số CLI.</p><button onClick={()=>applyStyle(String(cfg.style))}>Khôi phục thiết lập phong cách</button></section></div>}
 {tab==='advanced'&&<div className="v3-content"><p className="v3-hint">Tùy chọn được nối với lệnh render-image / render-photo. Các mục không phù hợp với một chế độ sẽ được bỏ qua.</p>{sections.map(s=><section className="v3-panel" key={s.title}><button className="v3-accordion" onClick={()=>setAdvancedOpen(v=>v.includes(s.title)?v.filter(x=>x!==s.title):[...v,s.title])}>{s.title}<span>{advancedOpen.includes(s.title)?'−':'+'}</span></button>{advancedOpen.includes(s.title)&&<div className="v3-fields">{s.fields.map(f=>field(f as FieldSpec))}</div>}</section>)}</div>}
 {tab==='models'&&<ModelManager exe={String(cfg.engine)}/>}
 {tab==='system'&&<div className="v3-content"><section className="v3-panel"><h2>Cài đặt hệ thống</h2>{field(['engine','Đường dẫn whiteboard.exe'])}<button onClick={()=>void pickEngine()}>Chọn whiteboard.exe</button><button onClick={()=>void checkDoctor()}>Kiểm tra Engine (Doctor)</button>{doctorResult&&<pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:300,overflow:'auto'}}>{doctorResult}</pre>}<label className="v3-field">Thư mục xuất MP4<div className="v3-folder"><input readOnly value={String(cfg.outputFolder)}/><button onClick={()=>void pickFolder()}><FolderOpen size={16}/> Chọn folder</button></div></label><p className="v3-hint">Máy cần cài Whiteboard Engine cùng FFmpeg. render-photo còn cần model tách nét; render-image dùng ảnh nét sẵn có.</p><button onClick={()=>setTab('single')}>Trở về Single Scene</button></section></div>}
 </main></div>
}

