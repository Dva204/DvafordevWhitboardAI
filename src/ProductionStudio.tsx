import {useMemo,useRef,useState} from 'react'
import {Image as ImageIcon, Film, Upload, Download, AlertTriangle, CheckCircle2, Trash2, Link2, Layers3} from 'lucide-react'
import './ProductionStudio.css'
import { invoke, isTauri } from '@tauri-apps/api/core'
type Shot={id:string,start:number,end:number,text:string,imageName:string}
type Asset={name:string,url:string,file:File}
const key='dvafordev.production.v1'
function initial():Shot[]{try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a:[]}catch{return []}}
function t(s:string){const x=s.trim().match(/^(\d{1,2}):(\d\d):(\d\d)[,.](\d{1,3})$/);return x?Number(x[1])*3600+Number(x[2])*60+Number(x[3])+Number(x[4].padEnd(3,'0'))/1000:NaN}
function srt(src:string):Shot[]{return src.replace(/\r/g,'').trim().split(/\n\s*\n/).flatMap((b,i)=>{const lines=b.split('\n'),j=lines.findIndex(x=>x.includes('-->'));if(j<0)return [];const [a,z]=lines[j].split(/\s*-->\s*/);const start=t(a),end=t(z);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];return [{id:String(i+1),start,end,text:lines.slice(j+1).join('\n'),imageName:''}]})}
function dl(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
export function ProductionStudio({mode,config}:{mode:'single'|'multi';config:Record<string,string|number|boolean>}){
 const [shots,setShots]=useState<Shot[]>(initial)
 const [assets,setAssets]=useState<Asset[]>([])
 const [selected,setSelected]=useState(0)
 const [singleAsset,setSingleAsset]=useState<Asset|null>(null)
 const [duration,setDuration]=useState(12)
 const [message,setMessage]=useState('')
 const [audioName,setAudioName]=useState('')
 const [projectName,setProjectName]=useState('Du an whiteboard')
 const [rendering,setRendering]=useState(false)
 const [stopRequested,setStopRequested]=useState(false)
 const cancelFlag=useRef(false)
 const [progress,setProgress]=useState({done:0,total:0,status:'Chưa render'})
 const [outputs,setOutputs]=useState<string[]>([])
 const [previewUrl,setPreviewUrl]=useState('')
 const [previewError,setPreviewError]=useState('')
 const [singleText,setSingleText]=useState('')
 const [singleNote,setSingleNote]=useState('')
 const [imageFit,setImageFit]=useState('contain')
 const [renderMethod,setRenderMethod]=useState('render-image')
 const assigned=shots.filter(x=>x.imageName).length
 const valid=shots.length>0&&assigned===shots.length&&shots.every(x=>x.end>x.start&&x.start>=0)
 const total=useMemo(()=>shots.length?Math.max(...shots.map(x=>x.end)):0,[shots])
 const gaps=shots.slice(1).filter((x,i)=>x.start>shots[i].end+0.001).length
 function update(next:Shot[]){setShots(next);localStorage.setItem(key,JSON.stringify(next))}
 function importImages(files:FileList|null){if(!files)return;const validFiles=Array.from(files).filter(f=>f.type.startsWith('image/'));setAssets(old=>{old.forEach(a=>URL.revokeObjectURL(a.url));return validFiles.map(f=>({name:f.name,url:URL.createObjectURL(f),file:f}))});setMessage('Đã chọn '+validFiles.length+' ảnh; ảnh chỉ được giữ trong phiên chạy hiện tại.')}
 async function importTimeline(file:File){try{const content=await file.text();let rows:Shot[]=[];if(file.name.toLowerCase().endsWith('.srt'))rows=srt(content);else{const d=JSON.parse(content);const arr=Array.isArray(d)?d:d.scenes;if(!Array.isArray(arr))throw new Error('Không tìm thấy mảng scenes');rows=arr.map((x,i)=>({id:String(x.id??i+1),start:Number(x.start??x.start_time??0),end:Number(x.end??x.end_time??0),text:String(x.text??x.narration??''),imageName:String(x.imageName??'')}))}if(!rows.length)throw new Error('Không có scene hợp lệ');update(rows);setSelected(0);setMessage('Đã nhập '+rows.length+' scene.')}catch(e){setMessage('Lỗi: '+String(e))}}
 function autoMap(){if(assets.length!==shots.length){setMessage('Số ảnh ('+assets.length+') phải bằng số scene ('+shots.length+') để ghép tự động an toàn.');return}update(shots.map((s,i)=>({...s,imageName:assets[i].name})));setMessage('Đã ghép ảnh theo thứ tự file đã chọn. Hãy kiểm tra từng scene.')}
 function manifest(){return {schema:'dvafordev.whiteboard.production.v1',mode,projectName,renderer:{status:'not-integrated',note:'Manifest is a plan, not rendered media'},config, ...(mode==='single'?{scene:{imageName:singleAsset?.name||'',duration,text:singleText,note:singleNote,sourceFit:imageFit}}:{scenes:shots,sourceImages:assets.map(x=>x.name),audioName,gapPolicy:'preserve-timeline'})}}
 async function stage(file:File,project:string,idx:number){const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const name='input_'+idx+'.'+ext;return await invoke<string>('save_input',{project,name,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))})}
 async function runRender(){
  if(!isTauri()){setMessage('Render chỉ chạy trong ứng dụng Tauri desktop. Hãy dùng npm exec tauri dev, không mở localhost:1420 trong trình duyệt.');return}
  if(rendering)return;
  if(mode==='single'&&(!singleAsset||duration<=0)){setMessage('Hãy chọn ảnh và thời lượng hợp lệ.');return}
  if(mode==='multi'&&!valid){setMessage('Chưa thể render: cần gán đủ ảnh và thời gian hợp lệ.');return}
  if(mode==='multi'&&gaps>0){setMessage('Timeline có khoảng nghỉ. Bản render này chưa tạo đoạn giữ hình/tĩnh để bảo toàn khoảng nghỉ SRT. Không chạy để tránh sai thời gian.');return}
  if(mode==='multi'&&audioName){setMessage('Đã chọn âm thanh, nhưng chưa có bộ ghép TTS đồng bộ SRT. Hãy bỏ audio nếu chỉ muốn thử render hình.');return}
  const exe=String(config['engine']||'D:\\TestTTS\\_whiteboard_engine_lab\\.venv\\Scripts\\whiteboard.exe');
  if(!exe){setMessage('Vui lòng thiết lập đường dẫn whiteboard.exe tại mục Hệ thống.');return}
  const project='whiteboard_'+Date.now(),segments=mode==='single'?1:shots.length;
  if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl('');setPreviewError('');
  setRendering(true);cancelFlag.current=false;setStopRequested(false);setOutputs([]);setProgress({done:0,total:segments,status:'Đang chuẩn bị ảnh'});
  try{
   const sources=mode==='single'?[singleAsset!]:shots.map(shot=>assets.find(a=>a.name===shot.imageName)!);
   const staged:string[]=[];
   for(let i=0;i<sources.length;i++)staged.push(await stage(sources[i].file,project,i));
   const clips:string[]=[];
   for(let i=0;i<segments;i++){
    if(cancelFlag.current)throw new Error('Đã hủy theo yêu cầu');
    setProgress({done:i,total:segments,status:'Đang render scene '+(i+1)+'/'+segments});
    const d=mode==='single'?duration:shots[i].end-shots[i].start;
    const path=await invoke<string>('run_engine',{exe,project,command:renderMethod,image:staged[i],clips:null,output:'scene_'+String(i+1).padStart(4,'0')+'.mp4',duration:d,fps:Number(config.fps)||30,width:Number(config.width)||1920,height:Number(config.height)||1080,sourceFit:mode==='single'?imageFit:String(config['source-fit']||'contain'),hand:String(config.hand||'asian'),handScale:Number(config['hand-scale']||1),strokeDetail:String(config['stroke-detail']||'balanced'),lineReveal:String(config['line-reveal']||'stroke'),colorFill:String(config['color-fill']||'fade')});
    clips.push(path);setOutputs([...clips]);setProgress({done:i+1,total:segments,status:'Đã render '+(i+1)+'/'+segments});
   }
   if(mode==='multi'&&clips.length>1){
    setProgress({done:segments,total:segments,status:'Đang ghép các scene'});
    const final=await invoke<string>('run_engine',{exe,project,command:'compose',image:null,clips,output:'final.mp4',duration:null,fps:null,width:null,height:null,sourceFit:null});
    setOutputs([...clips,final]);setMessage('Đã render và ghép video hình ảnh. File: '+final);
   }else {setMessage('Render hoàn thành: '+clips[0]);if(mode==='single'){try{const data=await invoke<number[]>('read_preview',{path:clips[0]});setPreviewUrl(URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'video/mp4'})))}catch(e){setPreviewError(String(e))}}}
   setProgress({done:segments,total:segments,status:'Hoàn thành'});
  }catch(e){setMessage('Render dừng hoặc lỗi: '+String(e));setProgress(p=>({...p,status:'Lỗi hoặc đã hủy'}))}
  finally{setRendering(false)}
 }
 async function cancel(){if(!isTauri()){setMessage('Hủy render chỉ dùng được trong Tauri desktop.');return}cancelFlag.current=true;setStopRequested(true);try{await invoke('cancel_render');setMessage('Đã gửi lệnh hủy render hiện tại.')}catch(e){setMessage('Không thể hủy: '+String(e))}}

 const selectedShot=shots[selected]
 return <section className="production">
  <div className="production-head"><div><h2>{mode==='single'?<ImageIcon size={22}/>:<Layers3 size={22}/>} {mode==='single'?'Single Scene Studio':'Multi Scene Studio'}</h2><p>{mode==='single'?'Chuẩn bị một ảnh thành một video vẽ tay để thử chất lượng.':'Tạo kế hoạch nhiều scene từ SRT và bộ ảnh, giữ nguyên khoảng nghỉ.'}</p></div><div className="production-status">Giai đoạn cấu hình · Chưa render</div></div>
  <div className="production-toolbar"><label>Tên dự án<input value={projectName} onChange={e=>setProjectName(e.target.value)}/></label><button className="btn primary" onClick={()=>{if(mode==='single'&&(!singleAsset||duration<=0)){setMessage('Cần chọn ảnh và thời lượng lớn hơn 0.');return}if(mode==='multi'&&!valid){setMessage('Chưa thể xuất: thiếu ảnh hoặc mốc thời gian không hợp lệ.');return}dl('whiteboard-'+mode+'-manifest.json',manifest());setMessage('Đã xuất manifest JSON; chưa tạo video.')}}><Download size={16}/> Xuất kế hoạch</button></div>
  {mode==='single'?<div className="production-columns"><div className="production-panel"><h3>1. Ảnh đầu vào</h3><label className="upload-zone"><Upload size={21}/> Chọn ảnh PNG / JPG / WebP<input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f){if(singleAsset)URL.revokeObjectURL(singleAsset.url);setSingleAsset({name:f.name,url:URL.createObjectURL(f),file:f})}}}/></label><div className="image-stage">{singleAsset?<img src={singleAsset.url} alt={singleAsset.name}/>:<div className="empty-image"><ImageIcon size={34}/> Chưa có ảnh</div>}</div><small className="muted">{singleAsset?.name||'Chọn ảnh để bắt đầu'}</small></div><div className="production-panel"><h3>2. Thông số scene</h3><label>Thời lượng (giây)<input type="number" min="0.1" step="0.1" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>Điều chỉnh vừa khung<select value={imageFit} onChange={e=>setImageFit(e.target.value)}><option value="contain">Toàn bộ ảnh (contain)</option><option value="cover">Lấp đầy (cover)</option><option value="blur-fill">Nền làm mờ (blur-fill)</option><option value="exact">Đúng tỉ lệ (exact)</option></select></label><label>Thuyết minh / nội dung<textarea rows={5} value={singleText} onChange={e=>setSingleText(e.target.value)}/></label><label>Ghi chú xử lý<textarea rows={3} value={singleNote} onChange={e=>setSingleNote(e.target.value)}/></label><div className="production-note"><Film size={17}/> Video MP4 sẽ được tạo bởi Whiteboard Engine khi bấm Bắt đầu render.</div></div></div>
  :<><div className="production-imports"><div className="production-panel"><h3>1. Timeline từ SRT hoặc Scene JSON</h3><label className="upload-zone"><Upload size={20}/> Nhập .srt / .json<input hidden type="file" accept=".srt,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void importTimeline(f);e.target.value=''}}/></label><div className="production-number">{shots.length} <small>scene</small></div></div><div className="production-panel"><h3>2. Bộ ảnh minh họa</h3><label className="upload-zone"><Upload size={20}/> Chọn nhiều ảnh<input hidden type="file" accept="image/*" multiple onChange={e=>importImages(e.target.files)}/></label><div className="production-number">{assets.length} <small>ảnh</small></div></div><div className="production-panel"><h3>3. Âm thanh (tùy chọn)</h3><label className="upload-zone"><Upload size={20}/> Chọn MP3 / WAV<input hidden type="file" accept="audio/*" onChange={e=>setAudioName(e.target.files?.[0]?.name||'')}/></label><div className="muted">{audioName||'Chưa chọn âm thanh'}</div></div></div>
  <div className="production-stats"><span><Layers3 size={15}/> {assigned}/{shots.length} scene có ảnh</span><span>{total.toFixed(2)} giây (mốc cuối)</span><span>{gaps} khoảng nghỉ</span><button className="btn subtle" onClick={autoMap}><Link2 size={15}/> Ghép tự động theo thứ tự</button></div>
  <div className="production-columns scene-columns"><div className="production-panel"><div className="production-title"><h3>Danh sách scene</h3><button className="btn subtle" onClick={()=>{update([...shots,{id:String(Date.now()),start:total,end:total+5,text:'',imageName:''}]);setSelected(shots.length)}}>+ Thêm</button></div><div className="production-scene-list">{shots.map((s,i)=><button className={selected===i?'active':''} key={s.id} onClick={()=>setSelected(i)}><strong>Scene {i+1}</strong><span>{s.start.toFixed(2)} – {s.end.toFixed(2)}s</span><small>{s.imageName||'Chưa gán ảnh'}</small></button>)}{!shots.length&&<div className="muted">Nhập SRT hoặc JSON để tạo timeline.</div>}</div></div><div className="production-panel"><h3>Chi tiết scene {shots.length?selected+1:''}</h3>{selectedShot?<><label>Ảnh minh họa<select value={selectedShot.imageName} onChange={e=>update(shots.map((s,i)=>i===selected?{...s,imageName:e.target.value}:s))}><option value="">Chưa chọn ảnh</option>{assets.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}</select></label>{assets.find(x=>x.name===selectedShot.imageName)&&<div className="scene-thumb"><img src={assets.find(x=>x.name===selectedShot.imageName)?.url} alt={selectedShot.imageName}/></div>}<div className="production-time"><label>Bắt đầu (giây)<input type="number" min="0" step="0.01" value={selectedShot.start} onChange={e=>update(shots.map((s,i)=>i===selected?{...s,start:Number(e.target.value)}:s))}/></label><label>Kết thúc (giây)<input type="number" step="0.01" value={selectedShot.end} onChange={e=>update(shots.map((s,i)=>i===selected?{...s,end:Number(e.target.value)}:s))}/></label></div><label>Lời thoại<textarea rows={6} value={selectedShot.text} onChange={e=>update(shots.map((s,i)=>i===selected?{...s,text:e.target.value}:s))}/></label><button className="btn subtle" onClick={()=>{update(shots.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1))}}><Trash2 size={15}/> Xóa scene</button></>:<div className="muted">Chọn một scene để chỉnh sửa.</div>}</div></div>
  <div className="production-note"><AlertTriangle size={17}/> Ghép ảnh tự động yêu cầu số lượng ảnh bằng số scene. Chọn lại ảnh sau khi mở ứng dụng; tên file được lưu nhưng dữ liệu ảnh không được nhúng trong JSON.</div>
  </>}
  {mode==='single'&&<div className="production-panel render-controller"><label>Phương thức render<select value={renderMethod} disabled={rendering} onChange={e=>setRenderMethod(e.target.value)}><option value="render-image">Ảnh nét sẵn có (không cần model)</option><option value="render-photo">Ảnh màu / ảnh thật (cần model tách nét)</option></select></label><div className="production-title"><h3>Render Controller</h3><span className="muted">{progress.status}</span></div><div className="production-stats"><span>{progress.done}/{progress.total} scene</span><span>{outputs.length} file video đã tạo</span></div><progress value={progress.done} max={Math.max(progress.total,1)} style={{width:'100%',height:12}}/><div className="production-actions"><button className="btn primary" disabled={rendering} onClick={()=>void runRender()}>{rendering?'Đang render...':'Bắt đầu render'}</button><button className="btn subtle" disabled={!rendering} onClick={()=>void cancel()}>Hủy scene hiện tại</button></div>{stopRequested&&<small className="muted">Đang chờ engine xác nhận lệnh hủy...</small>}{outputs.map((o,i)=><div key={i} className="muted" style={{wordBreak:'break-all'}}>{o}</div>)}<small className="muted">Render chạy tuần tự; tiến trình hiện tính theo số scene hoàn tất, không phải phần trăm nội bộ từng scene. Với Multi Scene, audio TTS và khoảng nghỉ SRT chưa được hỗ trợ.</small>{outputs.map(o=><button key={o} className="btn subtle" onClick={()=>void invoke('reveal_output',{path:o})}>Mở thư mục chứa MP4</button>)}</div>}
  {mode==='single'&&previewUrl&&<div className="production-panel"><h3>Xem video vừa render</h3><video key={previewUrl} controls playsInline src={previewUrl} style={{width:'100%',maxHeight:480,background:'#0a1018',borderRadius:10}}/></div>}{previewError&&<div className="production-note">{previewError}</div>}
  {message&&<div className="production-message"><CheckCircle2 size={16}/>{message}<button onClick={()=>setMessage('')}>×</button></div>}
 </section>
}
