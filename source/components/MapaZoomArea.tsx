"use client";

import React,{useCallback,useEffect,useRef,useState} from "react";

type Vista={x:number;y:number;width:number;height:number};
type Ponto={x:number;y:number};
type Arrasto={pointerId:number;origem:Ponto;vista:Vista};
type Pinca={distancia:number;vista:Vista;centro:Ponto};
const MIN_ZOOM=1;
const MAX_ZOOM=12;
const limitar=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

function interpretarViewBox(valor?:string):Vista {
 const parts=(valor??"").trim().split(/[\s,]+/).map(Number);
 if(parts.length!==4||parts.some(v=>!Number.isFinite(v))||parts[2]<=0||parts[3]<=0)
  throw new Error("MapaZoomArea exige SVG com viewBox numérico.");
 return {x:parts[0],y:parts[1],width:parts[2],height:parts[3]};
}
function limitarVista(vista:Vista,base:Vista):Vista {
 const width=limitar(vista.width,base.width/MAX_ZOOM,base.width);
 const height=limitar(vista.height,base.height/MAX_ZOOM,base.height);
 return {x:limitar(vista.x,base.x,base.x+base.width-width),
  y:limitar(vista.y,base.y,base.y+base.height-height),width,height};
}
function calcularZoom(vista:Vista,base:Vista):number{return base.width/vista.width;}

export function MapaZoomArea({children,rotulo,className=""}:{
 children:React.ReactElement<React.SVGProps<SVGSVGElement>>;rotulo:string;className?:string;
}){
 const svg=React.Children.only(children);
 const viewBoxOriginal=String(svg.props.viewBox??"");
 const base=interpretarViewBox(viewBoxOriginal);
 const baseRef=useRef(base);
 baseRef.current=base;

 const area=useRef<HTMLDivElement|null>(null);
 const ponteiros=useRef(new Map<number,Ponto>());
 const arrasto=useRef<Arrasto|null>(null);
 const pinca=useRef<Pinca|null>(null);
 const arrastou=useRef(false);
 const [vista,setVista]=useState<Vista>(base);
 const vistaRef=useRef(vista);
 const frameRef=useRef<number|null>(null);
 vistaRef.current=vista;
 useEffect(()=>()=>{if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);},[]);

 const alterar=useCallback((proxima:Vista)=>{
  const nova=limitarVista(proxima,baseRef.current);
  vistaRef.current=nova;
  if(frameRef.current===null){
   frameRef.current=requestAnimationFrame(()=>{
    frameRef.current=null;
    setVista(vistaRef.current);
   });
  }
 },[]);

 useEffect(()=>{
  const reset=interpretarViewBox(viewBoxOriginal);
  ponteiros.current.clear();
  arrasto.current=null;pinca.current=null;arrastou.current=false;
  alterar(reset);
 },[viewBoxOriginal,alterar]);

 const geometria=useCallback((atual:Vista)=>{
  const svgEl=area.current?.querySelector("svg");
  if(!svgEl)return null;
  const bounds=svgEl.getBoundingClientRect();
  const pixelsPorUnidade=Math.min(bounds.width/atual.width,bounds.height/atual.height);
  if(!Number.isFinite(pixelsPorUnidade)||pixelsPorUnidade<=0)return null;
  return {bounds,pixelsPorUnidade,
   left:bounds.left+(bounds.width-atual.width*pixelsPorUnidade)/2,
   top:bounds.top+(bounds.height-atual.height*pixelsPorUnidade)/2};
 },[]);

 const zoomEm=useCallback((fator:number,ponto?:Ponto)=>{
  const atual=vistaRef.current;
  const baseAtual=baseRef.current;
  const atualZoom=calcularZoom(atual,baseAtual);
  const proximoZoom=limitar(atualZoom*fator,MIN_ZOOM,MAX_ZOOM);
  if(proximoZoom===MIN_ZOOM){alterar(baseAtual);return;}
  const width=baseAtual.width/proximoZoom,height=baseAtual.height/proximoZoom;
  const geom=geometria(atual);
  const ratioX=ponto&&geom?limitar((ponto.x-geom.left)/(atual.width*geom.pixelsPorUnidade),0,1):.5;
  const ratioY=ponto&&geom?limitar((ponto.y-geom.top)/(atual.height*geom.pixelsPorUnidade),0,1):.5;
  const ancoraX=atual.x+ratioX*atual.width,ancoraY=atual.y+ratioY*atual.height;
  alterar({x:ancoraX-ratioX*width,y:ancoraY-ratioY*height,width,height});
 },[alterar,geometria]);

 const restaurar=useCallback(()=>alterar(baseRef.current),[alterar]);

 useEffect(()=>{
  const surface=area.current;
  if(!surface)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.deltaY)return;
   event.preventDefault();
   zoomEm(Math.exp(-event.deltaY*.0013),{x:event.clientX,y:event.clientY});
  };
  surface.addEventListener("wheel",wheel,{passive:false});
  return ()=>surface.removeEventListener("wheel",wheel);
 },[zoomEm]);

 const iniciar=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  ponteiros.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(ponteiros.current.size===1){
   arrasto.current={pointerId:event.pointerId,origem:{x:event.clientX,y:event.clientY},vista:vistaRef.current};
   pinca.current=null;arrastou.current=false;
  }else if(ponteiros.current.size===2){
   const [a,b]=[...ponteiros.current.values()];
   pinca.current={distancia:Math.hypot(a.x-b.x,a.y-b.y)||1,
    centro:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},vista:vistaRef.current};
   arrasto.current=null;arrastou.current=true;
   try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}
  }
 };

 const mover=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(!ponteiros.current.has(event.pointerId))return;
  ponteiros.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(ponteiros.current.size===2&&pinca.current){
   const [a,b]=[...ponteiros.current.values()];
   const original=pinca.current;
   const zoomOriginal=calcularZoom(original.vista,baseRef.current);
   const scale=limitar(zoomOriginal*Math.hypot(a.x-b.x,a.y-b.y)/original.distancia,MIN_ZOOM,MAX_ZOOM);
   const width=baseRef.current.width/scale,height=baseRef.current.height/scale;
   const oldGeom=geometria(original.vista);
   if(!oldGeom)return;
   const ax=original.vista.x+(original.centro.x-oldGeom.left)/oldGeom.pixelsPorUnidade;
   const ay=original.vista.y+(original.centro.y-oldGeom.top)/oldGeom.pixelsPorUnidade;
   const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   const rect=oldGeom.bounds;
   const novoScale=Math.min(rect.width/width,rect.height/height);
   const nleft=rect.left+(rect.width-width*novoScale)/2;
   const ntop=rect.top+(rect.height-height*novoScale)/2;
   alterar({x:ax-(midpoint.x-nleft)/novoScale,y:ay-(midpoint.y-ntop)/novoScale,width,height});
   arrastou.current=true;
  }else if(ponteiros.current.size===1&&arrasto.current){
   const start=arrasto.current;
   const dx=event.clientX-start.origem.x,dy=event.clientY-start.origem.y;
   if(Math.hypot(dx,dy)>6&&!arrastou.current){
    arrastou.current=true;
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}
   }
   if(arrastou.current&&calcularZoom(start.vista,baseRef.current)>MIN_ZOOM){
    const geom=geometria(start.vista);
    if(geom)alterar({...start.vista,x:start.vista.x-dx/geom.pixelsPorUnidade,
     y:start.vista.y-dy/geom.pixelsPorUnidade});
   }
  }
 };
 const terminar=(event:React.PointerEvent<HTMLDivElement>)=>{
  ponteiros.current.delete(event.pointerId);
  if(event.currentTarget.hasPointerCapture(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
  if(ponteiros.current.size===1){
   const [id,p]=[...ponteiros.current.entries()][0];
   arrasto.current={pointerId:id,origem:p,vista:vistaRef.current};
   pinca.current=null;
  }else if(ponteiros.current.size===0){
   arrasto.current=null;pinca.current=null;
  }
 };
 const impedirCliqueAposArrasto=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(arrastou.current){event.preventDefault();event.stopPropagation();arrastou.current=false;}
 };

 const atual=vista;
 const zoom=calcularZoom(atual,base);
 const clone=React.cloneElement(svg,{
  viewBox:`${atual.x} ${atual.y} ${atual.width} ${atual.height}`,
  shapeRendering:"geometricPrecision",
  textRendering:"geometricPrecision"
 } as React.SVGProps<SVGSVGElement>);
 return <div className={"ruido-map-zoom "+className} data-zoom={zoom.toFixed(2)}>
  <div className="ruido-map-zoom__surface" ref={area} aria-label={rotulo}
   onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar}
   onPointerCancel={terminar} onClickCapture={impedirCliqueAposArrasto}>
   {clone}
  </div>
  <div className="ruido-map-zoom__tools" role="group" aria-label={"Controles de zoom: "+rotulo}>
   <button type="button" onClick={()=>zoomEm(1.6)} disabled={zoom>=MAX_ZOOM-.02} aria-label="Ampliar mapa" title="Ampliar mapa">+</button>
   <span className="ruido-map-zoom__percent" aria-live="off">{Math.round(zoom*100)}%</span>
   <button type="button" onClick={()=>zoomEm(1/1.6)} disabled={zoom<=MIN_ZOOM+.02} aria-label="Reduzir mapa" title="Reduzir mapa">−</button>
   <button type="button" className="ruido-map-zoom__reset" onClick={restaurar} aria-label="Restaurar enquadramento do mapa" title="Restaurar zoom">⟲</button>
  </div>
 </div>;
}
