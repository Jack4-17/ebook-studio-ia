import { jsPDF } from 'jspdf';

const SIZES={A5_vertical:[148,210],A4_vertical:[210,297],square:[210,210],mobile:[108,192]};
const slug=value=>(value||'ebook').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'ebook';

const toDataUrl=async url=>{
  const res=await fetch(url);
  if(!res.ok)throw new Error('Não foi possível carregar uma imagem do projeto.');
  const blob=await res.blob();
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
};

const imageType=data=>String(data).startsWith('data:image/png')?'PNG':'JPEG';

const safePdfText=value=>String(value||'')
  .replace(/📖/g,'BÍBLIA ·')
  .replace(/🎵/g,'CANCIÓN ·')
  .replace(/💛/g,'')
  .replace(/💬/g,'')
  .replace(/🎯/g,'')
  .replace(/🙏/g,'')
  .replace(/☐/g,'[ ]')
  .replace(/[🌟🐟🌱🦁🏆🚩🎁🎉🎊🚀🫙✏️🌙😨😔✝️★♥✦🗺️🗺]/gu,'')
  .replace(/[\u{1F300}-\u{1FAFF}]/gu,'')
  .replace(/[\u0000-\u001f]/g,' ')
  .replace(/\s+/g,' ')
  .trim();

const splitTitleBody=page=>{
  let raw=String(page?.body_text||'').trim().replace(/^\d+\s+/,'');
  let kicker='';
  let title='';

  const day=raw.match(/^(SEMANA\s+\d+\s+DÍA\s+\d+)\s+(.+?)(?=\s+📖|\s+BÍBLIA\s*·|\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+\d+:\d+)/i);
  if(day){kicker=day[1].toUpperCase();title=day[2].trim();raw=raw.slice(day[0].length).trim()}
  else{
    const intros=[
      'Bienvenida, familia','Cómo usar este devocional','Nuestro Camino de 30 Días','Índice',
      'Oraciones para momentos especiales','Semana extra: creen su propio devocional',
      'Certificado de Familia Adoradora','Ideas para continuar','Gracias por caminar con nosotros'
    ];
    const hit=intros.find(x=>raw.toLowerCase().startsWith(x.toLowerCase()));
    if(hit){title=hit;raw=raw.slice(hit.length).trim()}
    else{
      const t=String(page?.title||'').trim();
      if(t&&!/^Página\s+\d+$/i.test(t))title=t;
    }
  }

  return {kicker,title,body:raw};
};

const sectionsFromBody=value=>{
  const src=String(value||'')
    .replace(/\s+💛\s*Para entender:/g,'\n§Para entender|')
    .replace(/\s+💬\s*Para conversar:/g,'\n§Para conversar|')
    .replace(/\s+🎯\s*Reto de hoy:/g,'\n§Reto de hoy|')
    .replace(/\s+🙏\s*Oramos juntos:/g,'\n§Oramos juntos|')
    .replace(/\s+Para entender:/g,'\n§Para entender|')
    .replace(/\s+Para conversar:/g,'\n§Para conversar|')
    .replace(/\s+Reto de hoy:/g,'\n§Reto de hoy|')
    .replace(/\s+Oramos juntos:/g,'\n§Oramos juntos|');
  const parts=src.split('\n§').filter(Boolean);
  const out=[];
  parts.forEach((p,i)=>{
    const idx=p.indexOf('|');
    if(idx>0)out.push({label:p.slice(0,idx),text:p.slice(idx+1)});
    else out.push({label:i===0?'': '',text:p});
  });
  return out;
};

const drawImageCover=(doc,data,x,y,w,h)=>{
  if(!data)return;
  const props=doc.getImageProperties(data);
  const scale=Math.max(w/props.width,h/props.height);
  const iw=props.width*scale,ih=props.height*scale;
  const ix=x+(w-iw)/2,iy=y+(h-ih)/2;
  doc.addImage(data,imageType(data),ix,iy,iw,ih,undefined,'FAST');
};

const drawImageContain=(doc,data,x,y,w,h)=>{
  if(!data)return;
  const props=doc.getImageProperties(data);
  const scale=Math.min(w/props.width,h/props.height);
  const iw=props.width*scale,ih=props.height*scale;
  const ix=x+(w-iw)/2,iy=y+(h-ih)/2;
  doc.addImage(data,imageType(data),ix,iy,iw,ih,undefined,'FAST');
};

const fitLines=(doc,text,w,maxH,start=10.2,min=7.6)=>{
  let size=start,lines=[];
  while(size>=min){
    doc.setFontSize(size);
    lines=doc.splitTextToSize(safePdfText(text),w);
    const lh=size*.3528*1.32;
    if(lines.length*lh<=maxH)break;
    size-=.3;
  }
  return {size,lines};
};

const drawHeader=(doc,{kicker,title},x,y,w)=>{
  let yy=y;
  if(kicker){
    doc.setFillColor(238,231,248);doc.roundedRect(x,yy-4,44,8,3,3,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(101,65,136);doc.text(safePdfText(kicker),x+4,yy+1);
    yy+=11;
  }
  if(title){
    doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(49,35,66);
    const lines=doc.splitTextToSize(safePdfText(title),w);
    doc.text(lines,x,yy);
    yy+=lines.length*7+3;
  }
  return yy;
};

const drawStructuredBody=(doc,body,x,y,w,h)=>{
  const sections=sectionsFromBody(body);
  let yy=y;
  const plain=sections.length===1&&!sections[0].label;
  if(plain){
    const f=fitLines(doc,body,w,h,10.5,8.2);
    doc.setFont('helvetica','normal');doc.setFontSize(f.size);doc.setLineHeightFactor(1.35);doc.setTextColor(60,54,68);doc.text(f.lines,x,yy,{maxWidth:w});
    return;
  }

  for(const s of sections){
    const txt=safePdfText(s.text);
    if(!txt)continue;
    if(s.label){
      const remaining=h-(yy-y);
      if(remaining<14)break;
      doc.setFillColor(248,245,251);doc.roundedRect(x,yy-4,w,7,2.5,2.5,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.setTextColor(102,72,132);doc.text(safePdfText(s.label).toUpperCase(),x+4,yy+.8);
      yy+=7;
    }
    const maxH=Math.max(8,h-(yy-y));
    const f=fitLines(doc,txt,w,maxH,9.5,7.7);
    doc.setFont('helvetica','normal');doc.setFontSize(f.size);doc.setLineHeightFactor(1.3);doc.setTextColor(63,58,70);doc.text(f.lines,x,yy,{maxWidth:w});
    yy+=f.lines.length*f.size*.3528*1.3+4;
    if(yy>y+h-4)break;
  }
};

const preparePages=(pages,sourceType)=>{
  const list=[...pages];
  if(String(sourceType||'').toLowerCase()==='pdf'&&list[0]?.page_type==='cover'){
    const first=list.findIndex(p=>p.page_type==='content');
    if(first>=0){
      const text=String(list[first].body_text||'').toUpperCase();
      if(text.includes('30 DÍAS')&&text.includes('JUNTOS')&&text.includes('CON DIOS'))list.splice(first,1);
    }
  }
  return list;
};

const chooseLayout=(page,img)=>{
  if(page.page_type==='cover'||page.page_type==='back_cover')return 'full_image';
  const {body}=splitTitleBody(page);
  const len=safePdfText(body).length;
  if(!img)return 'text';
  if(len>900)return 'text';
  if(len>650)return 'image_small';
  return 'image_top';
};

export async function buildPdf({pages,assetUrls,assets,format='A5_vertical',print=false,sourceType=null}){
  const base=SIZES[format]||SIZES.A5_vertical;
  const bleed=print?3:0;
  const pageW=base[0]+bleed*2,pageH=base[1]+bleed*2;
  const doc=new jsPDF({orientation:pageW>pageH?'landscape':'portrait',unit:'mm',format:[pageW,pageH],compress:true});
  const cache={};
  const getImage=async id=>{if(!id)return null;if(cache[id])return cache[id];const url=assetUrls[id];if(!url)return null;cache[id]=await toDataUrl(url);return cache[id]};
  const finalPages=preparePages(pages,sourceType);

  for(let i=0;i<finalPages.length;i++){
    if(i)doc.addPage([pageW,pageH],pageW>pageH?'landscape':'portrait');
    const page=finalPages[i],img=await getImage(page.image_asset_id);
    const x0=bleed,y0=bleed,w=base[0],h=base[1];
    doc.setFillColor(255,253,250);doc.rect(0,0,pageW,pageH,'F');

    const layout=chooseLayout(page,img);
    if(layout==='full_image'&&img){
      drawImageCover(doc,img,x0,y0,w,h);
    }else{
      const info=splitTitleBody(page);
      doc.setFillColor(247,242,251);doc.rect(x0, y0, 7, h, 'F');
      let top=y0+16;
      if(layout==='image_top'&&img){
        doc.setFillColor(250,247,252);doc.roundedRect(x0+14,top-3,w-28,52,5,5,'F');
        drawImageContain(doc,img,x0+17,top,w-34,46);
        top+=58;
      }else if(layout==='image_small'&&img){
        doc.setFillColor(250,247,252);doc.roundedRect(x0+w-49,top-4,34,29,4,4,'F');
        drawImageContain(doc,img,x0+w-47,top-2,30,25);
      }

      const contentX=x0+17;
      const contentW=layout==='image_small'?w-72:w-34;
      const headerY=drawHeader(doc,info,contentX,top,contentW);
      const bodyY=headerY+2;
      const bodyH=y0+h-18-bodyY;
      drawStructuredBody(doc,info.body,contentX,bodyY,contentW,bodyH);

      doc.setDrawColor(229,221,236);doc.setLineWidth(.25);doc.line(contentX,y0+h-13,x0+w-17,y0+h-13);
      doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(132,120,143);
      doc.text('Pequeños Adoradores',contentX,y0+h-8);
      doc.text(String(i+1),x0+w-17,y0+h-8,{align:'right'});
    }

    if(print){
      doc.setDrawColor(120);doc.setLineWidth(.15);const m=2;
      doc.line(0,bleed,bleed-m,bleed);doc.line(bleed,0,bleed,bleed-m);
      doc.line(pageW-bleed+m,bleed,pageW,bleed);doc.line(pageW-bleed,0,pageW-bleed,bleed-m);
      doc.line(0,pageH-bleed,bleed-m,pageH-bleed);doc.line(bleed,pageH-bleed+m,bleed,pageH);
      doc.line(pageW-bleed+m,pageH-bleed,pageW,pageH-bleed);doc.line(pageW-bleed,pageH-bleed+m,pageW-bleed,pageH);
    }
  }
  return doc.output('blob');
}

const imageToPngBlob=async(url,{mockup=false}={})=>{
  const data=await toDataUrl(url);
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=data});
  const canvas=document.createElement('canvas');
  if(!mockup){canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const c=canvas.getContext('2d');c.drawImage(img,0,0);return await new Promise(r=>canvas.toBlob(r,'image/png',1))}
  canvas.width=1400;canvas.height=1200;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=45;c.shadowOffsetX=30;c.shadowOffsetY=38;c.setTransform(1,.08,-.18,1,260,120);const targetH=900,targetW=targetH*(img.naturalWidth/img.naturalHeight);c.drawImage(img,0,0,targetW,targetH);c.restore();return await new Promise(r=>canvas.toBlob(r,'image/png',1))
};

export async function exportFile({supabase,session,project,ebook,pages,assets,assetUrls,format,type}){
  if(!project||!ebook)throw new Error('Projeto não carregado.');
  let blob,ext='pdf';
  if(type==='pdf_digital')blob=await buildPdf({pages,assetUrls,assets,format,print:false,sourceType:ebook.source_type});
  else if(type==='pdf_print')blob=await buildPdf({pages,assetUrls,assets,format,print:true,sourceType:ebook.source_type});
  else{
    ext='png';
    const requested=type==='cover_png'?'cover':'mockup';
    let asset=assets.find(a=>a.asset_type===requested);
    let mockup=false;
    if(!asset&&requested==='mockup'){asset=assets.find(a=>a.asset_type==='cover');mockup=true}
    if(!asset)throw new Error(requested==='cover'?'Adicione uma capa antes de exportar.':'Adicione um mockup ou pelo menos uma capa.');
    const url=assetUrls[asset.id];
    if(!url)throw new Error('Imagem ainda não disponível para exportação.');
    blob=await imageToPngBlob(url,{mockup});
  }
  if(!blob)throw new Error('Falha ao gerar o arquivo.');
  const filename=`${slug(project.name)}-${type}-${Date.now()}.${ext}`;
  const path=`${session.user.id}/${project.id}/${filename}`;
  const up=await supabase.storage.from('ebook-exports').upload(path,blob,{contentType:ext==='pdf'?'application/pdf':'image/png',upsert:false});
  if(up.error)throw up.error;
  const row=await supabase.from('exports').insert({ebook_id:ebook.id,export_type:type,file_path:path,status:'ready'}).select().single();
  if(row.error)throw row.error;
  await supabase.from('ebooks').update({content_status:'exported'}).eq('id',ebook.id);
  await supabase.from('projects').update({current_step:5,status:'ready'}).eq('id',project.id);
  const signed=await supabase.storage.from('ebook-exports').createSignedUrl(path,3600);
  return {...row.data,signed_url:signed.data?.signedUrl||null,filename};
}

export async function signedExportUrl(supabase,path){
  const {data,error}=await supabase.storage.from('ebook-exports').createSignedUrl(path,3600);
  if(error)throw error;
  return data.signedUrl;
}
