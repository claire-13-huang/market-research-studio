function mrsPlain(s){return String(s||'').replace(/<[^>]*>/g,'').replace(/\*\*|__|`/g,'').replace(/\s+/g,' ').trim()}

function mrsShort(s,max=100){s=mrsPlain(s).replace(/^[-*•]\s*/,'');return s.length>max?s.slice(0,max-1).replace(/[,，\s]+$/,'')+'…':s}

function mrsReportParse(text){
  const sections={demand:[],price:[],profit:[],risk:[],decision:[],steps:[]};let part='';const lines=String(text||'').replace(/\r/g,'').split('\n');let steps=[];
  for(const original of lines){let raw=mrsPlain(original);if(!raw||raw.startsWith('|'))continue;
    const bullet=/^\s*[-*•]\s+/.test(original);
    let line=raw.replace(/^#{1,6}\s*/,'').replace(/^[一二三四五六七八九十][、.．]\s*/,'').replace(/^\d{1,2}[、.)．]\s*/,'').replace(/^[-*•]\s*/,'');
    const header=/^#{1,6}\s*|^[一二三四五六七八九十][、.．]|^\d{1,2}[、.)．]|^(?:综合判断|核心结论|最终建议|市场需求|价格接受度|盈利能力|最终选品建议|下一步)[：:]/.test(raw);
    if(header&&!bullet){const name=line;if(/综合判断|核心结论|最终建议|最终选品建议|初步判断/.test(name))part='decision';else if(/市场需求|市场规模|市场体量/.test(name))part='demand';else if(/价格接受度|定价|售价策略/.test(name))part='price';else if(/盈利能力|利润测算|财务分析/.test(name))part='profit';else if(/风险|数据缺口|局限性/.test(name))part='risk';else if(/下一步|执行计划|行动建议/.test(name))part='steps';else part='';
      const colon=line.search(/[：:]/);const after=colon>=0&&colon<25?line.slice(colon+1).trim():'';if(part&&after)sections[part].push(after);continue;
    }
    if(part){sections[part].push(line);if(bullet&&(part==='steps'||part==='decision'))steps.push(mrsShort(line.replace(/^(市场条件|定价条件|盈利条件)[：:]\s*/,''),90));}
  }
  let decision='待人工确认';const top=mrsPlain(text).slice(0,1200);
  if(/不建议进入|建议放弃|不值得进入/.test(top))decision='不建议进入';else if(/有条件进入|小批量试销|小规模验证|小规模试销|小批量测试/.test(top))decision='有条件进入';else if(/建议暂缓|暂缓进入|暂不进入/.test(top))decision='暂缓进入';else if(/建议进入|值得进入/.test(top))decision='建议进入';
  const first=(key)=>{const a=sections[key].filter(x=>x.length>6&&!/^(指标|测算结果)/.test(x));return a.length?mrsShort(a[0].split(/(?<=[。！？；])/u)[0]):''};
  const allSteps=[...steps,...sections.steps,...sections.decision.filter(x=>/核实|测试|验证|观察|确认/.test(x))].map(x=>mrsShort(x,90)).filter(x=>x.length>8&&!/优先确认三个条件/.test(x));
  const unique=[...new Set(allSteps)].slice(0,3);
  return {decision,headline:first('decision')||'请核对原文，确认是否适合进入市场。',demand:first('demand'),price:first('price'),profit:first('profit'),risk:first('risk'),steps:unique,extractedAt:new Date().toISOString(),method:'浏览器规则提取'};
}

function mrsConclusionView(p){
  const exists=Boolean((p.report||'').trim()),b=p.reportBoard||(exists?mrsReportParse(p.report):null);
  const sku=p.skus.find(x=>x.id===activeSkuId)||p.skus[0],core=compValid(p).filter(c=>riskTier(c)==='core'),fig=sku?profit(sku):null;
  const four=[['市场需求',b?.demand],['价格接受度',b?.price],['盈利能力',b?.profit],['主要风险',b?.risk]];
  const metrics=[['核心竞品',`${core.length} 条`],['核心价格中位数',core.length?money(median(core.map(c=>c.price))):'缺少数据'],['当前 SKU 售价',sku?money(sku.price):'待填写'],['单件利润 / 利润率',fig?money(fig.profit)+' / '+rnd(fig.margin,1)+'%':'待填写']];
  const stages=['有条件进入','建议进入','暂缓进入','不建议进入','待人工确认'];
  return `${heading('市场调研结论','ChatGPT 分析 → 粘贴/上传 → 自动提取可视化摘要 → 人工确认。无需 AI API。',`<button class="btn" data-action="generate-report">生成规则分析草稿</button>`)}
  <div class="mrs-steps"><span>① 用 ChatGPT 写分析</span><span>② 粘贴或上传结论</span><span>③ 一键生成决策卡片</span><span>④ 核对后保存版本</span></div>
  ${b?`<section class="mrs-decision"><div class="mrs-micro">最终判断 · 来源于你的报告，而非自动市场预测</div><div class="mrs-decision-title">${safe(b.decision)}</div><p>${safe(b.headline)}</p></section>
  <div class="mrs-summaries">${four.map(([title,body])=>`<div class="mrs-summary"><small>${safe(title)}</small><p>${safe(body||'原文未明确说明，请补充并重新生成。')}</p></div>`).join('')}</div>
  <h3 class="mrs-section-title">关键数据 <small>直接读取当前竞品与利润实验室，非粘贴文本里的旧值</small></h3>
  <div class="mrs-metrics">${metrics.map(([title,value])=>`<div class="mrs-stat"><span>${safe(title)}</span><strong>${safe(value)}</strong></div>`).join('')}</div>
  <div class="mrs-panels"><div class="card"><h3>下一步优先行动</h3>${b.steps?.length?`<ol>${b.steps.map(t=>`<li>${safe(t)}</li>`).join('')}</ol>`:'<p class="sub">原文未提取到具体行动；请在报告末尾补充测试和验证步骤。</p>'}</div><div class="card"><h3>结论可靠性提醒</h3><p>目标售价和利润率来自当前费用假设；年化销量不等于过去12个月真实销售；疑似共享销量需要核实。</p><p>这份卡片是<strong>规则摘要</strong>，不是二次 AI 分析。</p></div></div>
  <details class="mrs-manual"><summary>人工复核与修改卡片</summary><div class="card"><label>决策标签</label><select id="mrsDecision">${stages.map(x=>`<option ${x===b.decision?'selected':''}>${x}</option>`).join('')}</select><label>一句话结论</label><textarea rows="2" data-mrs="headline">${safe(b.headline)}</textarea><div class="mrs-manual-fields">${[['demand','市场需求'],['price','价格接受度'],['profit','盈利能力'],['risk','主要风险']].map(([key,title])=>`<div><label>${title}</label><textarea rows="3" data-mrs="${key}">${safe(b[key]||'')}</textarea></div>`).join('')}</div><label>下一步：每行一条</label><textarea id="mrsTasks" rows="4">${safe((b.steps||[]).join('\n'))}</textarea><button class="btn primary" data-action="mrs-save-cards">保存卡片修改</button></div></details>`:`<div class="card mrs-empty"><h2>把长篇市场报告变成一页结论</h2><p>粘贴 ChatGPT 的结构化分析，或导入文本文件。不调用 AI API。</p></div>`}
  <details class="mrs-source" ${exists?'':'open'}><summary>完整结论原文 · ${exists?'点击展开编辑':'点击开始粘贴或上传'}</summary><div class="card"><label class="btn" for="mrsFile">上传 TXT / MD / DOCX</label><input type="file" id="mrsFile" accept=".txt,.md,.docx" hidden><p class="mrs-hint">文件在本地浏览器读取，不会提交给 AI 服务。</p><textarea id="mrsText" rows="11" placeholder="在这里粘贴从 ChatGPT 获得的市场调研结论……">${safe(p.report||'')}</textarea><button class="btn primary" data-action="mrs-create-board">保存原文并生成可视化结论</button></div></details>
  <p class="mrs-hint">所有内容保存在当前浏览器；生成后请人工核对，并使用右上角「保存版本」及「导出项目」备份。</p>`;
}

function mrsOnClick(e){
  const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;if(!['mrs-create-board','mrs-save-cards'].includes(action))return;
  const p=project();if(!p)return;
  if(action==='mrs-create-board'){const text=$('#mrsText')?.value||'';if(text.trim().length<15){toast('请先粘贴至少15字的调研结论');return;}p.report=text;p.reportBoard=mrsReportParse(text);save();render();toast('结论卡片已生成');return;}
  if(action==='mrs-save-cards'){p.reportBoard=p.reportBoard||mrsReportParse(p.report);p.reportBoard.decision=$('#mrsDecision')?.value||'待人工确认';document.querySelectorAll('[data-mrs]').forEach(item=>{p.reportBoard[item.dataset.mrs]=item.value.trim().slice(0,400)});p.reportBoard.steps=($('#mrsTasks')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3);save();render();toast('卡片内容已保存');}
}

async function mrsOnFile(e){
  const t=e.target;if(t.id!=='mrsFile'||!t.files?.[0])return;const f=t.files[0];if(f.size>2*1024*1024){toast('最大支持2MB的结论文件');return;}
  const p=project();if(!p)return;if(p.report&&!confirm('新文件将替换当前结论。旧的正式版本仍保留，确认继续？'))return;
  try {const ext=f.name.split('.').pop().toLowerCase();let content='';if(ext==='docx'){if(!window.mammoth)throw Error('Word 解析库未加载，请联网刷新或直接粘贴文字');content=(await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value;}else if(ext==='md'||ext==='txt')content=await f.text();else throw Error('仅支持 TXT、MD、DOCX');if(content.trim().length<15)throw Error('文件内容不足15字');p.report=content;p.reportBoard=mrsReportParse(content);save();render();toast('文件已解析，决策卡片已更新');}catch(err){toast('读取失败：'+err.message);}
}

function mrsInstall(){
  const css=`.mrs-steps{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.mrs-steps span{background:#edf3ff;border:1px solid #dce6f6;border-radius:10px;padding:8px 11px;font-size:12px;color:#567095}.mrs-decision{background:#eef5ff;border:1px solid #d8e5f8;border-radius:17px;padding:23px;margin:16px 0}.mrs-micro{font-size:11px;color:#6f829d;font-weight:700}.mrs-decision-title{font-size:27px;font-weight:850;color:#1f3760;margin:9px 0}.mrs-decision p{font-size:14px;color:#536b88;margin:0;line-height:1.7}.mrs-summaries,.mrs-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:15px 0}.mrs-summary,.mrs-stat{background:white;border:1px solid #e1e8f3;border-radius:14px;padding:18px;min-height:110px}.mrs-summary small,.mrs-stat span{color:#6a7e9e;font-weight:700;font-size:12px}.mrs-summary p{color:#2d405e;font-size:13px;line-height:1.7;margin:12px 0 0}.mrs-stat{display:flex;flex-direction:column;gap:12px}.mrs-stat strong{font-size:21px;color:#1b3152}.mrs-section-title{font-size:15px;margin:26px 0 12px}.mrs-section-title small{font-size:11px;color:#8393ab;font-weight:400;margin-left:9px}.mrs-panels{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.mrs-panels h3{font-size:15px;margin:0 0 12px}.mrs-panels p,.mrs-panels li{font-size:13px;line-height:1.85;color:#536780}.mrs-panels ol{padding-left:19px}.mrs-manual,.mrs-source{background:#fff;border:1px solid #e2e9f2;border-radius:13px;margin:17px 0;overflow:hidden}.mrs-manual summary,.mrs-source summary{cursor:pointer;padding:16px 19px;font-size:13px;font-weight:750;color:#344b71}.mrs-manual .card,.mrs-source .card{border:0;box-shadow:none;border-top:1px solid #eef1f6}.mrs-manual label{display:block;margin:9px 0 5px;color:#53688c;font-size:12px}.mrs-manual textarea,.mrs-source textarea,.mrs-manual select{display:block;box-sizing:border-box;width:100%;border:1px solid #dce5f1;border-radius:10px;padding:12px;color:#314766;font:inherit;line-height:1.6;font-size:13px;margin-bottom:13px}.mrs-manual-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mrs-source .btn{margin:6px 0;cursor:pointer;display:inline-block}.mrs-hint{font-size:11px;color:#8b9bb1;line-height:1.7}.mrs-empty{padding:29px}.mrs-empty h2{margin:0 0 8px;font-size:20px}.mrs-empty p{font-size:13px;color:#667c9b}.mrs-source textarea{margin:12px 0;min-height:210px}.mrs-manual button,.mrs-source button{display:block;margin-left:auto}@media(max-width:1250px){.mrs-summaries,.mrs-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:780px){.mrs-summaries,.mrs-metrics,.mrs-panels,.mrs-manual-fields{grid-template-columns:1fr}}@media print{.mrs-source,.mrs-manual,.mrs-steps,.mrs-hint{display:none!important}}`;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);window.renderReport=mrsConclusionView;document.addEventListener('click',mrsOnClick);document.addEventListener('change',mrsOnFile);
}

mrsInstall();
