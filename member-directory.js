/* Market Research Studio V0.8.1 - member directory; actionable share error diagnostics */
(function () {
  'use strict';
  const state = {client:null,user:null,ready:false,profile:null,migrated:false,checking:false, lastError:''};
  const $ = q => document.querySelector(q);
  const h = value => String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isAdmin = () => !!window.MRS_TEAM?.isAdmin?.();
  const canShare = () => !!window.MRS_TEAM?.canShare?.();
  const currentProject = () => window.MRS_CLOUD_CONTEXT?.().project||null;
  const notify = s => {state.lastError=s; const n=$('#mrsDirectoryStatus');if(n)n.textContent=s};

  function injectStyles(){
    if($('#mrsDirectoryStyles'))return;
    const el=document.createElement('style');el.id='mrsDirectoryStyles';
    el.textContent='.mrs-dir-overlay{position:fixed;inset:0;z-index:10070;background:#132143a8;display:flex;justify-content:center;align-items:center;padding:18px}.mrs-dir-card{background:white;color:#19263e;border-radius:18px;width:min(710px,100%);max-height:90vh;overflow:auto;padding:28px;box-shadow:0 15px 65px #111d3955}.mrs-dir-card h2{margin:0 0 8px;font-size:23px}.mrs-dir-card p,.mrs-dir-card small{font-size:13px;color:#6b7d97;line-height:1.6}.mrs-dir-card button{border:1px solid #cbd7ed;border-radius:8px;padding:10px 14px;background:#f8fbff;margin:3px;cursor:pointer}.mrs-dir-card button.primary{background:#3169d8;color:white;border-color:#3169d8}.mrs-dir-card input[type=text]{width:100%;border:1px solid #bfcde4;border-radius:9px;padding:12px;margin:8px 0;font-size:15px}.mrs-dir-option{display:flex;align-items:center;gap:12px;padding:11px 8px;border-bottom:1px solid #e8effa;cursor:pointer}.mrs-dir-option input{width:19px;height:19px}.mrs-dir-option strong{font-size:14px}.mrs-dir-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}.mrs-dir-alert{background:#eff5ff;color:#254b7f;border-radius:10px;padding:12px;margin:10px 0;font-size:13px}.mrs-dir-error{color:#a32d39;margin:8px 0}.mrs-dir-small{color:#667b96;font-size:12px}.mrs-dir-list{max-height:320px;overflow:auto;margin-top:10px;border:1px solid #e4eaf4;border-radius:12px}';
    document.head.appendChild(el);
  }
  function modal(inner){
    injectStyles();let box=$('#mrsDirectoryModal');
    if(!box){box=document.createElement('div');box.id='mrsDirectoryModal';box.className='mrs-dir-overlay';document.body.appendChild(box)}
    box.innerHTML='<section class="mrs-dir-card" role="dialog" aria-modal="true">'+inner+'</section>';
  }
  function closeModal(){ $('#mrsDirectoryModal')?.remove() }
  function addProfileButton(){
    if($('#mrsMyName')||!state.user)return;
    const target=$('#teamAccessBtn')||$('#cloudButton');if(!target)return;
    const b=document.createElement('button');b.id='mrsMyName';b.className='btn ghost';b.textContent='我的姓名';
    b.onclick=()=>openName(false);
    target.parentNode.insertBefore(b,target.nextSibling);
  }
  function openName(required){
    if(!state.migrated)return;
    let name=state.profile?.display_name||'';
    modal('<h2>'+(required?'首次登录，请填写你的姓名':'个人资料')+'</h2>'+
      '<p>当前已验证邮箱：<b>'+h(state.user.email)+'</b><br>姓名会显示在团队成员列表与分享选择器里；邮箱只能通过登录账号验证，不能在这里修改。</p>'+
      '<label for="mrsNameInput">显示姓名（1-50个字符）</label>'+
      '<input id="mrsNameInput" type="text" maxlength="50" value="'+h(name)+'" placeholder="例如：小王 / Wang">'+
      '<div id="mrsDirectoryStatus" class="mrs-dir-error"></div>'+
      '<div class="mrs-dir-actions">'+(required?'':'<button data-dir="close">取消</button>')+
      '<button class="primary" data-dir="save-name">保存姓名</button></div>');
    $('#mrsNameInput')?.focus();
  }
  async function saveName(btn){
    const v=$('#mrsNameInput')?.value.trim();
    if(!v||v.length>50){notify('请输入1-50个字符的姓名');return}
    btn.disabled=true;
    const q=await state.client.from('mrs_member_profiles').update({display_name:v})
      .eq('user_id',state.user.id).select('user_id,display_name,email,status').single();
    btn.disabled=false;
    if(q.error){notify('保存失败：'+q.error.message);return}
    state.profile=q.data;closeModal();updateButton();
  }
  function updateButton(){
    const b=$('#mrsMyName');if(b)b.textContent='我的姓名：'+(state.profile?.display_name||'待设置');
  }
  async function check(){
    const ctx=window.MRS_CLOUD_CONTEXT?.()||{};
    if(state.checking||!ctx.client)return;
    state.client=ctx.client;
    const u=ctx.user||null;
    if(!u){state.user=null;state.profile=null;$('#mrsMyName')?.remove();closeModal();return}
    state.user=u;state.checking=true;
    try{
      const r=await Promise.all([
        state.client.from('mrs_member_profiles').select('user_id,email,display_name,status').eq('user_id',u.id).maybeSingle(),
        state.client.from('mrs_project_shares').select('project_id').limit(1)
      ]);
      if(r.some(x=>x.error)){state.migrated=false;state.lastError='团队通讯录尚未开通：请先执行数据库 V0.7 升级脚本';return}
      state.migrated=true;state.profile=r[0].data;addProfileButton();updateButton();
      if(state.profile&&!state.profile.display_name?.trim()&&!$('#mrsDirectoryModal'))openName(true);
    } catch(e){state.lastError='读取成员资料失败：'+e.message}
    finally{state.checking=false}
  }
  function rowsList(rows,selected){
    return rows.map(x=>'<label class="mrs-dir-option">'+
       '<input type="checkbox" class="mrs-dir-target" value="'+h(x.user_id)+'" '+(selected.has(x.user_id)?'checked':'')+'>'+
       '<span><strong>'+h(x.display_name?.trim()||'未设置姓名')+'</strong><br>'+
       '<small>'+h(x.email)+'</small></span></label>').join('');
  }
  async function openSharePicker(){
    const ctx=window.MRS_CLOUD_CONTEXT?.()||{};
    const p=ctx.project;
    if(!state.migrated){modal('<h2>通讯录尚未启用</h2><p>'+h(state.lastError||'先执行数据库 V0.7 升级脚本')+'</p><button data-dir="close">关闭</button>');return}
    if(!p?.__cloud){modal('<h2>先保存到云端</h2><p>当前项目还没有发布到云端，请先在团队同步中发布项目。</p><button data-dir="close">关闭</button>');return}
    if(!(canShare()&&(p.__cloud.ownerId===state.user.id||isAdmin()))){
      modal('<h2>分享权限待审批</h2><p>只有项目创建者或管理员能够分享；普通成员需要先从管理员中心申请分享权限。</p><button data-dir="close">关闭</button>');return;
    }
    modal('<h2>选择要共享的团队成员</h2><p>正在获取已登录并获批准的成员…</p>');
    const [people,shares]=await Promise.all([
      state.client.from('mrs_member_profiles').select('user_id,email,display_name,status').eq('status','active').order('display_name',{ascending:true}),
      state.client.from('mrs_project_shares').select('project_id,recipient_id,granted_by').eq('project_id',p.__cloud.id)
    ]);
    if(people.error||shares.error){
      modal('<h2>读取失败</h2><p class="mrs-dir-error">'+h(people.error?.message||shares.error?.message)+'</p><button data-dir="close">关闭</button>');return;
    }
    const rows=people.data.filter(m=>m.user_id!==state.user.id);
    const selected=new Set(shares.data.map(s=>s.recipient_id));
    if(!rows.length){
      modal('<h2>暂无可共享的团队成员</h2><p>其他同事需要先登录一次网站，由管理员批准进入，并设置姓名，之后才会显示在这里。</p><button data-dir="close">关闭</button>');return;
    }
    state.picker={projectId:p.__cloud.id,selected:Array.from(selected)};
    modal('<h2>共享给团队成员</h2>'+
      '<p>项目：<b>'+h(p.name)+'</b>。选择一人或多人；只有被勾选的团队账号可以查看。撤销勾选后将取消其访问权限（旧版邮箱邀请除外）。</p>'+
      '<div class="mrs-dir-alert">成员姓名来自本人设置，邮箱来自 Supabase 登录认证。不会向未注册或待审批邮箱发送文件。</div>'+
      '<label class="mrs-dir-option"><input type="checkbox" id="mrsDirSelectAll">全选当前成员</label>'+
      '<div class="mrs-dir-list">'+rowsList(rows,selected)+'</div>'+
      '<p id="mrsDirSelected">'+selected.size+' 人已选</p><div id="mrsDirectoryStatus" class="mrs-dir-error"></div>'+
      '<div class="mrs-dir-actions"><button data-dir="close">取消</button>'+
      '<button class="primary" data-dir="save-shares">保存共享名单</button></div>');
    updateCount();
  }
  function updateCount(){
    const all=[...document.querySelectorAll('.mrs-dir-target')];
    const num=all.filter(x=>x.checked).length;
    if($('#mrsDirSelected'))$('#mrsDirSelected').textContent='已选 '+num+' 人 / 当前可选 '+all.length+' 人';
    if($('#mrsDirSelectAll')){ $('#mrsDirSelectAll').checked=all.length>0&&num===all.length;$('#mrsDirSelectAll').indeterminate=num>0&&num<all.length }
  }
  async function saveShares(btn){
    const picker=state.picker;
    if(!picker){notify('请重新打开分享窗口');return}
    const target=[...document.querySelectorAll('.mrs-dir-target:checked')].map(x=>x.value);
    const prior=new Set(picker.selected);
    const selected=new Set(target);
    const add=target.filter(id=>!prior.has(id));
    const remove=picker.selected.filter(id=>!selected.has(id));
    btn.disabled=true;
    try{
      if(add.length){
        const payload=add.map(recipient_id=>({project_id:picker.projectId,recipient_id,granted_by:state.user.id}));
        const r=await state.client.from('mrs_project_shares').insert(payload);
        if(r.error)throw r.error;
      }
      if(remove.length){
        const r=await state.client.from('mrs_project_shares').delete().eq('project_id',picker.projectId).in('recipient_id',remove);
        if(r.error)throw r.error;
      }
      state.picker.selected=target;
      notify('共享名单已保存。已授权 '+target.length+' 位成员；他们刷新后即可查看最新云端项目。');
      const status=$('#mrsDirectoryStatus');if(status)status.style.color='#18815d';
      const box=$('#mrsDirSelected');if(box)box.textContent='已保存 · '+target.length+' 人';
    }catch(e){
      const detail=String(e?.message||e||'未知错误');
      if(/infinite recursion|42P17/i.test(detail)){
        notify('数据库权限循环（42P17）：V0.8.1 数据库修复脚本尚未执行。请在 Supabase SQL Editor 运行 supabase/fix-share-recursion-v081.sql，再重新打开共享名单保存。');
      }else if(/row.level.security|42501|permission denied/i.test(detail)){
        notify('权限被数据库拒绝：请确认你有分享权限、对方账号已被管理员批准，并检查 Supabase RLS。具体原因：'+detail);
      }else if(/duplicate key|23505/i.test(detail)){
        notify('部分成员已有授权，请关闭并重新打开名单核对，不会删除原授权。详情：'+detail);
      }else{
        notify('保存失败：'+detail+'。请重新打开名单，核对已成功授权的成员。');
      }
    }
    finally{btn.disabled=false}
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-dir]');if(!action)return;
    const name=action.dataset.dir;
    if(name==='close')closeModal();
    if(name==='save-name')saveName(action);
    if(name==='save-shares')saveShares(action);
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='mrsDirSelectAll'){
      document.querySelectorAll('.mrs-dir-target').forEach(x=>x.checked=event.target.checked);
      updateCount();
    }
    if(event.target.classList.contains('mrs-dir-target'))updateCount();
  });
  window.MRS_DIRECTORY={openSharePicker,openName:()=>openName(false),refresh:check};
  window.addEventListener('mrs:auth-change',()=>setTimeout(check,150));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(check,250));
  else setTimeout(check,250);
  setInterval(check,30000);
})();