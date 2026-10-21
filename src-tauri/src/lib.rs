use std::{path::PathBuf, process::{Command,Child,Stdio},sync::Mutex,thread,time::Duration};
use tauri::{Manager,State};
struct Renderer(Mutex<Option<Child>>);
fn project_path(app:&tauri::AppHandle, project:&str)->Result<PathBuf,String>{
 if project.is_empty() || !project.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='_'){return Err("Invalid project name".into());}
 let root=app.path().app_data_dir().map_err(|e|e.to_string())?.join("renders").join(project);
 std::fs::create_dir_all(&root).map_err(|e|e.to_string())?;Ok(root)
}
#[tauri::command]
fn save_input(app:tauri::AppHandle,project:String,name:String,bytes:Vec<u8>)->Result<String,String>{
 if bytes.is_empty()||bytes.len()>30_000_000{return Err("Image is empty or exceeds 30 MB".into());}
 if name.is_empty()||!name.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='_'||c=='.'){return Err("Unsafe filename".into());}
 let root=project_path(&app,&project)?.join("inputs");std::fs::create_dir_all(&root).map_err(|e|e.to_string())?;
 let path=root.join(name);std::fs::write(&path,bytes).map_err(|e|e.to_string())?;Ok(path.to_string_lossy().into_owned())
}
#[tauri::command]
fn output_dir(app:tauri::AppHandle,project:String)->Result<String,String>{Ok(project_path(&app,&project)?.to_string_lossy().into_owned())}
#[tauri::command]
fn cancel_render(r:State<'_,Renderer>)->Result<(),String>{let mut active=r.0.lock().map_err(|e|e.to_string())?;if let Some(child)=active.as_mut(){child.kill().map_err(|e|e.to_string())?;}Ok(())}
#[tauri::command]
async fn run_engine(r:State<'_,Renderer>,exe:String,project:String,command:String,image:Option<String>,clips:Option<Vec<String>>,output:String,duration:Option<f64>,fps:Option<u32>,width:Option<u32>,height:Option<u32>,source_fit:Option<String>,output_folder:Option<String>,hand:Option<String>,hand_scale:Option<f64>,stroke_detail:Option<String>,line_reveal:Option<String>,color_fill:Option<String>,line_thickness:Option<f64>,tail_color:Option<f64>,animation_preset:Option<String>,block_fill_style:Option<String>,color_fill_scope:Option<String>,lineart_provider:Option<String>,lineart_snap_threshold:Option<u32>,no_lineart_snap:Option<bool>,max_draw_blocks:Option<u32>,block_overlap:Option<f64>,block_order:Option<String>,draw_text:Option<String>,draw_text_role:Option<String>,draw_text_position:Option<String>,draw_text_reveal:Option<String>,extras:Option<std::collections::HashMap<String,serde_json::Value>>,app:tauri::AppHandle)->Result<String,String>{
 let exe_path=PathBuf::from(&exe);
 if !exe_path.is_file(){return Err("Cannot find whiteboard.exe".into());}
 if !["render-photo","render-image","compose"].contains(&command.as_str()){return Err("Command not supported".into())}
 let root=project_path(&app,&project)?;
 if output.contains('/')||output.contains('\\')||!output.ends_with(".mp4")||output.contains(".."){return Err("Invalid output filename".into())}
 let target=if let Some(folder)=output_folder {
  let p=PathBuf::from(folder);
  if !p.is_absolute() || !p.is_dir(){return Err("Output folder must already exist".into())}
  p.join(output)
 }else{root.join(output)};
 if target.exists(){return Err("Output MP4 already exists: choose another filename".into());}
 let log_path=root.join("render.log");
 let mut args=vec![command.clone()];
 if command=="render-photo" || command=="render-image" {
  let img=PathBuf::from(image.ok_or("Missing input image")?);
  if !img.is_file()||!img.starts_with(root.join("inputs")){return Err("Input image is not staged".into())}
  args.push(img.to_string_lossy().to_string());
  if let Some(d)=duration{if !d.is_finite()||d<=0.0||d>36000.0{return Err("Invalid duration".into())}args.extend(["--duration".into(),d.to_string()]);}
  if let Some(f)=fps{if !(1..=120).contains(&f){return Err("Invalid fps".into())}args.extend(["--fps".into(),f.to_string()]);}
  if let Some(w)=width{args.extend(["--width".into(),w.to_string()]);}
  if let Some(h)=height{args.extend(["--height".into(),h.to_string()]);}
  if let Some(f)=source_fit{if !["exact","contain","cover","blur-fill"].contains(&f.as_str()){return Err("Invalid fit".into())}args.extend(["--source-fit".into(),f]);}
  if let Some(v)=hand{if !["procedural","none","asian","black","children","white"].contains(&v.as_str()){return Err("Invalid hand".into())}args.extend(["--hand".into(),v]);}
  if let Some(v)=hand_scale{if !v.is_finite()||v<=0.0||v>5.0{return Err("Invalid hand scale".into())}args.extend(["--hand-scale".into(),v.to_string()]);}
  if let Some(v)=stroke_detail{if !["balanced","rich","max"].contains(&v.as_str()){return Err("Invalid stroke detail".into())}args.extend(["--stroke-detail".into(),v]);}
  if let Some(v)=line_reveal{if !["stroke","detail-wipe"].contains(&v.as_str()){return Err("Invalid line reveal".into())}args.extend(["--line-reveal".into(),v]);}
  if let Some(v)=color_fill{if !["contour-wipe","brush-scan","top-down-blocks","fade","left-to-right-gradient"].contains(&v.as_str()){return Err("Invalid color fill".into())}args.extend(["--color-fill".into(),v]);}
  if let Some(v)=line_thickness{if !v.is_finite()||v<0.0||v>50.0{return Err("Invalid line thickness".into())}args.extend(["--line-thickness".into(),v.to_string()]);}
  if let Some(v)=tail_color{if !v.is_finite()||v<0.0||v>3600.0{return Err("Invalid tail color".into())}args.extend(["--tail-color".into(),v.to_string()]);}
  for (key,value,choices) in [
   ("--animation-preset",animation_preset,&["classic","block-speedpaint"][..]),
   ("--block-fill-style",block_fill_style,&["crayon","clean","soft-wash","dry-brush"][..]),
   ("--color-fill-scope",color_fill_scope,&["block","scene"][..]),
   ("--block-order",block_order,&["reading","source"][..]),
   ("--draw-text-role",draw_text_role,&["annotation","caption"][..]),
   ("--draw-text-position",draw_text_position,&["bottom","top","center"][..]),
   ("--draw-text-reveal",draw_text_reveal,&["stroke","line-wipe"][..]),
  ] {if let Some(v)=value{if !choices.contains(&v.as_str()){return Err(format!("Invalid {}",key))}args.extend([key.into(),v]);}}
  if command=="render-photo"{if let Some(v)=lineart_provider{if !["auto","informative","anime2sketch","anime","manga"].contains(&v.as_str()){return Err("Invalid provider".into())}args.extend(["--lineart-provider".into(),v]);}}
  if let Some(v)=lineart_snap_threshold{if v>255{return Err("Invalid lineart threshold".into())}args.extend(["--lineart-snap-threshold".into(),v.to_string()]);}
  if no_lineart_snap.unwrap_or(false){args.push("--no-lineart-snap".into());}
  if let Some(v)=max_draw_blocks{if v==0||v>10000{return Err("Invalid max blocks".into())}args.extend(["--max-draw-blocks".into(),v.to_string()]);}
  if let Some(v)=block_overlap{if !v.is_finite()||v<0.0||v>0.65{return Err("Invalid overlap".into())}args.extend(["--block-overlap".into(),v.to_string()]);}
  if let Some(v)=draw_text{if !v.trim().is_empty(){args.extend(["--draw-text".into(),v]);}}
  if let Some(extras)=extras {
    let numeric=["color-blocks","base-line-opacity","draw-text-width","draw-text-max-height","draw-text-line-spacing","draw-text-font-size","draw-blocks"];
    let textual=["draw-text-align","draw-text-order","story-text","block-sequence"];
    let enums=[("draw-text-align",vec!["left","center","right"]),("draw-text-order",vec!["before","after"])];
    for (key,val) in extras {
      if numeric.contains(&key.as_str()) {
        if let Some(v)=val.as_f64(){if !v.is_finite()||v<0.0||v>10000.0 {return Err(format!("Invalid option {}",key))} args.extend([format!("--{}",key),v.to_string()]);}
        else{return Err(format!("Invalid numeric option {}",key))}
      }else if textual.contains(&key.as_str()) {
        let v=val.as_str().ok_or(format!("Invalid option {}",key))?;
        if v.len()>2000{return Err(format!("Option too long {}",key))}
        if let Some((_,choices))=enums.iter().find(|(k,_)|k==&key){if !choices.contains(&v){return Err(format!("Invalid enum {}",key))}}
        if !v.is_empty(){args.extend([format!("--{}",key),v.into()]);}
      }else{return Err(format!("Unsupported option {}",key))}
    }
  }
 } else {
  let cs=clips.ok_or("Missing clips")?;if cs.is_empty(){return Err("Empty clips".into())}
  for c in cs{let p=PathBuf::from(&c);if !p.is_file()||!p.starts_with(&root){return Err("Invalid clip path".into())}args.push(c);}
 }
 args.extend(["--output".into(),target.to_string_lossy().to_string()]);
 {
  let mut active=r.0.lock().map_err(|e|e.to_string())?;
  if active.is_some(){return Err("Another render is running".into())}
  let stdout_file=std::fs::File::create(&log_path).map_err(|e|e.to_string())?;
  let stderr_file=stdout_file.try_clone().map_err(|e|e.to_string())?;
  *active=Some(Command::new(exe_path).current_dir(&root).args(&args).stdout(Stdio::from(stdout_file)).stderr(Stdio::from(stderr_file)).spawn().map_err(|e|e.to_string())?);
 }
 
 loop{
  let result={
   let mut active=r.0.lock().map_err(|e|e.to_string())?;
   match active.as_mut(){Some(ch)=>ch.try_wait().map_err(|e|e.to_string())?,None=>return Err("Render cancelled".into())}
  };
  if let Some(status)=result{
   let mut active=r.0.lock().map_err(|e|e.to_string())?;*active=None;
   if status.success()&&target.is_file(){return Ok(target.to_string_lossy().to_string())}
   let raw=std::fs::read_to_string(&log_path).unwrap_or_default();let detail=raw.lines().rev().find(|line|line.contains("whiteboard:")||line.contains("Error")||line.contains("Traceback")).unwrap_or("Xem render.log trong thư mục đầu ra");return Err(format!("Engine failed ({}): {}. Log: {}",status,detail,log_path.display()));
  }
  thread::sleep(Duration::from_millis(400));
 }
}
#[tauri::command]
fn doctor_engine(exe:String)->Result<String,String>{let p=PathBuf::from(exe);if !p.is_file(){return Err("whiteboard.exe not found".into())}let out=Command::new(p).arg("doctor").output().map_err(|e|e.to_string())?;let log=format!("{}\n{}",String::from_utf8_lossy(&out.stdout),String::from_utf8_lossy(&out.stderr));Ok(if log.len()>12000{log.chars().take(12000).collect()}else{log})}
#[tauri::command]
fn reveal_output(path:String)->Result<(),String>{let p=PathBuf::from(path);if !p.is_file()||p.extension().and_then(|x|x.to_str())!=Some("mp4"){return Err("Invalid output".into());}Command::new("explorer.exe").arg(format!("/select,{}",p.display())).spawn().map_err(|e|e.to_string())?;Ok(())}
#[tauri::command]
fn read_preview(path:String)->Result<Vec<u8>,String>{
 let p=PathBuf::from(path);
 if !p.is_file()||p.extension().and_then(|x|x.to_str())!=Some("mp4"){return Err("Invalid preview file".into())}
 let n=std::fs::metadata(&p).map_err(|e|e.to_string())?.len();
 if n>40_000_000{return Err("Video over 40 MB: open using file explorer instead".into())}
 std::fs::read(p).map_err(|e|e.to_string())
}

#[derive(serde::Serialize)]
struct ComponentCheck { id:String, label:String, ok:bool, detail:String, required:String }
#[tauri::command]
fn inspect_installation(exe:String)->Vec<ComponentCheck>{
 let mut checks=Vec::new();
 let binary=PathBuf::from(&exe);
 let root=runtime_root(&exe).ok();
 let exists=binary.is_file();
 checks.push(ComponentCheck{id:"engine".into(),label:"Whiteboard Engine".into(),ok:exists,detail:if exists{binary.display().to_string()}else{"Không thấy whiteboard.exe. Vào System chọn đường dẫn Engine.".into()},required:"Bắt buộc".into()});
 let programs=[("ffmpeg","FFmpeg","ffmpeg","-version","Bắt buộc để xuất MP4"),("git","Git","git","--version","Dùng để tải mã nguồn model")];
 for (id,label,cmd,arg,required) in programs{
  let result=Command::new(cmd).arg(arg).output();
  let ok=result.as_ref().map(|r|r.status.success()).unwrap_or(false);
  checks.push(ComponentCheck{id:id.into(),label:label.into(),ok,detail:if ok{"Đã tìm thấy trong PATH".into()}else{format!("Không thấy {} trong PATH",label)},required:required.into()});
 }
 let base=root.as_ref().map(|p|p.join(".venv/Scripts/python.exe"));
 let ok=base.as_ref().map(|p|p.is_file()).unwrap_or(false);
 checks.push(ComponentCheck{id:"python".into(),label:"Python của Engine".into(),ok,detail:base.map(|p|p.display().to_string()).unwrap_or("Chưa xác định thư mục Engine".into()),required:"Bắt buộc cho engine nguồn Python".into()});
 let model_env=root.as_ref().map(|p|p.join(".venv-lineart/Scripts/python.exe"));
 let torch=model_env.as_ref().map(|p|p.is_file() && Command::new(p).args(["-c","import torch"]).output().map(|o|o.status.success()).unwrap_or(false)).unwrap_or(false);
 checks.push(ComponentCheck{id:"torch".into(),label:"PyTorch cho Line-Art".into(),ok:torch,detail:if torch{"Import torch thành công".into()}else{"Chưa có môi trường PyTorch riêng hoặc import torch thất bại".into()},required:"Chỉ cần cho render-photo".into()});
 for (id,title) in [("informative","Informative Drawings"),("anime2sketch","Anime2Sketch")]{
  let m=root.as_ref().map(|r|model_desc(r,id,torch));
  let ok=m.as_ref().map(|v|v.repo && v.wrapper && v.weights && v.torch).unwrap_or(false);
  checks.push(ComponentCheck{id:id.into(),label:title.into(),ok,detail:if let Some(v)=m{format!("Mã nguồn: {}; tích hợp: {}; trọng số: {}; PyTorch: {}",v.repo,v.wrapper,v.weights,v.torch)}else{"Chưa chọn đúng Engine".into()},required:"Model tùy chọn".into()});
 }
 checks
}
#[derive(serde::Serialize)]
struct ModelStatus { name:String, repo:bool, wrapper:bool, weights:bool, torch:bool, expected:String }
fn runtime_root(exe:&str)->Result<PathBuf,String>{
 let p=PathBuf::from(exe);
 if !p.is_file(){return Err("whiteboard.exe not found".into())}
 let v=p.parent().and_then(|x|x.parent()).and_then(|x|x.parent()).ok_or("Invalid engine path")?;
 Ok(v.to_path_buf())
}
fn model_desc(root:&std::path::Path, name:&str, torch:bool)->ModelStatus{
 let (repo,wrapper,weight)=if name=="informative"{
  (root.join("tools/informative-drawings/model.py"),root.join("tools/lineart/run_informative_drawings.py"),
   vec![root.join("tools/informative-drawings/checkpoints/model/anime_style/netG_A_latest.pth"),root.join("tools/informative-drawings/checkpoints/anime_style/netG_A_latest.pth")])
 }else{
  (root.join("tools/Anime2Sketch/model.py"),root.join("tools/lineart/run_anime2sketch.py"),
   vec![root.join("tools/Anime2Sketch/weights/netG.pth"),root.join("tools/Anime2Sketch/weights/improved.bin")])
 };
 ModelStatus{name:name.into(),repo:repo.is_file(),wrapper:wrapper.is_file(),weights:weight.iter().any(|p|p.is_file()),torch,expected:weight[0].display().to_string()}
}
#[tauri::command]
fn model_status(exe:String)->Result<Vec<ModelStatus>,String>{
 let root=runtime_root(&exe)?;
 let python=root.join(".venv-lineart/Scripts/python.exe");
 let torch=python.is_file() && Command::new(&python).args(["-c","import torch; print(torch.__version__)"]).output().map(|o|o.status.success()).unwrap_or(false);
 Ok(vec![model_desc(&root,"informative",torch),model_desc(&root,"anime2sketch",torch)])
}
#[tauri::command]
fn install_model_code(exe:String,name:String)->Result<String,String>{
 let root=runtime_root(&exe)?;
 let (url,dest)=match name.as_str(){
 "informative"=>("https://github.com/carolineec/informative-drawings.git","tools/informative-drawings"),
 "anime2sketch"=>("https://github.com/Mukosame/Anime2Sketch.git","tools/Anime2Sketch"),
 _=>return Err("Unknown model".into())
 };
 let target=root.join(dest);
 if target.exists(){return Err("Model repository folder already exists. No overwrite performed.".into())}
 let check=Command::new("git").args(["--version"]).output().map_err(|_|"Git not installed. Install Git first.".to_string())?;
 if !check.status.success(){return Err("Git unavailable".into())}
 let status=Command::new("git").arg("clone").arg("--depth").arg("1").arg(url).arg(&target).status().map_err(|e|e.to_string())?;
 if !status.success(){return Err("git clone failed; inspect internet connectivity and repository".into())}
 Ok(target.display().to_string())
}
#[tauri::command]
async fn install_model_python(exe:String)->Result<String,String>{
 tauri::async_runtime::spawn_blocking(move||{
  let root=runtime_root(&exe)?;
  let base=root.join(".venv/Scripts/python.exe");
  if !base.is_file(){return Err("Engine Python environment not found".into())}
  let env=root.join(".venv-lineart");
  if !env.join("Scripts/python.exe").exists(){
   let ok=Command::new(&base).args(["-m","venv"]).arg(&env).status().map_err(|e|e.to_string())?;
   if !ok.success(){return Err("Creating model Python environment failed".into())}
  }
  let python=env.join("Scripts/python.exe");
  let ok=Command::new(&python).args(["-m","pip","install","torch","torchvision","Pillow","numpy","tqdm"]).status().map_err(|e|e.to_string())?;
  if !ok.success(){return Err("Installing PyTorch dependencies failed".into())}
  Ok(format!("Installed model Python dependencies at {}",python.display()))
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn prepare_model(exe:String,name:String)->Result<String,String>{
 tauri::async_runtime::spawn_blocking(move || {
  let root=runtime_root(&exe)?;
  let (url,dir,marker)=match name.as_str(){
   "informative"=>("https://github.com/carolineec/informative-drawings.git","informative-drawings","model.py"),
   "anime2sketch"=>("https://github.com/Mukosame/Anime2Sketch.git","Anime2Sketch","model.py"),
   _=>return Err("Unknown model selected".to_string())
  };
  let target=root.join("tools").join(dir);
  if !target.join(marker).is_file(){
   if target.exists(){return Err("Existing model directory is incomplete. Repair manually; no files were overwritten.".into())}
   let output=Command::new("git").args(["clone","--depth","1",url]).arg(&target).output().map_err(|e|format!("Git is unavailable: {e}"))?;
   if !output.status.success(){return Err(format!("Git clone failed: {}",String::from_utf8_lossy(&output.stderr)))}
  }
  let base=root.join(".venv/Scripts/python.exe");
  if !base.is_file(){return Err("Engine Python missing. Configure Engine first.".into())}
  let env=root.join(".venv-lineart");
  if !env.join("Scripts/python.exe").exists(){
   let result=Command::new(&base).args(["-m","venv"]).arg(&env).output().map_err(|e|e.to_string())?;
   if !result.status.success(){return Err(format!("Unable to create Python environment: {}",String::from_utf8_lossy(&result.stderr)))}
  }
  let py=env.join("Scripts/python.exe");
  let ready=Command::new(&py).args(["-c","import torch, torchvision, PIL, numpy"]).output().map(|o|o.status.success()).unwrap_or(false);
  if !ready{
   let result=Command::new(&py).args(["-m","pip","install","torch","torchvision","Pillow","numpy","tqdm"]).output().map_err(|e|e.to_string())?;
   if !result.status.success(){return Err(format!("Dependencies failed: {}",String::from_utf8_lossy(&result.stderr)))}
  }
  let check=Command::new(&py).args(["-c","import torch, torchvision, PIL, numpy"]).output().map_err(|e|e.to_string())?;
  if !check.status.success(){return Err(format!("Import check failed: {}",String::from_utf8_lossy(&check.stderr)))}
  let weight=model_desc(&root,&name,true).weights;
  if weight {
   Ok(format!("Dependencies installed for {name}. Weight file found; run a rendering test to verify compatibility."))
  }else{
   Ok(format!("Prepared {name}: source and PyTorch available. Model weights are still missing. Open the official weights page, download and import the file."))
  }
 }).await.map_err(|e|e.to_string())?
}

#[tauri::command]
async fn install_model_complete(exe:String,name:String)->Result<String,String>{
 let model=name.clone();
 prepare_model(exe.clone(),name).await?;
 tauri::async_runtime::spawn_blocking(move || {
  let root=runtime_root(&exe)?;
  let env=root.join(".venv-lineart/Scripts/python.exe");
  if !env.is_file(){return Err("Model Python environment missing".into())}
  let target=match model.as_str(){
   "informative"=>root.join("tools/informative-drawings/checkpoints/model/anime_style/netG_A_latest.pth"),
   "anime2sketch"=>root.join("tools/Anime2Sketch/weights/netG.pth"),
   _=>return Err("Unknown model".into())
  };
  if target.is_file() && std::fs::metadata(&target).map_err(|e|e.to_string())?.len()>1_000_000{
   return Ok(format!("Weight exists at {}. Run an inference test before use.",target.display()))
  }
  let tmp=root.join(".model-downloads").join(&model);
  std::fs::create_dir_all(&tmp).map_err(|e|e.to_string())?;
  let install=Command::new(&env).args(["-m","pip","install","gdown"]).output().map_err(|e|e.to_string())?;
  if !install.status.success(){return Err(format!("Installing model downloader failed: {}",String::from_utf8_lossy(&install.stderr)))}
  let output=if model=="informative"{
   Command::new(&env).args(["-m","gdown","https://drive.google.com/uc?id=1MIdHzecxz-z0uY3ARL_R40DlKcuQxiDk","-O"]).arg(tmp.join("netG_A_latest.pth")).output()
  }else{
   Command::new(&env).args(["-m","gdown","--folder","https://drive.google.com/drive/folders/1Srf-WYUixK0wiUddc9y3pNKHHno5PN6R","-O"]).arg(&tmp).output()
  }.map_err(|e|e.to_string())?;
  if !output.status.success(){return Err(format!("Google Drive download failed: {}. Try again later or use Import weights.",String::from_utf8_lossy(&output.stderr)))}
  let src=if model=="informative"{tmp.join("netG_A_latest.pth")}else{
   fn find_model(dir:&std::path::Path,depth:u8)->Option<PathBuf>{
    if depth>5{return None}
    for e in std::fs::read_dir(dir).ok()?.flatten(){
     let p=e.path();
     if p.is_file() && p.file_name().and_then(|x|x.to_str()).map(|x|x.eq_ignore_ascii_case("netG.pth")).unwrap_or(false){return Some(p)}
     if p.is_dir(){if let Some(v)=find_model(&p,depth+1){return Some(v)}}
    }
    None
   }
   find_model(&tmp,0).ok_or("Google Drive folder did not contain netG.pth; no files installed.")?
  };
  let src=if model=="informative"{
   let zipcheck=Command::new(&env).args(["-c","import zipfile,sys;sys.exit(0 if zipfile.is_zipfile(sys.argv[1]) else 1)"]).arg(&src).status().map_err(|e|e.to_string())?;
   if zipcheck.success(){
    let extracted=tmp.join("extracted-netG_A_latest.pth");
    let script="import zipfile,sys,shutil\nz=zipfile.ZipFile(sys.argv[1]); matches=[n for n in z.namelist() if n.replace('\\\\','/').endswith('/anime_style/netG_A_latest.pth') or n=='netG_A_latest.pth']; assert matches, 'No anime_style weight in zip';\nwith z.open(matches[0]) as inp,open(sys.argv[2],'wb') as out: shutil.copyfileobj(inp,out)";
    let output=Command::new(&env).args(["-c",script]).arg(&src).arg(&extracted).output().map_err(|e|e.to_string())?;
    if !output.status.success(){return Err(format!("Model archive extraction failed: {}",String::from_utf8_lossy(&output.stderr)))}
    extracted
   }else{src}
  }else{src};
  let data=std::fs::metadata(&src).map_err(|e|e.to_string())?;
  if data.len()<1_000_000{return Err(format!("Downloaded file is too small ({} bytes). Refusing to install.",data.len()))}
  let mut f=std::fs::File::open(&src).map_err(|e|e.to_string())?;
  use std::io::Read;
  let mut header=[0_u8;16];
  f.read_exact(&mut header).map_err(|e|e.to_string())?;
  if header.starts_with(b"<!") || header.starts_with(b"<html") || header.starts_with(b"{"){
   return Err("Download is not a model file (web page or JSON), refusing to install.".into())
  }
  if target.exists(){return Err("Target weight already exists. No overwrite performed.".into())}
  std::fs::create_dir_all(target.parent().ok_or("Invalid model path")?).map_err(|e|e.to_string())?;
  std::fs::rename(&src,&target).or_else(|_|std::fs::copy(&src,&target).map(|_|())).map_err(|e|e.to_string())?;
  Ok(format!("Downloaded {} MB to {}. Installation requires a final inference test.",data.len()/1_000_000,target.display()))
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn import_model_weight(exe:String,name:String,source:String)->Result<String,String>{
 let root=runtime_root(&exe)?;
 let target=match name.as_str(){
 "informative"=>root.join("tools/informative-drawings/checkpoints/model/anime_style/netG_A_latest.pth"),
 "anime2sketch"=>root.join("tools/Anime2Sketch/weights/netG.pth"),
 "anime2sketch-improved"=>root.join("tools/Anime2Sketch/weights/improved.bin"),
 _=>return Err("Invalid model name".into())
 };
 let src=PathBuf::from(source);
 if !src.is_file()||src.extension().and_then(|v|v.to_str()).map(|v|v=="pth"||v=="bin")!=Some(true){return Err("Please select a .pth or .bin weight file".into())}
 if std::fs::metadata(&src).map_err(|e|e.to_string())?.len()<1024{return Err("Weight file too small".into())}
 if target.exists(){return Err("Weight already exists. No overwrite performed".into())}
 if let Some(parent)=target.parent(){std::fs::create_dir_all(parent).map_err(|e|e.to_string())?;}
 std::fs::copy(&src,&target).map_err(|e|e.to_string())?;
 Ok(target.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
 tauri::Builder::default().plugin(tauri_plugin_dialog::init()).manage(Renderer(Mutex::new(None)))
  .setup(|app| {if cfg!(debug_assertions) {app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;}Ok(())})
  .invoke_handler(tauri::generate_handler![save_input,output_dir,cancel_render,run_engine,reveal_output,read_preview,doctor_engine,model_status,install_model_code,import_model_weight,install_model_python,inspect_installation,prepare_model,install_model_complete])
  .run(tauri::generate_context!()).expect("error while building tauri application");
}
