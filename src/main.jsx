import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Image, LayoutTemplate, FileCheck2, Download, Upload, Plus, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import './styles.css';

const steps = [
  ['Conteúdo', BookOpen],
  ['Estilo', Sparkles],
  ['Imagens', Image],
  ['Diagramar', LayoutTemplate],
  ['Revisar', FileCheck2],
  ['Exportar', Download],
];

function App() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('Selecione um tipo de material para iniciar.');

  const title = useMemo(() => steps[step][0], [step]);

  const selectFile = (event) => {
    const selected = event.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!name) setName(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const mockAction = (label) => {
    setNotice(`${label} preparado para a próxima integração de IA.`);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">E</div>
          <div><strong>Ebook Studio IA</strong><span>Low Ticket Creator</span></div>
        </div>
        <nav>
          {steps.map(([label, Icon], index) => (
            <button key={label} className={step === index ? 'active' : ''} onClick={() => setStep(index)}>
              <span className="stepNumber">{index + 1}</span><Icon size={18}/>{label}
            </button>
          ))}
        </nav>
        <div className="connection"><i></i> Supabase conectado</div>
      </aside>

      <main>
        <header>
          <div><small>PROJETO ATUAL</small><h1>{title}</h1></div>
          <button className="secondary"><Plus size={17}/> Novo e-book</button>
        </header>

        {step === 0 && (
          <section>
            <div className="hero">
              <div><span className="tag">PASSO 1</span><h2>Envie o conteúdo já revisado</h2><p>PDF ou DOCX. Depois vamos adicionar imagens, diagramação e exportação final.</p></div>
              <label className="upload">
                <Upload size={32}/><strong>{file ? file.name : 'Arraste ou selecione seu e-book'}</strong><span>PDF ou DOCX</span>
                <input type="file" accept=".pdf,.doc,.docx" onChange={selectFile}/>
              </label>
            </div>
            <div className="fields">
              <label>Nome do projeto<input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: 30 Días Juntos con Dios"/></label>
              <label>Formato<select><option>A5 Vertical</option><option>A4 Vertical</option><option>Quadrado 1:1</option><option>Mobile 1080x1920</option></select></label>
            </div>
            {file && <div className="success">✓ Arquivo carregado: {file.name}</div>}
          </section>
        )}

        {step === 1 && (
          <section>
            <div className="sectionTitle"><span className="tag">PASSO 2</span><h2>Identidade visual</h2><p>Defina a direção visual antes de gerar as imagens.</p></div>
            <div className="fields three">
              <label>Público<select><option>Infantil</option><option>Adulto</option><option>Família</option></select></label>
              <label>Estilo<select><option>3D Premium</option><option>Minimalista Premium</option><option>Editorial</option></select></label>
              <label>Idioma<select><option>Português</option><option>Espanhol</option><option>Inglês</option></select></label>
            </div>
            <div className="palette"><div><h3>Paleta</h3><p>Preset inicial inspirado em Pequeños Adoradores.</p></div><div className="swatches"><i className="c1"></i><i className="c2"></i><i className="c3"></i><i className="c4"></i><i className="c5"></i></div></div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="sectionTitle"><span className="tag">PASSO 3</span><h2>Materiais visuais</h2><p>Um botão para cada ativo do produto.</p></div>
            <div className="assetGrid">
              {['Capa','Contracapa','Ilustrações internas','Mockup 3D'].map((item, i) => (
                <button className="asset" key={item} onClick={() => mockAction(item)}><b>0{i+1}</b><h3>Gerar {item}</h3><p>Preparar briefing e imagem.</p><span>Gerar →</span></button>
              ))}
            </div>
            <div className="notice">{notice}</div>
          </section>
        )}

        {step === 3 && (
          <section>
            <div className="sectionTitle"><span className="tag">PASSO 4</span><h2>Montar o e-book</h2><p>Combinar conteúdo, imagens e identidade visual.</p></div>
            <div className="compose">
              <div className="miniPages"><div>CAPA</div><div>PÁG. 02</div><div>PÁG. 03</div><div>...</div></div>
              <button className="primary" onClick={() => setNotice('Motor de diagramação será conectado na próxima etapa.')}>MONTAR EBOOK COMPLETO</button>
              <p>{notice}</p>
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <div className="sectionTitle"><span className="tag">PASSO 5</span><h2>Revisão visual</h2><p>Editor página por página antes da exportação.</p></div>
            <div className="review"><div className="thumbs"><button>1<br/><small>Capa</small></button><button>2<br/><small>Interna</small></button></div><div className="canvas">Prévia da página</div><div className="inspector"><h3>Ajustes</h3><button>Trocar imagem</button><button>Reposicionar</button><button>Editar texto</button></div></div>
          </section>
        )}

        {step === 5 && (
          <section>
            <div className="sectionTitle"><span className="tag">PASSO 6</span><h2>Exportar</h2><p>Arquivos finais do produto.</p></div>
            <div className="exportGrid">{['PDF Digital','PDF para Impressão','Capa PNG','Mockup PNG'].map(item => <button key={item}><strong>{item}</strong><span>Preparar arquivo final</span></button>)}</div>
          </section>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
