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

const drawImageCover=(doc,data,x,y,w,h)=>{
  if(!data)return;
  const props=doc.getImageProperties(data);
  const scale=Math.max(w/props.width,h/props.height);
  const iw=props.width*scale,ih=props.height*scale;
  const ix=x+(w-iw)/2,iy=y+(h-ih)/2;
  doc.addImage(data,imageType(data),ix,iy,iw,ih,undefined,'FAST');
};

const fitText=(doc,text,maxW,maxH,startSize=11,minSize=7.5)=>{
  let size=startSize,lines=[];
  while(size>=minSize){doc.setFontSize(size);lines=doc.splitTextToSize(text||'',maxW);if(lines.length*size*.43<=maxH)break;size-=.5}
  return {size,lines};
};

const drawText=(doc,page,x,y,w,h)=>{
  const title=page.title||'';
  const body=page.body_text||'';
  doc.setTextColor(38,32,50);
  if(title){doc.setFont('helvetica','bold');doc.setFontSize(17);const t=doc.splitTextToSize(title,w);doc.text(t,x,y);y+=t.length*7+4;h-=t.length*7+4}
  doc.setFont('helvetica','normal');
  const fitted=fitText(doc,body,w,h,10.5,7.5);
  doc.setFontSize(fitted.size);doc.setLineHeightFactor(1.35);doc.text(fitted.lines,x,y,{maxWidth:w});
};

export async function buildPdf({pages,assetUrls,assets,format='A5_vertical',print=false}){
  const base=SIZES[format]||SIZES.A5_vertical;
  const bleed=print?3:0;
  const pageW=base[0]+bleed*2,pageH=base[1]+bleed*2;
  const doc=new jsPDF({orientation:pageW>pageH?'landscape':'portrait',unit:'mm',format:[pageW,pageH],compress:true});
  const cache={};
  const getImage=async id=>{if(!id)return null;if(cache[id])return cache[id];const url=assetUrls[id];if(!url)return null;cache[id]=await toDataUrl(url);return cache[id]};

  for(let i=0;i<pages.length;i++){
    if(i)doc.addPage([pageW,pageH],pageW>pageH?'landscape':'portrait');
    const page=pages[i],img=await getImage(page.image_asset_id);
    const x0=bleed,y0=bleed,w=base[0],h=base[1];
    doc.setFillColor(255,255,255);doc.rect(0,0,pageW,pageH,'F');

    if(page.layout_template==='full_image'&&img){drawImageCover(doc,img,x0,y0,w,h);continue}
    if(page.layout_template==='image_top'&&img){drawImageCover(doc,img,x0,y0,w,h*.38);drawText(doc,page,x0+12,y0+h*.43,w-24,h*.52);continue}
    if(page.layout_template==='image_side'&&img){drawImageCover(doc,img,x0+w*.60,y0,w*.40,h);drawText(doc,page,x0+12,y0+16,w*.50,h-30);continue}
    if(img){drawImageCover(doc,img,x0+w*.66,y0+12,w*.27,h*.24);drawText(doc,page,x0+12,y0+18,w*.57,h-30)}
    else drawText(doc,page,x0+14,y0+20,w-28,h-36);

    if(print){doc.setDrawColor(120);doc.setLineWidth(.15);const m=2;doc.line(0,bleed,bleed-m,bleed);doc.line(bleed,0,bleed,bleed-m);doc.line(pageW-bleed+m,bleed,pageW,bleed);doc.line(pageW-bleed,0,pageW-bleed,bleed-m);doc.line(0,pageH-bleed,bleed-m,pageH-bleed);doc.line(bleed,pageH-bleed+m,bleed,pageH);doc.line(pageW-bleed+m,pageH-bleed,pageW,pageH-bleed);doc.line(pageW-bleed,pageH-bleed+m,pageW-bleed,pageH)}
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
  if(type==='pdf_digital')blob=await buildPdf({pages,assetUrls,assets,format,print:false});
  else if(type==='pdf_print')blob=await buildPdf({pages,assetUrls,assets,format,print:true});
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
