/* PIKOL QR Lite: dependency-free QR Version 1-L encoder for short payment payloads (<=17 UTF-8 bytes). */
(function(g){'use strict';
function gfMul(x,y){var r=0;while(y){if(y&1)r^=x;y>>=1;x=(x<<1)^((x&0x80)?0x11d:0)}return r&255}
function gfPow(x,p){var r=1;while(p--)r=gfMul(r,x);return r}
function polyMul(a,b){var r=new Array(a.length+b.length-1).fill(0);for(var i=0;i<a.length;i++)for(var j=0;j<b.length;j++)r[i+j]^=gfMul(a[i],b[j]);return r}
function ecc(data,n){var gen=[1];for(var i=0;i<n;i++)gen=polyMul(gen,[1,gfPow(2,i)]);var msg=data.concat(new Array(n).fill(0));for(i=0;i<data.length;i++){var c=msg[i];if(!c)continue;for(var j=0;j<gen.length;j++)msg[i+j]^=gfMul(gen[j],c)}return msg.slice(data.length)}
function bits(val,len,out){for(var i=len-1;i>=0;i--)out.push((val>>i)&1)}
function payloadBytes(txt){return Array.from(new TextEncoder().encode(String(txt||''))).slice(0,17)}
function codewords(txt){var b=[],raw=payloadBytes(txt);bits(4,4,b);bits(raw.length,8,b);raw.forEach(function(x){bits(x,8,b)});var cap=19*8;for(var i=0;i<Math.min(4,cap-b.length);i++)b.push(0);while(b.length%8)b.push(0);var d=[];for(i=0;i<b.length;i+=8){var v=0;for(var j=0;j<8;j++)v=(v<<1)|b[i+j];d.push(v)}var pad=[236,17],k=0;while(d.length<19)d.push(pad[k++%2]);return d.concat(ecc(d,7))}
function qr(txt){var N=21,m=Array.from({length:N},function(){return new Array(N).fill(null)}),res=Array.from({length:N},function(){return new Array(N).fill(false)});
function set(r,c,v,rv){if(r>=0&&c>=0&&r<N&&c<N){m[r][c]=!!v;if(rv)res[r][c]=true}}
function finder(r,c){for(var y=-1;y<=7;y++)for(var x=-1;x<=7;x++){var rr=r+y,cc=c+x;if(rr<0||cc<0||rr>=N||cc>=N)continue;var v=(x>=0&&x<=6&&y>=0&&y<=6&&(x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4)));set(rr,cc,v,true)}}
finder(0,0);finder(0,N-7);finder(N-7,0);for(var i=8;i<N-8;i++){set(6,i,i%2===0,true);set(i,6,i%2===0,true)}set(N-8,8,true,true);
// reserve format areas
for(i=0;i<9;i++){if(i!==6){res[8][i]=true;res[i][8]=true;if(m[8][i]===null)m[8][i]=false;if(m[i][8]===null)m[i][8]=false}}
for(i=0;i<8;i++){res[8][N-1-i]=true;if(m[8][N-1-i]===null)m[8][N-1-i]=false;res[N-1-i][8]=true;if(m[N-1-i][8]===null)m[N-1-i][8]=false}
var cw=codewords(txt),data=[];cw.forEach(function(x){bits(x,8,data)});var idx=0,up=true;for(var col=N-1;col>0;col-=2){if(col===6)col--;for(var z=0;z<N;z++){var row=up?N-1-z:z;for(var q=0;q<2;q++){var cc=col-q;if(res[row][cc])continue;var v=idx<data.length?data[idx++]:0;if(((row+cc)%2)===0)v^=1;set(row,cc,v,false)}}up=!up}
// format info: error correction L + mask 0 => BCH-masked 0x77c4.
// QR format bits are placed LSB-first in the standard vertical/horizontal tracks.
var fmt=0x77c4;for(i=0;i<15;i++){var bit=(fmt>>i)&1;
  if(i<6)set(i,8,bit,true);else if(i<8)set(i+1,8,bit,true);else set(N-15+i,8,bit,true);
  if(i<8)set(8,N-i-1,bit,true);else if(i<9)set(8,15-i,bit,true);else set(8,15-i-1,bit,true);
}set(N-8,8,true,true);return m}
function svg(text,size){size=size||220;var m=qr(text),n=m.length,q=4,s=n+q*2,rect='';for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(m[y][x])rect+='<rect x="'+(x+q)+'" y="'+(y+q)+'" width="1" height="1"/>';return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+s+' '+s+'" width="'+size+'" height="'+size+'" role="img" aria-label="Payment QR"><rect width="100%" height="100%" fill="white"/><g fill="black">'+rect+'</g></svg>'}
g.PIKOL_QR={svg:svg,dataUri:function(t,s){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(t,s))}}})(window);
