const pages = new Set(['/','/guides/','/guides/temporarily-unblock-one-website/','/guides/block-websites-during-working-hours/','/guides/what-to-do-while-your-coding-agent-runs/','/download/','/privacy/']);
const sources = new Set(['google','bing','chatgpt','perplexity','reddit','claude','other','direct/unknown']);
const uuid = value => typeof value==='string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.hostname==='www.usefokus.dev'||(url.hostname==='usefokus.dev'&&url.protocol!=='https:')){
      url.hostname='usefokus.dev';url.protocol='https:';return Response.redirect(url,301);
    }
    if (/^\/releases\/Fokus-[\d.]+-arm64\.zip$/.test(url.pathname)) {
      return Response.redirect('https://github.com/AtotheY/fokus/releases/latest/download/Fokus-arm64.zip', 302);
    }
    if(url.pathname!=='/api/event'){
      const asset=await env.ASSETS.fetch(request);
      if(!asset.headers.get('content-type')?.startsWith('text/html'))return asset;
      const html=new Response(asset.body,asset);
      html.headers.set('Cache-Control','public, max-age=0, must-revalidate, no-transform');
      return html;
    }
    const result = status=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST')return result(405);
    if(request.headers.get('origin')!==url.origin)return result(403);
    if(/Googlebot|Google-InspectionTool|OAI-SearchBot|ChatGPT-User|GPTBot|bingbot|PerplexityBot/i.test(request.headers.get('user-agent')||''))return result(204);
    if(request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return result(204);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return result(415);
    const size=Number(request.headers.get('content-length'));
    if(!size||size>1024)return result(413);
    let e;try{e=await request.json();}catch{return result(400);}
    if(!e||typeof e!=='object')return result(400);
    if(e.kind==='activation' && uuid(e.receipt)){
      const id=(request.headers.get('cookie')||'').match(/(?:^|; )fokus_download=([^;]+)/)?.[1];
      await env.DB.prepare('INSERT OR IGNORE INTO activations(receipt,visit) VALUES (?,(SELECT visit FROM events WHERE visit=? AND kind=\'download\' LIMIT 1))').bind(e.receipt,uuid(id)?id:'').run();
      return result(204);
    }
    if(!uuid(e.id)||!['view','demo','cta','download'].includes(e.kind)||!pages.has(e.entry)||!pages.has(e.page)||!sources.has(e.source))return result(400);
    const guide=pages.has(e.guide)&&e.guide.startsWith('/guides/')&&e.guide!='/guides/'?e.guide:'';
    await env.DB.prepare('INSERT OR IGNORE INTO events(visit,kind,page,entry,source,guide) VALUES (?,?,?,?,?,?)').bind(e.id,e.kind,e.page,e.entry,e.source,guide).run();
    return result(204);
  }
};
