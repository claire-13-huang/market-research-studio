/* v0.8.5 — pricing, ROI and executive decision views; does not mutate stored data. */
(function installDecisionUpgrade(){
  'use strict';
  const previousProfit = window.renderProfit;
  const scenarioMargins = [0,10,15,20];
  const rawNum = x => Number.isFinite(Number(x)) ? Number(x) : 0;
  const fmtPct = x => Number.isFinite(x) ? x.toFixed(2)+'%' : '—';
  const fmtCash = x => Number.isFinite(x) ? money(x) : '—';
  const ceilCent = x => Number.isFinite(x) ? Math.ceil((x-1e-9)*100)/100 : NaN;
  const roi = f => f.totalCost>0 ? f.profit/f.totalCost*100 : NaN;
  const validUnits = (x, fallback) => Math.max(1,Math.min(100000,Math.round(rawNum(x)||fallback)));
  const trialSizes = s => {
    const small=validUnits(s.pilotMin,50);
    return [small,Math.max(small,validUnits(s.pilotMax,100))];
  };
  const riskTag = f => f.profit < -0.004 ? '亏损' : f.margin < 0.05 ? '保本' : f.margin < 10 ? '微利' : f.margin < 15 ? '可试销' : '利润空间较好';
  const targetRows = s => [
    ...scenarioMargins.map(m=>({label:m===0?'保本价':m+'%目标',price:ceilCent(targetPrice(s,m)),target:m})),
    {label:'当前售价',price:rawNum(s.price),current:true}
  ];
  function targetTable(s,compact=false) {
    return `<div class="data-table-wrap"><table class="dm-table"><thead><tr><th>定价档位</th><th class="num">建议标价</th><th class="num">单件利润</th><th class="num">利润率</th><th class="num">经营 ROI</th>${compact?'':'<th>状态</th>'}</tr></thead><tbody>${targetRows(s).map(row=>{
      const f=profit(s,row.price);
      const ok=Number.isFinite(row.price);
      return `<tr class="${row.current?'dm-current':''}"><td>${row.label}</td><td class="num">${ok?money(row.price):'无法实现'}</td><td class="num ${f.profit<0?'u-red':'u-green'}">${ok?money(f.profit):'—'}</td><td class="num">${ok?fmtPct(f.margin):'—'}</td><td class="num">${ok?fmtPct(roi(f)):'—'}</td>${compact?'':`<td><span class="dm-state ${f.profit<0?'bad':f.margin<10?'warn':'good'}">${ok?riskTag(f):'无法实现'}</span></td>`}</tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function trialTable(s){
    const [sm,lg]=trialSizes(s);
    const f=profit(s),cashPerUnit=skuPurchaseUSD(s)+rawNum(s.freight);
    const rows=[sm,lg];
    return `<div class="dm-trial-controls"><label>最低试销件数 <input data-sku-field="pilotMin" type="number" min="1" max="100000" step="1" value="${sm}"></label><label>最高试销件数 <input data-sku-field="pilotMax" type="number" min="${sm}" max="100000" step="1" value="${lg}"></label><span>仅作备货情景；数量由负责人确认。</span></div>
    <div class="data-table-wrap"><table class="dm-table"><thead><tr><th>试销方案</th><th class="num">采购＋头程预付参考</th><th class="num">全部售罄的销售额</th><th class="num">全部售罄的贡献利润</th><th class="num">经营 ROI</th></tr></thead><tbody>${rows.map((qty,i)=>`<tr><td>${i?'较大批量':'较小批量'} · ${qty}件</td><td class="num">${fmtCash(cashPerUnit*qty)}</td><td class="num">${fmtCash(rawNum(s.price)*qty)}</td><td class="num ${f.profit>=0?'u-green':'u-red'}">${fmtCash(f.profit*qty)}</td><td class="num">${fmtPct(roi(f))}</td></tr>`).join('')}</tbody></table></div><p class="caption">预付参考只含采购和头程，不等于总资金占用；贡献利润已计当前广告、平台、FBA、仓储和退货预留，假设全部售出，不含未录入的固定费用与滞销损失。经营 ROI＝贡献利润÷全部已分摊成本。</p>`;
  }
  function adTable(s){
    const base=rawNum(s.ads);
    const ads=[base-10,base-5,base,base+5,base+10].filter((v,i,arr)=>v>=0&&v<=100&&arr.indexOf(v)===i);
    const rows=[...scenarioMargins.map(m=>({label:m===0?'保本档':`${m}%目标档`,price:ceilCent(targetPrice(s,m))})),{label:'当前售价',price:rawNum(s.price)}];
    return `<div class="data-table-wrap"><table class="dm-table dm-ad"><thead><tr><th>售价档位</th><th class="num">售价</th>${ads.map(a=>`<th class="num">广告 ${a}%${a===base?'（当前）':''}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${row.label}</td><td class="num">${fmtCash(row.price)}</td>${ads.map(ad=>{const f=profit(s,row.price,ad);return `<td class="dm-adcell ${f.profit<0?'negative':f.margin<10?'fragile':'positive'}"><strong>${Number.isFinite(row.price)?money(f.profit):'—'}</strong><small>${Number.isFinite(row.price)?fmtPct(f.margin):'—'} 利润率</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div><p class="caption">每格上方为单件贡献利润（USD），下方为销售利润率；售价与其他成本不变，仅改变广告占售价的比例。颜色仅表示模型结果，不代表市场需求已验证。</p>`;
  }
  const extraStyle = `.dm-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:14px 0 22px}.dm-stat{padding:18px 20px;background:#fff;border:1px solid #e3e9f3;border-radius:14px}.dm-stat span{color:#6d7d98;font-size:12px;font-weight:650;display:block}.dm-stat strong{font-size:25px;color:#22375a;display:block;margin:9px 0 6px;letter-spacing:-.5px}.dm-stat small{font-size:11px;color:#7185a0;line-height:1.5}.dm-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px}.dm-table th{color:#6c7c99;background:#f3f6fc;text-align:left;padding:14px 12px;font-weight:720}.dm-table td{border-bottom:1px solid #e8edf6;padding:14px 12px;color:#283954}.dm-table .num{text-align:right;font-variant-numeric:tabular-nums}.dm-current{background:#f1f6ff}.dm-state{display:inline-block;padding:4px 9px;border-radius:9px;background:#edf2fb;color:#4c6184;font-size:11px}.dm-state.good{background:#e9f6ed;color:#198052}.dm-state.warn{background:#fff3db;color:#946718}.dm-state.bad{background:#ffebea;color:#bc4d51}.dm-trial-controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px}.dm-trial-controls label{display:flex;gap:9px;align-items:center;color:#586c89;font-size:12px}.dm-trial-controls input{width:95px}.dm-trial-controls span{font-size:11px;color:#8996a9}.dm-adcell{text-align:right}.dm-adcell strong,.dm-adcell small{display:block}.dm-adcell small{font-size:10px;margin-top:4px}.dm-adcell.positive{background:#eaf5ed!important}.dm-adcell.fragile{background:#fff5e0!important}.dm-adcell.negative{background:#fee9e9!important}.dm-decision{background:#f2f6ff;border:1px solid #dee8f7;border-radius:14px;padding:22px;margin-bottom:20px}.dm-decision h2{font-size:26px;color:#203a64;margin:7px 0}.dm-decision small,.dm-decision p{color:#607694;font-size:12px;line-height:1.7}.dm-head{font-size:15px;font-weight:800;margin:22px 0 12px}.dm-report-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dm-brief-card{background:white;border:1px solid #e2e9f4;border-radius:13px;padding:18px}.dm-brief-card small{color:#7f91ab;font-size:11px}.dm-brief-card b{font-size:13px;color:#253d61;display:block;margin:7px 0}.dm-brief-card p{color:#536986;font-size:12px;line-height:1.7;margin:0}.dm-footnote{color:#7b8da8;font-size:11px;line-height:1.7;margin:12px 0}.dm-source{margin-top:24px}.dm-source summary{cursor:pointer;color:#607493;font-size:12px;font-weight:650}.dm-source textarea{display:block;width:100%;min-height:150px;line-height:1.7;margin:12px 0;font-size:12px}.dm-source .card{margin-top:12px}.dm-compact{margin:12px 0 0}.dm-report-table .dm-table th,.dm-report-table .dm-table td{padding:10px}.dm-report-toolbar{display:flex;gap:10px;justify-content:flex-end;margin:0 0 15px}@media(max-width:1000px){.dm-summary{grid-template-columns:1fr}.dm-report-grid{grid-template-columns:1fr}}@media print{.dm-source,.dm-report-toolbar,.dm-trial-controls{display:none!important}.dm-report-grid{grid-template-columns:1fr 1fr}.dm-brief-card,.dm-decision{break-inside:avoid}}`;
  const node=document.createElement('style');node.textContent=extraStyle;document.head.appendChild(node);
  window.renderProfit = function(p){
    let html=previousProfit(p);
    const s=p.skus.find(x=>x.id===activeSkuId)||p.skus[0];if(!s)return html;
    const f=profit(s),[small,large]=trialSizes(s);
    const capital=skuPurchaseUSD(s)+rawNum(s.freight);
    const cards=`<div class="dm-summary"><div class="dm-stat"><span>经营 ROI · 当前售价</span><strong>${fmtPct(roi(f))}</strong><small>单件贡献利润 ÷ 单件全部分摊成本</small></div><div class="dm-stat"><span>${small}件试销 · 采购＋头程预付参考</span><strong>${fmtCash(small*capital)}</strong><small>不含销售后扣费、其他预付款或滞销成本</small></div><div class="dm-stat"><span>${large}件试销 · 采购＋头程预付参考</span><strong>${fmtCash(large*capital)}</strong><small>备货数量仅作方案比较，须由负责人确认</small></div></div>`;
    html=html.replace('</div><section class="section">',`</div>${cards}<section class="section">`);
    const begin='<section class="section"><div class="card"><div class="row-head"><h3 class="section-title" style="margin:0">售价 × 广告率敏感性分析</h3>';
    const end='<section class="section"><h3 class="section-title">全部 SKU 成本和年度预测对比</h3>';
    const start=html.indexOf(begin),stop=html.indexOf(end,start+begin.length);
    if(start<0||stop<start)return html;
    const expanded=`<section class="section"><div class="card"><div class="row-head"><h3 class="section-title" style="margin:0">最低保本价 → 10% / 15% / 20%目标价</h3><span class="pill">按当前广告率 ${rawNum(s.ads)}% 计算</span></div>${targetTable(s)}<p class="caption">0% 为模型保本价；10% / 15% / 20% 为达到目标利润率所需的最低售价，不代表消费者可接受的最高价格。</p></div></section><section class="section"><div class="card"><h3 class="section-title">首批 50–100 件：资金与回报情景</h3>${trialTable(s)}</div></section><section class="section"><div class="card"><h3 class="section-title">售价 × 广告成本压力测试</h3>${adTable(s)}</div></section>`;
    return html.slice(0,start)+expanded+html.slice(stop);
  };
  function analysisValues(p) {
    const s=p.skus.find(x=>x.id===activeSkuId)||p.skus[0];
    const core=compValid(p).filter(c=>riskTier(c)==='core');
    const mid=core.length?median(core.map(x=>rawNum(x.price))):NaN;
    const b=p.reportBoard||(p.report&&typeof mrsReportParse==='function'?mrsReportParse(p.report):null);
    return {s,core,mid,b};
  }
  function briefText(p) {
    const {s,core,mid,b}=analysisValues(p);
    if(!s)return `${p.name}｜未录入 SKU`;
    const f=profit(s),[a,z]=trialSizes(s),capital=skuPurchaseUSD(s)+rawNum(s.freight);
    const name=p.name||s.name;
    const decision=b?.decision&&b.decision!=='待人工确认'?b.decision:'待主管确认';
    const lines=[
      `${name}｜Amazon US 新品决策简报`,
      `判断：${decision}；建议先按 ${a}–${z} 件方案比较试销，最终备货由负责人决定。`,
      `市场：核心候选 ${core.length} 条；价格中位数 ${fmtCash(mid)}（卖家精灵样本、非全市场）。`,
      `定价：保本 ${fmtCash(ceilCent(targetPrice(s,0)))}；10% ${fmtCash(ceilCent(targetPrice(s,10)))}；15% ${fmtCash(ceilCent(targetPrice(s,15)))}；20% ${fmtCash(ceilCent(targetPrice(s,20)))}；当前 SKU ${fmtCash(rawNum(s.price))}。`,
      `利润：当前单件成本 ${fmtCash(f.totalCost)}；单件贡献利润 ${fmtCash(f.profit)}；销售利润率 ${fmtPct(f.margin)}；经营 ROI ${fmtPct(roi(f))}。`,
      `试销：${a}件采购＋头程约 ${fmtCash(a*capital)}，全部售罄贡献利润 ${fmtCash(a*f.profit)}；${z}件采购＋头程约 ${fmtCash(z*capital)}，全部售罄贡献利润 ${fmtCash(z*f.profit)}。`,
      `风险：竞品销量为第三方估算；目标售价接受度、实际FBA费和广告/退货成本尚需以订单验证。`
    ];
    return lines.join('\n');
  }
  window.renderReport = function(p){
    const {s,core,mid,b}=analysisValues(p);
    if(!s)return heading('新品可行性结论','请先在「产品信息 / SKU」建立产品。');
    const f=profit(s),[a,z]=trialSizes(s),cash=skuPurchaseUSD(s)+rawNum(s.freight);
    const decision=b?.decision&&b.decision!=='待人工确认'?b.decision:'待主管确认';
    const relative=Number.isFinite(mid)&&mid>0?(rawNum(s.price)/mid-1)*100:NaN;
    const ad10=rawNum(s.price)>0?100*(.9-f.fixed/rawNum(s.price)) - rawNum(s.referral)-rawNum(s.returns)-rawNum(s.promotion):NaN;
    const decisionDesc=`${a}–${z} 件试销方案供审批；数据按当前 SKU 成本与售价实时计算，未自动批准备货。`;
    const evidence=[
      ['需求样本',`核心候选 ${core.length} 条`,`核心价中位数 ${fmtCash(mid)}，竞品月销须核实父子体去重。`],
      ['售价合理性',`当前标价 ${fmtCash(rawNum(s.price))}`,Number.isFinite(relative)?`较核心样本价格中位数${relative>=0?'高':'低'} ${Math.abs(relative).toFixed(1)}%；能否成交尚未验证。`:'核心竞品售价数据不足。'],
      ['盈利能力',`单件 ${fmtCash(f.profit)} / ${fmtPct(f.margin)}`,`经营 ROI ${fmtPct(roi(f))}；单件已分摊成本 ${fmtCash(f.totalCost)}。`],
      ['主要风险',`广告临界约 ${fmtPct(ad10)}`,`以当前售价实现10%利润率所允许的最高广告费率；其他费用保持不变。`]
    ];
    const check=ad10<0?'当前售价即使没有广告，也达不到10%利润率。':`当前广告费率 ${rawNum(s.ads)}%；提高到 ${fmtPct(ad10)} 附近，模型利润率降至10%。`;
    return `${heading('新品市场可行性简报','美国站 · 直接呈现决策数据；不代替真实销量与采购审批。')}<div class="dm-report-toolbar"><button class="btn" data-action="dm-copy-brief">复制主管简报</button><button class="btn primary" data-action="dm-print-brief">打印 / 另存为 PDF</button></div><div class="dm-decision"><small>当前判断 · ${safe(p.name||s.name)}</small><h2>${safe(decision)}</h2><p>${safe(decisionDesc)}</p></div><div class="dm-report-grid">${evidence.map(([label,title,detail])=>`<div class="dm-brief-card"><small>${safe(label)}</small><b>${safe(title)}</b><p>${safe(detail)}</p></div>`).join('')}</div><h3 class="dm-head">价格梯度与投资回报</h3><div class="card dm-report-table">${targetTable(s,true)}<p class="dm-footnote">目标利润率以当前成本和广告假设反推，不能视为市场最高接受价。</p></div><h3 class="dm-head">50–100件试销：资金情景</h3><div class="card">${trialTable(s)}<p class="dm-footnote">${safe(check)}</p></div><details class="dm-source"><summary>展开原始调研文字与人工复核（已保存内容不会删除）</summary><div class="card"><label class="btn" for="mrsFile">上传 TXT / MD / DOCX</label><input type="file" id="mrsFile" accept=".txt,.md,.docx" hidden><textarea id="mrsText" placeholder="原始市场调研结论…">${safe(p.report||'')}</textarea><button class="btn primary" data-action="mrs-create-board">保存原文并更新判断</button></div></details><p class="dm-footnote">数据来源：项目中的竞品记录和利润实验室；竞品销量为卖家精灵估算，利润为贡献利润。报告不会自动调用 AI 接口。</p>`;
  };
  document.addEventListener('click',async event=>{
    const btn=event.target.closest('[data-action]');if(!btn)return;
    if(btn.dataset.action==='dm-copy-brief'){
      const p=project();if(!p)return;
      try{await navigator.clipboard.writeText(briefText(p));toast('已复制主管简报');}catch(e){toast('复制失败，请使用浏览器的打印功能');}
    }
    if(btn.dataset.action==='dm-print-brief')window.print();
  });
})();
