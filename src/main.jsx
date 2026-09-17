import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Image, LayoutTemplate, FileCheck2, Download, Upload, Plus, Sparkles, LogOut, Save } from 'lucide-react';
import { supabase } from './lib/supabase';
import './styles.css';

const steps = [
  ['Conteúdo', BookOpen], ['Estilo', Sparkles], ['Imagens', Image],
  ['Diagramar', LayoutTemplate], ['Revisar', FileCheck2], ['Exportar', Download],
];

const cleanFileName = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMessage('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup' && !result.data.session) setMessage('Conta criada. Confirme o e-mail para entrar.');
    setBusy(false);
  };

  return <div className="authShell"><form className="authCard" onSubmit={submit}>
    <div className="logo authLogo">E</div><h1>Ebook Studio IA</h1><p>Entre para salvar seus projetos e arquivos com segurança.</p>
    <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/></label>
    <label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="mínimo 6 caracteres"/></label>
    <button className="primary full" disabled={busy}>{busy ? 'Aguarde...' : mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</button>
    <button type="button" className="linkBtn" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}</button>
    {message && <div className="notice">{message}</div>}
  </form></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [format, setFormat] = useState('A5_vertical');
  const [language, setLanguage] = useState('pt-BR');
  const [audience, setAudience] = useState('Família');
  const [visualStyle, setVisualStyle] = useState('3D Premium');
  const [project, setProject] = useState(null);
  const [ebook, setEbook] = useState(null);
  const [notice, setNotice] = useState('Selecione um tipo de material para iniciar.');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const title = useMemo(() => steps[step][0], [step]);
  if (!authReady) return <div className="loading">Carregando Ebook Studio IA...</div>;
  if (!session) return <AuthScreen/>;

  const resetProject = () => { setStep(0); setFile(null); setName(''); setProject(null); setEbook(null); setNotice('Novo projeto iniciado.'); };
  const selectFile = (event) => { const selected = event.target.files?.[0]; if (selected) { setFile(selected); if (!name) setName(selected.name.replace(/\.[^/.]+$/, '')); } };

  const saveContent = async () => {
    if (!name.trim()) return setNotice('Digite o nome do projeto.');
    if (!file) return setNotice('Selecione um PDF ou DOCX.');
    setBusy(true); setNotice('Salvando projeto e enviando arquivo...');
    try {
      let currentProject = project;
      if (!currentProject) {
        const { data, error } = await supabase.from('projects').insert({
          user_id: session.user.id, name: name.trim(), format, language,
          style_notes: JSON.stringify({ audience, visualStyle })
        }).select().single();
        if (error) throw error;
        currentProject = data; setProject(data);
      } else {
        const { data, error } = await supabase.from('projects').update({ name: name.trim(), format, language, style_notes: JSON.stringify({ audience, visualStyle }) }).eq('id', currentProject.id).select().single();
        if (error) throw error; currentProject = data; setProject(data);
      }

      const path = `${session.user.id}/${currentProject.id}/${Date.now()}-${cleanFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('ebook-sources').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      let currentEbook = ebook;
      if (!currentEbook) {
        const { data, error } = await supabase.from('ebooks').insert({ project_id: currentProject.id, title: name.trim(), source_file_path: path, source_type: file.name.split('.').pop()?.toLowerCase() || 'file' }).select().single();
        if (error) throw error; currentEbook = data; setEbook(data);
      } else {
        const { data, error } = await supabase.from('ebooks').update({ title: name.trim(), source_file_path: path, source_type: file.name.split('.').pop()?.toLowerCase() || 'file' }).eq('id', currentEbook.id).select().single();
        if (error) throw error; currentEbook = data; setEbook(data);
      }
      setNotice('✓ Projeto salvo e arquivo enviado ao Supabase com sucesso.');
      setStep(1);
    } catch (err) { setNotice(`Erro: ${err.message}`); }
    finally { setBusy(false); }
  };

  const saveStyle = async () => {
    if (!project) return setNotice('Salve o conteúdo primeiro.');
    setBusy(true);
    const { data, error } = await supabase.from('projects').update({ language, style_notes: JSON.stringify({ audience, visualStyle }) }).eq('id', project.id).select().single();
    setBusy(false);
    if (error) return setNotice(`Erro: ${error.message}`);
    setProject(data); setNotice('✓ Identidade visual salva.'); setStep(2);
  };

  const mockAction = (label) => setNotice(`${label} preparado para a próxima integração de geração de imagens.`);

  return <div className="app">
    <aside className="sidebar"><div className="brand"><div className="logo">E</div><div><strong>Ebook Studio IA</strong><span>Low Ticket Creator</span></div></div>
      <nav>{steps.map(([label, Icon], index) => <button key={label} className={step===index?'active':''} onClick={()=>setStep(index)}><span className="stepNumber">{index+1}</span><Icon size={18}/>{label}</button>)}</nav>
      <div className="connection"><i></i> Supabase conectado</div>
    </aside>
    <main><header><div><small>PROJETO ATUAL</small><h1>{project?.name || title}</h1></div><div className="headerActions"><button className="secondary" onClick={resetProject}><Plus size={17}/> Novo e-book</button><button className="iconBtn" title="Sair" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/></button></div></header>

      {step===0 && <section><div className="hero"><div><span className="tag">PASSO 1</span><h2>Envie o conteúdo já revisado</h2><p>PDF ou DOCX. O arquivo será salvo no Storage privado do Supabase.</p></div><label className="upload"><Upload size={32}/><strong>{file?file.name:'Arraste ou selecione seu e-book'}</strong><span>PDF ou DOCX</span><input type="file" accept=".pdf,.doc,.docx" onChange={selectFile}/></label></div>
        <div className="fields"><label>Nome do projeto<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: 30 Días Juntos con Dios"/></label><label>Formato<select value={format} onChange={e=>setFormat(e.target.value)}><option value="A5_vertical">A5 Vertical</option><option value="A4_vertical">A4 Vertical</option><option value="square">Quadrado 1:1</option><option value="mobile">Mobile 1080x1920</option></select></label></div>
        <div className="actionRow"><button className="primary" onClick={saveContent} disabled={busy}><Save size={17}/>{busy?'SALVANDO...':'SALVAR E CONTINUAR'}</button></div>{notice && <div className={notice.startsWith('Erro')?'error':'notice'}>{notice}</div>}</section>}

      {step===1 && <section><div className="sectionTitle"><span className="tag">PASSO 2</span><h2>Identidade visual</h2><p>Essas escolhas ficam salvas no projeto.</p></div><div className="fields three"><label>Público<select value={audience} onChange={e=>setAudience(e.target.value)}><option>Infantil</option><option>Adulto</option><option>Família</option></select></label><label>Estilo<select value={visualStyle} onChange={e=>setVisualStyle(e.target.value)}><option>3D Premium</option><option>Minimalista Premium</option><option>Editorial</option></select></label><label>Idioma<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="pt-BR">Português</option><option value="es">Espanhol</option><option value="en">Inglês</option></select></label></div><div className="palette"><div><h3>Paleta</h3><p>Preset inicial inspirado em Pequeños Adoradores.</p></div><div className="swatches"><i className="c1"></i><i className="c2"></i><i className="c3"></i><i className="c4"></i><i className="c5"></i></div></div><div className="actionRow"><button className="primary" onClick={saveStyle} disabled={busy}>SALVAR ESTILO E CONTINUAR</button></div>{notice&&<div className="notice">{notice}</div>}</section>}

      {step===2 && <section><div className="sectionTitle"><span className="tag">PASSO 3</span><h2>Materiais visuais</h2><p>Um botão para cada ativo do produto.</p></div><div className="assetGrid">{['Capa','Contracapa','Ilustrações internas','Mockup 3D'].map((item,i)=><button className="asset" key={item} onClick={()=>mockAction(item)}><b>0{i+1}</b><h3>Gerar {item}</h3><p>Preparar briefing e imagem.</p><span>Gerar →</span></button>)}</div><div className="notice">{notice}</div></section>}
      {step===3 && <section><div className="sectionTitle"><span className="tag">PASSO 4</span><h2>Montar o e-book</h2><p>Combinar conteúdo, imagens e identidade visual.</p></div><div className="compose"><div className="miniPages"><div>CAPA</div><div>PÁG. 02</div><div>PÁG. 03</div><div>...</div></div><button className="primary" onClick={()=>setNotice('Motor de diagramação será conectado na próxima etapa.')}>MONTAR EBOOK COMPLETO</button><p>{notice}</p></div></section>}
      {step===4 && <section><div className="sectionTitle"><span className="tag">PASSO 5</span><h2>Revisão visual</h2><p>Editor página por página antes da exportação.</p></div><div className="review"><div className="thumbs"><button>1<br/><small>Capa</small></button><button>2<br/><small>Interna</small></button></div><div className="canvas">Prévia da página</div><div className="inspector"><h3>Ajustes</h3><button>Trocar imagem</button><button>Reposicionar</button><button>Editar texto</button></div></div></section>}
      {step===5 && <section><div className="sectionTitle"><span className="tag">PASSO 6</span><h2>Exportar</h2><p>Arquivos finais do produto.</p></div><div className="exportGrid">{['PDF Digital','PDF para Impressão','Capa PNG','Mockup PNG'].map(item=><button key={item}><strong>{item}</strong><span>Preparar arquivo final</span></button>)}</div></section>}
    </main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
