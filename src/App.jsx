import React,{useEffect,useMemo,useState} from 'react';
import {BookOpen,Image,LayoutTemplate,FileCheck2,Download,Upload,Plus,Sparkles,LogOut,Save,FolderOpen,ArrowLeft,Clock3,Trash2} from 'lucide-react';
import {supabase} from './lib/supabase';
import {exportFile,signedExportUrl} from './exporter';

const steps=[['Conteúdo',BookOpen],['Estilo',Sparkles],['Imagens',Image],['Diagramar',LayoutTemplate],['Revisar',FileCheck2],['Exportar',Download]];
const assetTypes=[['cover','Capa'],['back_cover','Contracapa'],['internal','Ilustração interna'],['mockup','Mockup 3D']];
const exportTypes=[['pdf_digital','PDF Digital'],['pdf_print','PDF para Impressão'],['cover_png','Capa PNG'],['mockup_png','Mockup PNG']];
const clean=v=>(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-');
const parse=v=>{try{return v?JSON.parse(v):{}}catch{return{}}};
const date=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';

const normalizeText=value=>String(value||'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const looksLikeHeading=line=>/^(#{1,4}\s+|semana\s+\d+|d[ií]a\s+\d+|cap[ií]tulo\s+\d+|parte\s+\d+|introdu[cç][aã]o|conclus[aã]o|b[oô]nus|bienvenida|índice|indice|oraciones|certificado|ideas para continuar|gracias por)/i.test(line.trim());
const segmentContent=(text,max=1450)=>{
  const src=normalizeText(text);
  if(!src)return [];
  const blocks=src.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  const out=[];let buf='';
  const flush=()=>{if(buf.trim())out.push(buf.trim());buf=''};
  for(const block of blocks){
    const first=(block.split('\n')[0]||'').trim();
    if(looksLikeHeading(first)&&buf)flush();
    if(buf&&(buf.length+block.length+2>max))flush();
    buf+=(buf?'\n\n':'')+block;
    if(buf.length>=max)flush();
  }
  flush();
  return out.length?out:[src];
};
const pageParts=chunk=>{
  const lines=normalizeText(chunk).split('\n').map(x=>x.trim()).filter(Boolean);
  let title='';
  if(lines.length&&looksLikeHeading(lines[0]))title=lines.shift().replace(/^#{1,4}\s*/,'').trim();
  else if(lines.length&&lines[0].length<=85&&lines.length>1)title=lines.shift().replace(/^#{1,4}\s*/,'').trim();
  return {title,body:lines.join('\n\n').trim()||normalizeText(chunk)};
};

function Auth(){
  const[mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setMsg('');const r=mode==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});if(r.error)setMsg(r.error.message);else if(mode==='signup'&&!r.data.session)setMsg('Conta criada. Confirme o e-mail para entrar.');setBusy(false)};
  return <div className="authShell"><form className="authCard" onSubmit={submit}><div className="logo authLogo">E</div><h1>Ebook Studio IA</h1><p>Entre para salvar seus projetos e arquivos.</p><label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary full" disabled={busy}>{busy?'Aguarde...':mode==='login'?'ENTRAR':'CRIAR CONTA'}</button><button type="button" className="linkBtn" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Ainda não tenho conta':'Já tenho conta'}</button>{msg&&<div className="notice">{msg}</div>}</form></div>;
}

export default function App(){
  const[session,setSession]=useState(null),[ready,setReady]=useState(false),[view,setView]=useState('dashboard'),[projects,setProjects]=useState([]),[loadingProjects,setLoadingProjects]=useState(false),[step,setStep]=useState(0),[project,setProject]=useState(null),[ebook,setEbook]=useState(null),[file,setFile]=useState(null),[contentBase,setContentBase]=useState(''),[name,setName]=useState(''),[format,setFormat]=useState('A5_vertical'),[language,setLanguage]=useState('pt-BR'),[audience,setAudience]=useState('Família'),[visualStyle,setVisualStyle]=useState('3D Premium'),[assets,setAssets]=useState([]),[assetUrls,setAssetUrls]=useState({}),[assetPrompt,setAssetPrompt]=useState(''),[pages,setPages]=useState([]),[selectedPage,setSelectedPage]=useState(null),[exports,setExports]=useState([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[exportBusy,setExportBusy]=useState('');

  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const{data:s}=supabase.auth.onAuthStateChange((_e,n)=>setSession(n));return()=>s.subscription.unsubscribe()},[]);
  useEffect(()=>{if(session)loadProjects()},[session]);
  useEffect(()=>{if(project?.id&&step>=2)loadAssets(project.id);if(ebook?.id&&step>=3)loadPages(ebook.id);if(ebook?.id&&step===5)loadExports(ebook.id)},[project?.id,ebook?.id,step]);
  const title=useMemo(()=>steps[step][0],[step]);

  const loadProjects=async()=>{setLoadingProjects(true);const{data}=await supabase.from('projects').select('*,ebooks(id,title,source_file_path,source_type,content_status,updated_at)').order('updated_at',{ascending:false});setProjects(data||[]);setLoadingProjects(false)};
  const loadAssets=async id=>{const{data,error}=await supabase.from('assets').select('*').eq('project_id',id).order('created_at',{ascending:true});if(error)return setNotice(`Erro: ${error.message}`);setAssets(data||[]);const urls={};for(const a of data||[]){const{data:s}=await supabase.storage.from('ebook-assets').createSignedUrl(a.file_path,3600);if(s?.signedUrl)urls[a.id]=s.signedUrl}setAssetUrls(urls)};
  const loadPages=async id=>{const{data}=await supabase.from('pages').select('*').eq('ebook_id',id).order('sort_order',{ascending:true});setPages(data||[]);if(data?.length)setSelectedPage(p=>p&&data.some(x=>x.id===p.id)?p:data[0])};
  const loadExports=async id=>{const{data,error}=await supabase.from('exports').select('*').eq('ebook_id',id).order('created_at',{ascending:false});if(!error)setExports(data||[])};

  if(!ready)return <div className="loading">Carregando Ebook Studio IA...</div>;
  if(!session)return <Auth/>;

  const reset=()=>{setProject(null);setEbook(null);setFile(null);setContentBase('');setName('');setFormat('A5_vertical');setLanguage('pt-BR');setAudience('Família');setVisualStyle('3D Premium');setAssetPrompt('');setAssets([]);setPages([]);setSelectedPage(null);setExports([]);setStep(0);setView('editor');setNotice('Novo projeto iniciado.')};
  const open=item=>{const s=parse(item.style_notes);setProject(item);setEbook(item.ebooks?.[0]||null);setFile(null);setContentBase('');setName(item.name||'');setFormat(item.format||'A5_vertical');setLanguage(item.language||'pt-BR');setAudience(s.audience||'Família');setVisualStyle(s.visualStyle||'3D Premium');setAssetPrompt(s.briefing||'');setStep(Math.max(0,Math.min(5,item.current_step||0)));setView('editor');setNotice('Projeto carregado.')};
  const goto=async n=>{setStep(n);if(project){await supabase.from('projects').update({current_step:n}).eq('id',project.id);setProject(p=>({...p,current_step:n}))}};

  const saveContent=async()=>{
    if(!name.trim())return setNotice('Digite o nome do projeto.');
    if(!contentBase.trim()&&!file&&!ebook?.source_file_path)return setNotice('Cole o conteúdo-base ou anexe um arquivo de texto/DOCX.');
    setBusy(true);
    try{
      let p=project;
      const notes={audience,visualStyle,briefing:assetPrompt};
      if(!p){const r=await supabase.from('projects').insert({user_id:session.user.id,name:name.trim(),format,language,current_step:1,style_notes:JSON.stringify(notes)}).select().single();if(r.error)throw r.error;p=r.data;setProject(p)}
      else{const r=await supabase.from('projects').update({name:name.trim(),format,language,current_step:1,style_notes:JSON.stringify({...parse(p.style_notes),...notes})}).eq('id',p.id).select().single();if(r.error)throw r.error;p=r.data;setProject(p)}
      let path=ebook?.source_file_path||null,type=ebook?.source_type||null;
      if(contentBase.trim()){
        const blob=new Blob([normalizeText(contentBase)],{type:'text/plain;charset=utf-8'});
        path=`${session.user.id}/${p.id}/${Date.now()}-conteudo-base.txt`;type='txt';
        const u=await supabase.storage.from('ebook-sources').upload(path,blob,{contentType:'text/plain;charset=utf-8'});if(u.error)throw u.error;
      }else if(file){
        path=`${session.user.id}/${p.id}/${Date.now()}-${clean(file.name)}`;type=file.name.split('.').pop()?.toLowerCase();
        const u=await supabase.storage.from('ebook-sources').upload(path,file,{contentType:file.type||undefined});if(u.error)throw u.error;
      }
      let e=ebook;
      if(!e){const r=await supabase.from('ebooks').insert({project_id:p.id,title:name.trim(),source_file_path:path,source_type:type,content_status:'source_ready'}).select().single();if(r.error)throw r.error;e=r.data}
      else{const r=await supabase.from('ebooks').update({title:name.trim(),source_file_path:path,source_type:type,content_status:'source_ready'}).eq('id',e.id).select().single();if(r.error)throw r.error;e=r.data}
      setEbook(e);setStep(1);await loadProjects();setNotice('✓ Conteúdo-base salvo. Agora o app vai diagramar a partir do texto, não do layout antigo.');
    }catch(err){setNotice(`Erro: ${err.message}`)}finally{setBusy(false)}
  };

  const saveStyle=async()=>{if(!project)return;setBusy(true);const notes={...parse(project.style_notes),audience,visualStyle,briefing:assetPrompt};const r=await supabase.from('projects').update({language,current_step:2,style_notes:JSON.stringify(notes)}).eq('id',project.id).select().single();setBusy(false);if(r.error)return setNotice(`Erro: ${r.error.message}`);setProject(r.data);setStep(2);setNotice('✓ Estilo salvo.')};
  const persistBriefing=async()=>{if(!project)return;const notes={...parse(project.style_notes),audience,visualStyle,briefing:assetPrompt};const{data}=await supabase.from('projects').update({style_notes:JSON.stringify(notes)}).eq('id',project.id).select().single();if(data)setProject(data)};
  const uploadAsset=async(type,img)=>{if(!img||!project||!ebook)return;setBusy(true);try{await persistBriefing();const path=`${session.user.id}/${project.id}/${type}/${Date.now()}-${clean(img.name)}`;const u=await supabase.storage.from('ebook-assets').upload(path,img,{contentType:img.type||'image/png'});if(u.error)throw u.error;const r=await supabase.from('assets').insert({project_id:project.id,ebook_id:ebook.id,asset_type:type,file_path:path,mime_type:img.type,generation_prompt:assetPrompt||null,source:'upload'});if(r.error)throw r.error;await loadAssets(project.id);setNotice('✓ Imagem salva.')}catch(err){setNotice(`Erro: ${err.message}`)}finally{setBusy(false)}};
  const removeAsset=async a=>{await supabase.storage.from('ebook-assets').remove([a.file_path]);await supabase.from('assets').delete().eq('id',a.id);await loadAssets(project.id)};
  const signedSource=async()=>{const r=await supabase.storage.from('ebook-sources').createSignedUrl(ebook.source_file_path,300);if(r.error)throw r.error;return r.data.signedUrl};

  const extractSource=async()=>{
    const url=await signedSource();const response=await fetch(url);if(!response.ok)throw new Error('Não foi possível abrir o conteúdo-base.');
    const type=(ebook.source_type||'').toLowerCase();
    if(['txt','md','markdown'].includes(type)){const text=await response.text();return segmentContent(text)}
    const buffer=await response.arrayBuffer();
    if(['doc','docx'].includes(type)){const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:buffer});return segmentContent(result.value)}
    if(type==='pdf'){
      const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc=await pdfjs.getDocument({data:new Uint8Array(buffer),disableWorker:true}).promise;
      const text=[];for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),tc=await page.getTextContent();text.push(tc.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim())}
      return text.filter(Boolean);
    }
    throw new Error('Formato não suportado. Use texto colado, TXT, MD ou DOCX. PDF funciona apenas como importação legada.');
  };

  const buildEbook=async()=>{
    if(!ebook)return setNotice('Salve o conteúdo-base primeiro.');setBusy(true);setNotice('Estruturando o texto e montando as páginas...');
    try{
      const chunks=await extractSource();if(!chunks.length)throw new Error('O conteúdo-base está vazio.');
      const cover=assets.find(a=>a.asset_type==='cover'),back=assets.find(a=>a.asset_type==='back_cover'),internal=assets.filter(a=>a.asset_type==='internal');
      await supabase.from('pages').delete().eq('ebook_id',ebook.id);
      const rows=[];let n=1;
      if(cover)rows.push({ebook_id:ebook.id,page_number:n++,page_type:'cover',title:name,body_text:'',layout_template:'full_image',image_asset_id:cover.id,sort_order:0});
      chunks.forEach((chunk,i)=>{
        const part=pageParts(chunk);const len=part.body.length;const useImage=internal.length>0&&i%3===1&&len<1200;const img=useImage?internal[Math.floor(i/3)%internal.length]:null;
        const layout=!img?'text_focus':len<650?'image_side':'image_top';
        rows.push({ebook_id:ebook.id,page_number:n++,page_type:'content',title:part.title||null,body_text:part.body,layout_template:layout,image_asset_id:img?.id||null,sort_order:i+1});
      });
      if(back)rows.push({ebook_id:ebook.id,page_number:n++,page_type:'back_cover',title:'Contracapa',body_text:'',layout_template:'full_image',image_asset_id:back.id,sort_order:rows.length});
      const ins=await supabase.from('pages').insert(rows).select();if(ins.error)throw ins.error;
      await supabase.from('ebooks').update({page_count:rows.length,content_status:'diagrammed'}).eq('id',ebook.id);await supabase.from('projects').update({current_step:3}).eq('id',project.id);
      setPages(ins.data||[]);setSelectedPage(ins.data?.[0]||null);setNotice(`✓ E-book reconstruído a partir do conteúdo-base: ${rows.length} páginas.`);
    }catch(err){setNotice(`Erro ao diagramar: ${err.message}`)}finally{setBusy(false)}
  };

  const savePage=async patch=>{if(!selectedPage)return;const next={...selectedPage,...patch};setSelectedPage(next);setPages(ps=>ps.map(p=>p.id===next.id?next:p));await supabase.from('pages').update(patch).eq('id',next.id)};
  const finishDiagram=async()=>{if(!pages.length)return setNotice('Monte o e-book primeiro.');await supabase.from('projects').update({current_step:4}).eq('id',project.id);setStep(4);setNotice('✓ Diagramação salva. Agora revise página por página.')};
  const previewImage=p=>{const a=assets.find(x=>x.id===p?.image_asset_id);return a?assetUrls[a.id]:null};
  const doExport=async type=>{if(!pages.length)return setNotice('O e-book precisa estar diagramado antes da exportação.');setExportBusy(type);setNotice('Gerando arquivo final...');try{const result=await exportFile({supabase,session,project,ebook,pages,assets,assetUrls,format,type});await loadExports(ebook.id);setNotice(`✓ ${exportTypes.find(x=>x[0]===type)?.[1]} gerado e salvo.`);if(result.signed_url){const a=document.createElement('a');a.href=result.signed_url;a.download=result.filename;document.body.appendChild(a);a.click();a.remove()}}catch(err){setNotice(`Erro ao exportar: ${err.message}`)}finally{setExportBusy('')}};
  const downloadExport=async item=>{try{const url=await signedExportUrl(supabase,item.file_path);window.open(url,'_blank','noopener,noreferrer')}catch(err){setNotice(`Erro: ${err.message}`)}};

  if(view==='dashboard')return <div className="dashboardShell"><header className="dashboardHeader"><div className="brand dark"><div className="logo">E</div><div><strong>Ebook Studio IA</strong><span>Low Ticket Creator</span></div></div><button className="iconBtn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button></header><main className="dashboardMain"><div className="dashboardTitle"><div><small>SEUS PROJETOS</small><h1>Meus e-books</h1><p>Abra um projeto ou crie um novo.</p></div><button className="primary" onClick={reset}><Plus size={18}/> NOVO E-BOOK</button></div>{loadingProjects?<div className="emptyState">Carregando...</div>:projects.length===0?<div className="emptyState"><FolderOpen size={42}/><h2>Nenhum e-book ainda</h2><button className="primary" onClick={reset}>CRIAR PRIMEIRO E-BOOK</button></div>:<div className="projectGrid">{projects.map(item=>{const e=item.ebooks?.[0],current=steps[Math.max(0,Math.min(5,item.current_step||0))][0];return <button className="projectCard" key={item.id} onClick={()=>open(item)}><div className="projectIcon"><BookOpen size={23}/></div><div className="projectCardBody"><span className="statusPill">Etapa: {current}</span><h3>{item.name}</h3><p>{e?.source_type?`Base: ${e.source_type.toUpperCase()}`:'Sem conteúdo-base'} · {item.format?.replace('_',' ')}</p><small><Clock3 size={13}/> {date(item.updated_at)}</small></div><span className="openLabel">ABRIR →</span></button>})}</div>}</main></div>;

  return <div className="app"><aside className="sidebar"><div className="brand"><div className="logo">E</div><div><strong>Ebook Studio IA</strong><span>Low Ticket Creator</span></div></div><button className="backDash" onClick={async()=>{await loadProjects();setView('dashboard')}}><ArrowLeft size={17}/> Meus e-books</button><nav>{steps.map(([l,I],i)=><button key={l} className={step===i?'active':''} onClick={()=>goto(i)}><span className="stepNumber">{i+1}</span><I size={18}/>{l}</button>)}</nav><div className="connection"><i></i> Supabase conectado</div></aside><main><header><div><small>PROJETO ATUAL</small><h1>{project?.name||title}</h1></div><div className="headerActions"><button className="secondary" onClick={reset}><Plus size={17}/> Novo e-book</button><button className="iconBtn" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button></div></header>

  {step===0&&<section><div className="sectionTitle"><span className="tag">PASSO 1</span><h2>Adicionar conteúdo-base</h2><p>Use o texto limpo do e-book. O app vai decidir onde quebrar páginas, distribuir textos e inserir imagens.</p></div><div className="fields"><label>Nome do projeto<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Formato<select value={format} onChange={e=>setFormat(e.target.value)}><option value="A5_vertical">A5 Vertical</option><option value="A4_vertical">A4 Vertical</option><option value="square">Quadrado 1:1</option><option value="mobile">Mobile</option></select></label></div><label>Colar texto-base<textarea className="bodyEditor" style={{minHeight:280}} value={contentBase} onChange={e=>setContentBase(e.target.value)} placeholder={'Cole aqui o texto completo do e-book.\n\nUse títulos e subtítulos em linhas separadas para o app reconhecer a estrutura.'}/></label><div className="hero"><div><h3>Ou anexar conteúdo-base</h3><p>Recomendado: TXT, Markdown ou DOCX. PDF fica apenas como importação legada.</p></div><label className="upload"><Upload size={28}/><strong>{file?file.name:ebook?.source_type?`Base ${ebook.source_type.toUpperCase()} salva`:'Anexar TXT / MD / DOCX'}</strong><input type="file" accept=".txt,.md,.markdown,.doc,.docx,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);setContentBase('');if(!name)setName(f.name.replace(/\.[^/.]+$/,''))}}}/></label></div>{file?.name?.toLowerCase().endsWith('.pdf')&&<div className="notice">PDF será tratado como importação legada. Para melhor resultado, use o texto-base limpo em TXT, MD, DOCX ou cole o conteúdo acima.</div>}<div className="actionRow"><button className="primary" onClick={saveContent} disabled={busy}><Save size={17}/>{busy?'SALVANDO...':'SALVAR CONTEÚDO-BASE'}</button></div></section>}
  {step===1&&<section><div className="sectionTitle"><span className="tag">PASSO 2</span><h2>Identidade visual</h2></div><div className="fields three"><label>Público<select value={audience} onChange={e=>setAudience(e.target.value)}><option>Infantil</option><option>Adulto</option><option>Família</option></select></label><label>Estilo<select value={visualStyle} onChange={e=>setVisualStyle(e.target.value)}><option>3D Premium</option><option>Minimalista Premium</option><option>Editorial</option></select></label><label>Idioma<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="pt-BR">Português</option><option value="es">Espanhol</option><option value="en">Inglês</option></select></label></div><div className="actionRow"><button className="primary" onClick={saveStyle}>SALVAR ESTILO E CONTINUAR</button></div></section>}
  {step===2&&<section><div className="sectionTitle"><span className="tag">PASSO 3</span><h2>Imagens do projeto</h2><p>Envie capa, contracapa, ilustrações e mockup. As ilustrações serão distribuídas automaticamente sem competir com o texto.</p></div><label>Briefing visual<textarea className="promptBox" value={assetPrompt} onChange={e=>setAssetPrompt(e.target.value)} onBlur={persistBriefing} placeholder="Ex.: ilustração 3D premium, luz cinematográfica..."/></label><div className="assetGrid">{assetTypes.map(([k,l])=><label className="asset" key={k}><b>{l}</b><p>PNG, JPG ou WebP</p><span>ADICIONAR →</span><input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadAsset(k,e.target.files?.[0])}/></label>)}</div><div className="assetLibrary">{assets.map(a=><div className="assetThumb" key={a.id}>{assetUrls[a.id]?<img src={assetUrls[a.id]}/>:<div>Imagem</div>}<small>{assetTypes.find(x=>x[0]===a.asset_type)?.[1]||a.asset_type}</small><button onClick={()=>removeAsset(a)}><Trash2 size={14}/></button></div>)}</div><div className="actionRow"><button className="primary" onClick={()=>goto(3)} disabled={!assets.length}>CONTINUAR PARA DIAGRAMAÇÃO</button></div></section>}
  {step===3&&<section><div className="sectionTitle"><span className="tag">PASSO 4</span><h2>Diagramação automática</h2><p>O app lê o conteúdo-base, identifica blocos e títulos, cria as páginas e distribui as ilustrações com espaço seguro para o texto.</p></div><div className="diagramToolbar"><button className="primary" onClick={buildEbook} disabled={busy}>{busy?'MONTANDO...':'MONTAR EBOOK COMPLETO'}</button><span>{pages.length?`${pages.length} páginas montadas`:'Ainda não montado'}</span></div>{pages.length>0&&<div className="diagramWorkspace"><div className="pageList">{pages.map(p=><button key={p.id} className={selectedPage?.id===p.id?'selected':''} onClick={()=>setSelectedPage(p)}><b>{p.page_number}</b><span>{p.page_type==='cover'?'Capa':p.page_type==='back_cover'?'Contracapa':p.title||'Conteúdo'}</span></button>)}</div><div className={`pagePreview ${selectedPage?.layout_template||''}`}>{previewImage(selectedPage)&&<img src={previewImage(selectedPage)}/>}<div className="pageText"><h3>{selectedPage?.title}</h3><p>{selectedPage?.body_text}</p></div></div><div className="pageInspector"><h3>Ajustes da página</h3><label>Layout<select value={selectedPage?.layout_template||'text_focus'} onChange={e=>savePage({layout_template:e.target.value})}><option value="text_focus">Texto principal</option><option value="image_top">Imagem no topo</option><option value="image_side">Imagem lateral</option><option value="full_image">Imagem total</option></select></label><label>Imagem<select value={selectedPage?.image_asset_id||''} onChange={e=>savePage({image_asset_id:e.target.value||null})}><option value="">Sem imagem</option>{assets.filter(a=>['cover','back_cover','internal'].includes(a.asset_type)).map(a=><option value={a.id} key={a.id}>{assetTypes.find(x=>x[0]===a.asset_type)?.[1]}</option>)}</select></label><label>Título<input value={selectedPage?.title||''} onChange={e=>savePage({title:e.target.value})}/></label><label>Texto<textarea className="bodyEditor" value={selectedPage?.body_text||''} onChange={e=>savePage({body_text:e.target.value})}/></label></div></div>}<div className="actionRow"><button className="primary" onClick={finishDiagram} disabled={!pages.length}>SALVAR DIAGRAMAÇÃO E REVISAR</button></div></section>}
  {step===4&&<section><div className="sectionTitle"><span className="tag">PASSO 5</span><h2>Revisão visual</h2><p>Confira as páginas montadas antes da exportação.</p></div><div className="reviewCards">{pages.map(p=><button key={p.id} onClick={()=>{setSelectedPage(p);setStep(3)}}><b>Página {p.page_number}</b><span>{p.page_type}</span></button>)}</div><div className="actionRow"><button className="primary" onClick={()=>goto(5)}>APROVAR E IR PARA EXPORTAÇÃO</button></div></section>}
  {step===5&&<section><div className="sectionTitle"><span className="tag">PASSO 6</span><h2>Exportar arquivos finais</h2><p>Os arquivos são gerados no navegador, salvos no Storage privado e registrados no projeto.</p></div><div className="exportGrid">{exportTypes.map(([k,l])=><button key={k} onClick={()=>doExport(k)} disabled={!!exportBusy}><strong>{exportBusy===k?'GERANDO...':l}</strong><span>{k==='pdf_print'?'Com sangria de 3 mm e marcas de corte':k==='mockup_png'?'Usa o mockup enviado ou cria um a partir da capa':'Gerar, salvar e baixar'}</span></button>)}</div>{exports.length>0&&<div className="exportHistory"><h3>Arquivos já gerados</h3>{exports.map(item=><button className="exportHistoryItem" key={item.id} onClick={()=>downloadExport(item)}><span>{exportTypes.find(x=>x[0]===item.export_type)?.[1]||item.export_type}</span><small>{date(item.created_at)} · baixar novamente</small></button>)}</div>}</section>}
  {notice&&<div className={notice.startsWith('Erro')?'error':'notice'}>{notice}</div>}
  </main></div>;
}
