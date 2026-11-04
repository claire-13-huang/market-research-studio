/* Market Research Studio Cloud Sync v0.5 — no secret keys; Supabase RLS is mandatory. */
(function () {
  'use strict';
  var cfg = window.MRS_CLOUD_CONFIG || {};
  var state = {client:null,user:null,pushing:false,queued:false,pulling:false,timer:null,message:''};
  var PARAM = 'shared_project';
  var RELEASE = '0.5.0';
  function el(s){return document.querySelector(s)}
  function escapeHtml(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function active(){return typeof project==='function'?project():null}
  function enabled(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(cfg.url||'')) && String(cfg.publishableKey||'').length>15}
  function viewer(p){p=p||active();return !!(p&&p.__cloud&&p.__cloud.ownerId!==state.user?.id)}
  function clean(x){return JSON.parse(JSON.stringify(x,function(k,v){return (k==='__cloud'||k==='fileKey')?undefined:v}))}
  function hash(x){var s=JSON.stringify(clean(x)),h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return String(h>>>0)+':'+s.length}
  function cache(){try{localStorage.setItem(KEY,JSON.stringify(app))}catch(e){console.warn('Cannot save local cache',e)}}
  function notice(s){state.message=s;var badge=el('#cloudBadge');if(badge)badge.textContent=s}
  function urlFor(id){var u=new URL(location.href);u.searchParams.set(PARAM,id);u.searchParams.delete('build');u.searchParams.delete('v');return u.toString()}
  function makeShell(){
    var top=el('.top-actions');if(!top||el('#cloudButton'))return;
    var b=document.createElement('span');b.id='cloudBadge';b.className='cloud-badge';b.textContent='☁ 未连接';
    var btn=document.createElement('button');btn.id='cloudButton';btn.className='btn ghost';btn.textContent='☁ 团队同步';btn.onclick=show;
    top.insertBefore(b,el('#btnExport'));top.insertBefore(btn,el('#btnExport'));
    var css=document.createElement('style');
    css.textContent='.cloud-badge{font-size:12px;color:#526781;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cloud-overlay{position:fixed;inset:0;background:#0c18366c;z-index:9990;display:flex;justify-content:center;align-items:center;padding:18px}.cloud-card{background:white;color:#22314c;box-shadow:0 15px 60px #15284955;border-radius:18px;padding:24px;width:min(590px,100%);max-height:92vh;overflow:auto}.cloud-card h2{margin:0 0 10px}.cloud-card p{font-size:13px;line-height:1.7;color:#62718d}.cloud-card input{padding:10px 12px;width:100%;border:1px solid #cbd6ea;border-radius:9px;margin:5px 0 12px}.cloud-card button{border:1px solid #d5dfed;border-radius:9px;padding:9px 13px;background:#f7f9ff;cursor:pointer;margin:2px}.cloud-card button.primary{background:#3066d6;color:white}.cloud-card button:disabled{opacity:.5}.cloud-line{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #ecf0f6}.cloud-note{background:#edf4ff;border-radius:10px;padding:12px}.cloud-readonly{padding:12px 18px;background:#fff3d6;color:#76591e;font-size:13px;text-align:center}.cloud-update{position:fixed;bottom:20px;right:20px;background:#1b3357;color:white;border-radius:12px;padding:12px;z-index:9992}.cloud-update button{margin-left:8px;padding:7px;border:0;border-radius:7px;cursor:pointer}';
    document.head.appendChild(css);
    document.addEventListener('click',blockViewer,true);
    document.addEventListener('change',blockViewer,true);
    document.addEventListener('click',function(e){var t=e.target.closest('[data-cloud]');if(t)action(t.dataset.cloud,t)},false);
  }
  function dialog(body){
    var shade=el('#cloudOverlay');if(!shade){shade=document.createElement('div');shade.id='cloudOverlay';shade.className='cloud-overlay';document.body.appendChild(shade)}
    shade.innerHTML='<div class="cloud-card" role="dialog" aria-modal="true"><div style="display:flex;justify-content:space-between;align-items:center"><h2>团队数据同步</h2><button data-cloud="close">关闭</button></div>'+body+'</div>';
  }
  function show(){
    if(!enabled()){dialog('<div class="cloud-note">网站已经加入同步模块，但尚未配置 Supabase 项目。现在其他同事刷新仍看不到你的浏览器数据。</div><p>按仓库 SUPABASE-SETUP.md 创建数据库、配置网址和公开 publishable key，之后可发布当前项目。不要上传 service_role 密钥，也不要把包含采购成本的 Excel 提交到公开 GitHub。</p>');return}
    if(!state.client){dialog('<p>Supabase SDK 加载失败，请检查网络后刷新。</p>');return}
    if(!state.user){dialog('<p>请输入邮箱，使用收到的登录链接验证身份。只有被邀请的邮箱才能看到共享项目。</p><label>邮箱</label><input id="cloudEmail" type="email" placeholder="你的工作邮箱"><button class="primary" data-cloud="login">发送登录链接</button>');return}
    var p=active(),c=p?.__cloud,owner=c?.ownerId===state.user.id;
    var body='<p>当前账号：<b>'+escapeHtml(state.user.email)+'</b></p><div class="cloud-note">'+escapeHtml(state.message||'登录成功')+'</div><div><button data-cloud="list">刷新云端项目</button><button data-cloud="logout">退出登录</button>';
    if(p&&!c)body+='<button class="primary" data-cloud="publish">将当前项目发布到云端</button>';
    if(owner)body+='<button class="primary" data-cloud="push">立即保存最新进度</button>';
    body+='</div>';
    if(c)body+='<p>当前项目：'+escapeHtml(p.name)+' · '+(owner?'所有者':'只读共享')+' · 云端版本 V'+c.revision+'</p>';
    if(owner)body+='<label>授权同事的邮箱（只读）</label><input id="cloudInvite" type="email" placeholder="同事的登录邮箱"><button class="primary" data-cloud="invite">授权邮箱</button><button data-cloud="share">复制项目链接</button>';
    body+='<div id="cloudList" style="margin-top:18px"></div>';
    dialog(body);list();
  }
  async function list(){
    if(!state.client||!state.user||!el('#cloudList'))return;
    var q=await state.client.from('mrs_projects').select('id,name,owner_id,revision,updated_at').order('updated_at',{ascending:false});
    if(!el('#cloudList'))return;
    if(q.error){el('#cloudList').textContent='读取失败：'+q.error.message;return}
    var html='<b>当前账号可访问的项目（'+q.data.length+'）</b>';
    q.data.forEach(function(row){
      html+='<div class="cloud-line"><div><b>'+escapeHtml(row.name)+'</b><div style="font-size:12px;color:#697a92">'+(row.owner_id===state.user.id?'我创建的':'同事共享')+' · V'+row.revision+' · '+escapeHtml((row.updated_at||'').slice(0,16))+'</div></div><button data-cloud="open" data-id="'+escapeHtml(row.id)+'">打开</button></div>';
    });
    if(!q.data.length)html+='<p>尚无云端项目，请在自己的项目中选择“发布”。</p>';
    el('#cloudList').innerHTML=html;
  }
  async function action(which,target){
    if(which==='close'){el('#cloudOverlay')?.remove();return}
    if(which==='login'){
      var mail=el('#cloudEmail')?.value.trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail||'')){alert('请输入正确的邮箱');return}
      target.disabled=true;
      var loginUrl=location.origin+location.pathname+location.search;
      var r=await state.client.auth.signInWithOtp({email:mail,options:{emailRedirectTo:loginUrl}});
      target.disabled=false;alert(r.error?'发送失败：'+r.error.message:'登录邮件已发送，请点击邮件里的验证链接。');return;
    }
    if(which==='logout'){
      var oldId=state.user?.id;
      await state.client.auth.signOut();
      app.projects=app.projects.filter(function(p){return !p.__cloud||p.__cloud.ownerId===oldId});
      state.user=null;cache();render();notice('☁ 未登录');show();return;
    }
    if(which==='list'){await pull();show();return}
    if(which==='publish'){await publish();show();return}
    if(which==='push'){await push(true);show();return}
    if(which==='invite'){await invite();show();return}
    if(which==='share'){
      var p=active();if(!p?.__cloud)return;
      try{await navigator.clipboard.writeText(urlFor(p.__cloud.id));notice('☁ 已复制分享链接');}catch(e){prompt('复制下面的网址',urlFor(p.__cloud.id))}
      show();return;
    }
    if(which==='open'){await pull(target.dataset.id);el('#cloudOverlay')?.remove()}
  }
  async function publish(){
    var p=active();if(!p||!state.user)return;
    if(p.__cloud){notice('☁ 已发布，不需要重复发布');return}
    var content=clean(p);
    var q=await state.client.from('mrs_projects').insert({owner_id:state.user.id,local_project_id:p.id,name:p.name,payload:content}).select('id,revision').single();
    if(q.error){notice('⚠ 发布失败：'+q.error.message);return}
    p.__cloud={id:q.data.id,ownerId:state.user.id,revision:q.data.revision,hash:hash(p)};
    cache();notice('☁ 已发布到云端，之后自动保存');
  }
  async function invite(){
    var p=active(),c=p?.__cloud;
    if(!c||c.ownerId!==state.user.id)return;
    var mail=el('#cloudInvite')?.value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail||'')){alert('请输入正确的同事邮箱');return}
    var r=await state.client.from('mrs_project_invites').upsert({project_id:c.id,email:mail,added_by:state.user.id},{onConflict:'project_id,email'});
    notice(r.error?'⚠ 授权失败：'+r.error.message:'☁ 已授权：'+mail);
  }
  function schedule(){
    var p=active();
    if(!state.user||!p?.__cloud||p.__cloud.ownerId!==state.user.id)return;
    clearTimeout(state.timer);notice('☁ 修改待同步…');state.timer=setTimeout(function(){push(false)},900);
  }
  async function push(force){
    var p=active(),c=p?.__cloud;if(!state.client||!state.user||!c||c.ownerId!==state.user.id)return;
    if(state.pushing){state.queued=true;return}
    var sig=hash(p);if(!force&&sig===c.hash){notice('☁ 云端已是最新');return}
    state.pushing=true;notice('☁ 正在保存…');
    try{
      var version=c.revision;
      var q=await state.client.from('mrs_projects').update({name:p.name,payload:clean(p),revision:version+1,updated_at:new Date().toISOString()}).eq('id',c.id).eq('revision',version).select('revision').maybeSingle();
      if(q.error)throw q.error;
      if(!q.data){notice('⚠ 云端有新版本；请先备份，再从云端刷新，未覆盖任何数据');return}
      c.revision=q.data.revision;c.hash=sig;cache();notice('☁ 已保存到云端 V'+c.revision);
      if(hash(p)!==sig)state.queued=true;
    }catch(e){notice('⚠ 同步失败，本机仍有草稿：'+e.message)}
    finally{state.pushing=false;if(state.queued){state.queued=false;schedule()}}
  }
  async function pull(focus){
    if(!state.client||!state.user||state.pulling)return;
    state.pulling=true;
    try{
      var q=await state.client.from('mrs_projects').select('id,local_project_id,name,owner_id,payload,revision,updated_at').order('updated_at',{ascending:false});
      if(q.error)throw q.error;
      var changed=false;
      q.data.forEach(function(row){
        var content=row.payload;
        if(!content?.id||!Array.isArray(content.skus)||!Array.isArray(content.competitors))return;
        var i=app.projects.findIndex(function(p){return p.__cloud?.id===row.id||(p.id===row.local_project_id&&row.owner_id===state.user.id)});
        var old=i<0?null:app.projects[i];
        if(old?.__cloud?.revision===row.revision)return;
        if(old?.__cloud?.ownerId===state.user.id&&hash(old)!==old.__cloud.hash){notice('⚠ 本机有尚未同步的修改，未覆盖');return}
        var fresh=Object.assign({},content,{__cloud:{id:row.id,ownerId:row.owner_id,revision:row.revision}});
        fresh.__cloud.hash=hash(fresh);
        if(old&&!old.__cloud&&row.owner_id===state.user.id){try{localStorage.setItem(KEY+'-before-cloud-'+row.id,JSON.stringify(old))}catch(e){}}
        if(i<0)app.projects.push(fresh);else app.projects[i]=fresh;changed=true;
      });
      var target=focus||new URLSearchParams(location.search).get(PARAM);
      if(target){var shared=app.projects.find(function(p){return p.__cloud?.id===target});if(shared&&app.activeId!==shared.id){app.activeId=shared.id;changed=true}}
      if(changed){cache();render()}
      notice('☁ 已读取最新云端数据 '+new Date().toLocaleTimeString());
    }catch(e){notice('⚠ 读取失败：'+e.message)}
    finally{state.pulling=false}
  }
  function blockViewer(e){
    if(!viewer())return;
    var inContent=e.target.closest('#mainContent');
    if(e.type==='change'&&inContent&&e.target.matches('input,textarea')){e.stopImmediatePropagation();e.preventDefault();return}
    if(e.type!=='click')return;
    var t=e.target.closest('[data-action],#btnSaveVersion');
    if(!t)return;
    var a=t.dataset.action||t.id;
    var allowed=['goto','open-project','download-version','download-source','export-json','export-csv','export-print','select-version','close-modal','btnExport'];
    if(allowed.indexOf(a)>=0)return;
    e.stopImmediatePropagation();e.preventDefault();alert('这是同事共享的只读项目，不能修改。');
  }
  function readonly(){
    el('#cloudReadOnly')?.remove();
    if(!viewer()){if(el('#btnSaveVersion'))el('#btnSaveVersion').disabled=false;return}
    var main=el('#mainContent');
    if(!main)return;
    var p=document.createElement('div');p.id='cloudReadOnly';p.className='cloud-readonly';p.textContent='☁ 只读共享项目：刷新后读取所有者最新保存的进度。';main.prepend(p);
    main.querySelectorAll('input,textarea').forEach(function(input){input.disabled=true});
    if(el('#btnSaveVersion'))el('#btnSaveVersion').disabled=true;
  }
  async function checkRelease(){
    try{
      var r=await fetch('release.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      var d=await r.json();if(d.version===RELEASE||!d.version||el('#cloudUpdate'))return;
      var n=document.createElement('div');n.id='cloudUpdate';n.className='cloud-update';
      n.innerHTML='网站已有新版本 '+escapeHtml(d.version)+' <button id="cloudReload">刷新应用</button>';
      document.body.appendChild(n);
      el('#cloudReload').onclick=function(){var u=new URL(location.href);u.searchParams.set('build',d.version);location.replace(u.toString())}
    }catch(e){}
  }
  async function initCloud(){
    makeShell();
    var oldSave=save;save=function(){oldSave.apply(this,arguments);schedule()};
    var oldRender=render;render=function(){var out=oldRender.apply(this,arguments);readonly();return out};
    readonly();
    if(!enabled()){notice('☁ 未连接数据库');checkRelease();return}
    if(!window.supabase){notice('⚠ 云端组件加载失败');return}
    state.client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    var r=await state.client.auth.getSession();
    state.user=r.data?.session?.user||null;
    state.client.auth.onAuthStateChange(function(evt,session){
      var before=state.user?.id;
      state.user=session?.user||null;
      if(state.user&&before!==state.user.id)setTimeout(function(){pull()},100);
      if(!state.user)notice('☁ 未登录');
    });
    if(state.user){await pull();notice('☁ 已连接：'+state.user.email)}else notice('☁ 请登录以同步');
    window.addEventListener('focus',function(){if(state.user)pull();checkRelease()});
    setInterval(function(){if(state.user)pull()},15000);
    setInterval(checkRelease,120000);
    checkRelease();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCloud);else initCloud();
})();
