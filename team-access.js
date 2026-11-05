/* Market Research Studio V0.6 — admin console, enabled only after team-access-v06.sql and admin bootstrap. */
(function () {
  'use strict';
  var state = {client:null,user:null,admin:false,member:null,available:false,refreshing:false,message:''};
  var $ = function(q){return document.querySelector(q)};
  var esc = function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  function context(){return typeof window.MRS_CLOUD_CONTEXT==='function'?window.MRS_CLOUD_CONTEXT():{}}
  function online(){return !!(state.client&&state.user)}
  function isAdmin(){return state.admin}
  function canShare(){return state.admin||state.member?.status==='active'&&state.member?.can_share===true}
  function canCreate(){return state.admin||state.member?.status==='active'&&state.member?.can_create===true}
  window.MRS_TEAM={isAdmin:isAdmin,canShare:canShare,canCreate:canCreate,status:function(){return state.member?.status||'pending'},refresh:refresh};

  function addUI(){
    if($('#teamAccessBtn'))return;
    var target=$('#cloudButton')||$('#btnExport');if(!target)return;
    var button=document.createElement('button');
    button.id='teamAccessBtn';button.className='btn ghost';button.textContent='团队管理';
    button.onclick=show;
    target.parentNode.insertBefore(button,target.nextSibling);
    var style=document.createElement('style');
    style.textContent='.mrs-team-backdrop{position:fixed;inset:0;background:#10182b99;z-index:10030;display:flex;align-items:center;justify-content:center;padding:18px}.mrs-team-card{background:white;border-radius:18px;color:#1c2940;width:min(860px,100%);max-height:90vh;overflow:auto;padding:26px;box-shadow:0 16px 75px #09132260}.mrs-team-card h2{font-size:24px;margin:0 0 6px}.mrs-team-card h3{font-size:16px;margin:24px 0 10px}.mrs-team-card p,.mrs-team-card small{color:#64748b}.mrs-team-card table{width:100%;border-collapse:collapse;font-size:13px}.mrs-team-card td,.mrs-team-card th{padding:10px 7px;text-align:left;border-bottom:1px solid #e9edf5}.mrs-team-card button{padding:7px 11px;border:1px solid #cfdbed;background:#f8faff;border-radius:9px;cursor:pointer;margin:2px}.mrs-team-card button.primary{background:#2865d9;color:white;border-color:#2865d9}.mrs-team-card button:disabled{opacity:.55}.mrs-team-line{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}.mrs-team-muted{font-size:12px;color:#718096}.mrs-team-gate{position:fixed;inset:0;z-index:9980;background:#f6f8fc;display:flex;align-items:center;justify-content:center;padding:20px}.mrs-team-gate-inner{max-width:520px;width:100%;padding:34px;background:#fff;border:1px solid #e1e9f6;border-radius:18px;box-shadow:0 14px 60px #11214418;text-align:center}.mrs-team-gate-inner button{padding:11px 18px;border:none;border-radius:9px;background:#2865d9;color:#fff;cursor:pointer}.mrs-team-notice{padding:12px;border-radius:10px;background:#edf3ff;color:#23416b;font-size:13px;margin:12px 0}';
    document.head.appendChild(style);
    document.addEventListener('click',function(ev){
      var item=ev.target.closest('[data-action="new-project"]');
      if(item&&state.available&&online()&&!canCreate()){
        ev.preventDefault();ev.stopImmediatePropagation();
        alert('当前账号尚未获得创建项目权限，请联系管理员。');
      }
    },true);
    document.addEventListener('click',function(ev){var a=ev.target.closest('[data-team-action]');if(a)act(a.dataset.teamAction,a)},false);
  }
  function notice(msg){state.message=msg}
  function showGate(){
    var gate=$('#mrsTeamGate');var need=!online()||!state.admin&&state.member?.status!=='active';
    if(!need){gate?.remove();return}
    if(!gate){gate=document.createElement('div');gate.id='mrsTeamGate';gate.className='mrs-team-gate';document.body.appendChild(gate)}
    var logged=online();
    gate.innerHTML='<div class="mrs-team-gate-inner"><h2>'+ (logged?'账号等待管理员审批':'登录 Market Research Studio')+'</h2>'+
      '<p>'+(logged?'当前邮箱：'+esc(state.user.email)+'。管理员批准后，你就能创建或查看工作空间里的授权项目。':'请先使用自己的工作邮箱登录。你在这个团队工作空间创建的调研项目，管理员可以查看和管理其访问权限。')+'</p>'+
      '<div class="mrs-team-notice">调研草稿与项目属于团队工作内容。管理员可以查看项目数据，但不能读取你的私人邮箱或其他无关账户信息。</div>'+
      '<button data-team-action="'+(logged?'retry':'login')+'">'+(logged?'重新检查授权状态':'邮箱登录')+'</button></div>';
  }
  function dialog(html){
    var host=$('#mrsTeamDialog');
    if(!host){host=document.createElement('div');host.id='mrsTeamDialog';host.className='mrs-team-backdrop';document.body.appendChild(host)}
    host.innerHTML='<section class="mrs-team-card" role="dialog" aria-modal="true"><div class="mrs-team-line"><h2>团队权限管理</h2><button data-team-action="close">关闭</button></div>'+html+'</section>';
  }
  async function logLogin(){
    if(!online())return;
    var marker='mrs-team-login-event-'+state.user.id;
    if(sessionStorage.getItem(marker))return;
    var r=await state.client.from('mrs_team_events').insert({user_id:state.user.id,action:'login'});
    if(!r.error)sessionStorage.setItem(marker,'1');
  }
  async function refresh(){
    if(state.refreshing)return;
    var ctx=context();state.client=ctx.client||null;state.user=ctx.user||null;
    if(!state.client)return;
    state.refreshing=true;
    try{
      if(!state.user){state.admin=false;state.member=null;addUI();showGate();setButton();return}
      var r=await Promise.all([
        state.client.from('mrs_team_admins').select('user_id').eq('user_id',state.user.id).maybeSingle(),
        state.client.from('mrs_team_members').select('user_id,email,status,can_create,can_share').eq('user_id',state.user.id).maybeSingle()
      ]);
      if(r[0].error||r[1].error){state.available=false;notice('权限表未就绪：请先执行 team-access-v06.sql');return}
      var previousAdmin=state.admin,previousStatus=state.member?.status;
      state.available=true;state.admin=!!r[0].data;state.member=r[1].data||null;
      addUI();showGate();setButton();
      if((previousAdmin!==state.admin||previousStatus!==state.member?.status)&&typeof window.render==='function')window.render();
      await logLogin();
    }catch(e){notice('权限读取失败：'+e.message)}
    finally{state.refreshing=false}
  }
  async function setButton(){
    var b=$('#teamAccessBtn');if(!b)return;
    if(!state.user){b.textContent='登录 / 团队管理';return}
    if(state.admin){
      var r=await Promise.all([
        state.client.from('mrs_team_members').select('user_id',{count:'exact',head:true}).eq('status','pending'),
        state.client.from('mrs_permission_requests').select('id',{count:'exact',head:true}).eq('status','pending')
      ]);
      var count=(r[0].count||0)+(r[1].count||0);
      b.textContent='管理员中心'+(count?' ('+count+'待审批)':'');return;
    }
    b.textContent=state.member?.status==='active'?(canShare()?'团队成员 · 可共享':'团队成员 · 申请分享'):'账号待审批';
  }
  async function show(){
    await refresh();
    if(!state.available){dialog('<div class="mrs-team-notice">团队数据库尚未启用。请先按 TEAM-ACCESS-SETUP.md 运行 SQL 并初始化管理员账号。</div>');return}
    if(!online()){dialog('<p>请先通过右上角「团队同步」使用邮箱登录。</p><button data-team-action="login">打开邮箱登录</button>');return}
    if(state.admin)return showAdmin();
    return showMember();
  }
  async function showMember(){
    var member=state.member;
    if(!member){dialog('<p>账号资料暂未同步，请刷新。</p>');return}
    var status=member.status==='active'?'已通过':member.status==='pending'?'待审批':'已暂停';
    var html='<p>当前邮箱：<b>'+esc(state.user.email)+'</b> · '+status+'</p>'+
      '<div class="mrs-team-notice">创建项目：'+(canCreate()?'已允许':'未允许')+'；分享项目：'+(canShare()?'已允许':'需管理员授权')+'。管理员可查看团队工作项目。</div>';
    if(member.status==='active'&&!canShare())html+='<button class="primary" data-team-action="request-share">申请对外分享权限</button>';
    html+='<button data-team-action="retry">刷新权限状态</button>';
    dialog(html);
  }
  async function showAdmin(){
    dialog('<p>正在加载成员与审批列表…</p>');
    var [members,requests,events,projects]=await Promise.all([
      state.client.from('mrs_team_members').select('user_id,email,status,can_create,can_share,joined_at').order('joined_at',{ascending:false}),
      state.client.from('mrs_permission_requests').select('id,user_id,request_type,note,status,requested_at').eq('status','pending').order('requested_at',{ascending:true}),
      state.client.from('mrs_team_events').select('user_id,action,created_at').order('created_at',{ascending:false}).limit(15),
      state.client.from('mrs_projects').select('id,name,owner_id,revision,updated_at').order('updated_at',{ascending:false}).limit(100)
    ]);
    var err=[members,requests,events,projects].find(function(r){return r.error});
    if(err){dialog('<p>管理员数据读取失败：'+esc(err.error.message)+'</p>');return}
    var emails={};members.data.forEach(function(m){emails[m.user_id]=m.email});
    var html='<p>主账号：'+esc(state.user.email)+'。管理员能查看团队项目、批准新成员、控制创建和分享权限。</p>';
    if(state.message)html+='<div class="mrs-team-notice">'+esc(state.message)+'</div>';
    html+='<h3>成员审批与权限 ('+members.data.length+')</h3><table><thead><tr><th>邮箱</th><th>状态</th><th>创建项目</th><th>分享项目</th><th>管理操作</th></tr></thead><tbody>';
    members.data.filter(function(m){return m.user_id!==state.user.id}).forEach(function(m){
      html+='<tr><td>'+esc(m.email)+'</td><td>'+esc(m.status)+'</td><td>'+(m.can_create?'允许':'未允许')+'</td><td>'+(m.can_share?'允许':'未允许')+'</td><td>';
      if(m.status!=='active')html+='<button class="primary" data-team-action="approve-member" data-id="'+esc(m.user_id)+'">批准进入</button>';
      if(m.status!=='suspended')html+='<button data-team-action="suspend-member" data-id="'+esc(m.user_id)+'">暂停</button>';
      if(m.status==='active'){
        html+='<button data-team-action="toggle-create" data-id="'+esc(m.user_id)+'" data-value="'+(!m.can_create)+'">'+(m.can_create?'关闭创建':'开启创建')+'</button>';
        html+='<button data-team-action="toggle-share" data-id="'+esc(m.user_id)+'" data-value="'+(!m.can_share)+'">'+(m.can_share?'关闭分享':'开启分享')+'</button>';
      }
      html+='</td></tr>';
    });
    html+='</tbody></table>';
    html+='<h3>成员申请 ('+requests.data.length+')</h3>';
    if(!requests.data.length)html+='<p>暂无待审批请求。</p>';
    requests.data.forEach(function(q){
      html+='<div class="mrs-team-line" style="padding:10px;border-bottom:1px solid #e9edf5"><span>'+esc(emails[q.user_id]||q.user_id)+' 申请共享权限</span><span><button class="primary" data-team-action="approve-request" data-user="'+esc(q.user_id)+'" data-id="'+esc(q.id)+'">批准</button><button data-team-action="reject-request" data-id="'+esc(q.id)+'">拒绝</button></span></div>';
    });
    html+='<h3>团队项目 ('+projects.data.length+')</h3>';
    if(!projects.data.length)html+='<p>暂无云端项目。</p>';
    projects.data.forEach(function(p){
      html+='<div class="mrs-team-line" style="padding:10px;border-bottom:1px solid #e9edf5"><span><b>'+esc(p.name)+'</b><br><small>创建者：'+esc(emails[p.owner_id]||p.owner_id)+' · V'+esc(p.revision)+'</small></span><button data-team-action="open-project" data-id="'+esc(p.id)+'">查看项目</button></div>';
    });
    html+='<h3>最近登录与操作</h3>';
    events.data.forEach(function(e){
      html+='<div class="mrs-team-line" style="font-size:13px;padding:5px 0"><span>'+esc(emails[e.user_id]||e.user_id)+' · '+esc(e.action)+'</span><small>'+esc(new Date(e.created_at).toLocaleString('zh-CN'))+'</small></div>';
    });
    html+='<div style="margin-top:20px"><button class="primary" data-team-action="refresh-admin">刷新数据</button></div>';
    dialog(html);
  }
  async function act(name,button){
    var id=button.dataset.id;
    if(name==='close'){$('#mrsTeamDialog')?.remove();return}
    if(name==='login'){$('#mrsTeamDialog')?.remove();$('#cloudButton')?.click();return}
    if(name==='retry'){await refresh();show();return}
    if(name==='refresh-admin'){await showAdmin();return}
    if(name==='open-project'){
      var u=new URL(location.href);u.searchParams.set('shared_project',id);location.assign(u.toString());return;
    }
    if(!online())return;
    button.disabled=true;
    try{
      var r,now=new Date().toISOString();
      if(name==='request-share'){
        r=await state.client.from('mrs_permission_requests').insert({user_id:state.user.id,request_type:'share',note:'请求授权向同事共享调研项目'});
        notice(r.error?('申请失败（可能已有待审批申请）：'+r.error.message):'申请已提交，等待管理员审批');
        await showMember();return;
      }
      if(!state.admin)return;
      if(name==='approve-member')r=await state.client.from('mrs_team_members').update({status:'active',can_create:true,updated_at:now}).eq('user_id',id);
      if(name==='suspend-member')r=await state.client.from('mrs_team_members').update({status:'suspended',can_create:false,can_share:false,updated_at:now}).eq('user_id',id);
      if(name==='toggle-create')r=await state.client.from('mrs_team_members').update({can_create:button.dataset.value==='true',updated_at:now}).eq('user_id',id);
      if(name==='toggle-share')r=await state.client.from('mrs_team_members').update({can_share:button.dataset.value==='true',updated_at:now}).eq('user_id',id);
      if(name==='approve-request'){
        r=await state.client.from('mrs_team_members').update({can_share:true,updated_at:now}).eq('user_id',button.dataset.user).eq('status','active');
        if(!r.error)r=await state.client.from('mrs_permission_requests').update({status:'approved',reviewed_by:state.user.id,reviewed_at:now}).eq('id',id);
      }
      if(name==='reject-request')r=await state.client.from('mrs_permission_requests').update({status:'rejected',reviewed_by:state.user.id,reviewed_at:now}).eq('id',id);
      notice(r?.error?('操作失败：'+r.error.message):'权限已更新');
      await showAdmin();
    }finally{button.disabled=false;setButton()}
  }
  window.addEventListener('mrs:auth-change',function(){refresh()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(refresh,250)});
  else setTimeout(refresh,250);
  setInterval(refresh,15000);
})();
