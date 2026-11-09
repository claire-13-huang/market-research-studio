/* v0.8.6 — price, volume, annual capital ROI + evidence-led executive brief. No automatic data mutation. */
(function installInvestmentMatrix(){
  'use strict';
  const beforeProfit=window.renderProfit;
  const pct=v=>Number.isFinite(v)?v.toFixed(2)+'%':'—';
  const amt=v=>Number.isFinite(v)?money(v):'—';
  const sumNum=v=>Number.isFinite(Number(v))?Number(v):0;
  const cent=v=>Number.isFinite(v)?Math.ceil((v-1e-9)*100)/100:NaN;
  const percentRoi=f=>f.totalCost>0?f.profit/f.totalCost*100:NaN;
  const isTray=p=>/亚克力浴缸托盘|acrylic.{0,15}(?:bath|tub)|bathtub.{0,15}tray/i.test(p.name||'');
  const active=p=>p.skus.find(s=>s.id===activeSkuId)||p.skus[0];
  const units=s=>{
    const manual=s.comparisonMonthlyUnits;
    return manual!==undefined&&manual!==null&&manual!==''?Math.max(0,Math.round(sumNum(manual))):Math.max(0,Math.round(projection(s).monthlyUnits));
  };
  const budget=s=>Math.max(0,sumNum(s.annualInvestmentCny));
  const trialPrice=(p,s)=>{
    const val=s.scenarioTestPrice;
    return val!==undefined&&val!==null&&val!==''?Math.max(0,sumNum(val)):(isTray(p)?85:sumNum(s.price));
  };
  const trialLots=s=>{
    const a=Math.min(100000,Math.max(1,Math.round(sumNum(s.pilotMin)||50)));
    const b=Math.min(100000,Math.max(a,Math.round(sumNum(s.pilotMax)||100)));
    return [a,b];
  };
  function cases(p,s){
    return [{name:'保本价（0%）',price:cent(targetPrice(s,0)),base:true},
      {name:'10%利润目标',price:cent(targetPrice(s,10))},
      {name:'15%利润目标',price:cent(targetPrice(s,15))},
      {name:'20%利润目标',price:cent(targetPrice(s,20))},
      {name:'试销测试价',price:trialPrice(p,s),test:true},
      {name:'当前SKU售价',price:sumNum(s.price),current:true}];
  }
  function situation(f,price,base){
    if(!Number.isFinite(price)||price<=0)return ['不可测算','bad'];
    if(f.profit < -0.005)return ['亏损','bad'];
    if(base||f.margin < 0.5)return ['盈亏平衡','neutral'];
    if(f.margin < 10)return ['利润偏低','warn'];
    if(f.margin < 15)return ['达到10%目标','ok'];
    return ['账面达标·需求待验','ok'];
  }
  function priceComparison(p,s,controls=true){
    const u=units(s),invest=budget(s),fx=sumNum(s.fx), rows=cases(p,s);
    const inputControls=controls?`<div class="ix-controls">
      <label>统一预测月销（件）<input type="number" min="0" step="1" data-sku-field="comparisonMonthlyUnits" value="${u}"></label>
      <label>试销测试价（USD）<input type="number" min="0.01" step=".01" data-sku-field="scenarioTestPrice" value="${trialPrice(p,s)}"></label>
      <label>预计全年投入资金（CNY）<input type="number" min="0" step="1" data-sku-field="annualInvestmentCny" value="${invest}"></label>
      <span>未填写全年投入时，不计算年度投资回报率。</span>
    </div>`:'';
    const content=rows.map(row=>{
      const valid=Number.isFinite(row.price)&&row.price>0;
      const f=valid?profit(s,row.price):null,month=f?f.profit*u:NaN,annual=month*12;
      const yRoi=invest>0&&fx>0?annual*fx/invest*100:NaN;
      const [tag,kind]=f?situation(f,row.price,row.base):['无法反推','bad'];
      return `<tr class="${row.test?'ix-test':''} ${row.current?'ix-current':''}">
        <td class="ix-label">${row.name}</td>
        <td class="num">${amt(row.price)}</td>
        <td class="num">${sumNum(s.ads).toFixed(1)}%</td>
        <td class="num ${f?.profit<0?'u-red':'u-green'}">${amt(f?.profit??NaN)}</td>
        <td class="num">${pct(f?.margin??NaN)}</td>
        <td class="num">${pct(f?percentRoi(f):NaN)}</td>
        <td class="num">${u.toLocaleString('en-US')}</td>
        <td class="num ${month<0?'u-red':''}">${amt(month)}</td>
        <td class="num ${annual<0?'u-red':''}">${amt(annual)}</td>
        <td class="num">${invest>0?'¥'+invest.toLocaleString('zh-CN',{maximumFractionDigits:2}):'待填写'}</td>
        <td class="num">${pct(yRoi)}</td>
        <td><span class="ix-status ${kind}">${tag}</span></td>
      </tr>`;
    }).join('');
    return `${inputControls}<div class="data-table-wrap ix-scroll"><table class="ix-table"><thead><tr>
      <th>售价方案</th><th class="num">售价 $</th><th class="num">广告率</th><th class="num">单件利润 $</th>
      <th class="num">利润率</th><th class="num">单件 ROI</th><th class="num">预计月销</th>
      <th class="num">预计月利润 $</th><th class="num">预计年利润 $</th><th class="num">预计投入资金 ¥</th><th class="num">年度投资回报率</th><th>可行性判断</th>
    </tr></thead><tbody>${content}</tbody></table></div>
    <p class="ix-note">全部售价档位采用同一个月销量假设（${u}件），不代表提价后销量不变。单件ROI＝单件贡献利润÷单件总成本；年度投资回报率＝预计年贡献利润折合人民币÷填写的年度投入资金。年度利润按连续12个月销售并按需补货测算，不等于首批试销利润。</p>`;
  }
  function oneTimeTrial(p,s){
    const [lo,hi]=trialLots(s),price=trialPrice(p,s);
    const f=profit(s,price),fx=sumNum(s.fx),upfront=skuPurchaseUSD(s)+sumNum(s.freight),cap=budget(s);
    const table=[lo,hi].map((v,i)=>`<tr><td>${i?'上限方案':'下限方案'} · ${v}件</td>
      <td class="num">${amt(upfront*v)}</td>
      <td class="num">${fx>0?'¥'+(upfront*v*fx).toLocaleString('zh-CN',{maximumFractionDigits:2}):'—'}</td>
      <td class="num">${cap>0?pct(upfront*v*fx/cap*100):'—'}</td>
      <td class="num">${amt(price*v)}</td>
      <td class="num ${f.profit<0?'u-red':'u-green'}">${amt(f.profit*v)}</td>
      <td class="num">${pct(percentRoi(f))}</td></tr>`).join('');
    return `<div class="ix-trial-ctrl"><label>首批下限 <input type="number" min="1" step="1" data-sku-field="pilotMin" value="${lo}"></label>
      <label>首批上限 <input type="number" min="${lo}" step="1" data-sku-field="pilotMax" value="${hi}"></label>
      <span>按试销价 ${amt(price)}，全部售罄情景</span></div>
      <div class="data-table-wrap ix-scroll"><table class="ix-table">
      <thead><tr><th>备货数量</th><th class="num">采购＋头程预付 $</th><th class="num">预付参考 ¥</th>
      <th class="num">占年度资金比例</th><th class="num">售罄收入 $</th><th class="num">售罄贡献利润 $</th><th class="num">单件经营 ROI</th></tr></thead>
      <tbody>${table}</tbody></table></div>
      <p class="ix-note">预付参考仅计算采购与头程；首批还可能产生运入仓、拍摄、Vine、平台扣费及其他资金需求。售价测试和销售数量均是假设，不是已确认订单；首批售罄利润不等于年度利润。</p>`;
  }
  function evidence(p,s){
    if(isTray(p))return [
      ['高价顾客确实存在','卖家精灵类目报告中，高价木质及特色结构商品有成交，说明存在溢价消费群体；不能据此认定同样接受彩色透明亚克力的价格。','已有间接证据'],
      ['材质、颜色与设计具备区分度','彩色透明亚克力款与主流竹木托盘形成视觉差异，具备避开20–30美元基础款竞争的产品定位；差异化能否转化为订单仍需试销。','产品差异明确'],
      ['品类有礼品季节需求','提供的卖家精灵类目报告显示，11月至次年1月更旺，淡季偏弱。库存预测应按保守需求和补货周期安排。','季节性风险']
    ];
    return [
      ['市场需求','项目竞品样本能够提供价格与估算销量参考；需要按真实用途、材质和父子体核实。','样本证据'],
      ['产品差异化','比较实际产品结构、价格、视觉表达和评论需求，避免把功能不一致的商品直接视作竞品。','待验证'],
      ['盈利与资金','用实际采购、FBA、头程、广告和退货费用测算多售价下的盈利与资金需求。','财务假设']
    ];
  }
  function decision(p,s){
    const d=p.reportBoard?.decision;
    if(d&&d!=='待人工确认')return d;
    return isTray(p)?'有条件进入 · 小批量试销待审批':'待人工确认';
  }
  function copyBrief(p,s){
    const [lo,hi]=trialLots(s),u=units(s),inv=budget(s),rs=cases(p,s),f=profit(s,trialPrice(p,s)),year=f.profit*u*12;
    const core=compValid(p).filter(x=>riskTier(x)==='core');
    return [
      `${p.name}｜亚马逊美国站新品评估`,
      `判断：${decision(p,s)}。首批参考${lo}–${hi}件；最终采购由负责人决定。`,
      `市场：核心竞品${core.length}条（项目数据）；有高价木质/特殊结构产品的购买旁证，彩色透明亚克力的接受度尚未直接验证。`,
      `差异化：彩色、透明、外观设计是与竹木基础款区分的卖点，但不保证高价转化。`,
      `售价：保本${amt(rs[0].price)}；10%目标${amt(rs[1].price)}；15%目标${amt(rs[2].price)}；20%目标${amt(rs[3].price)}；测试价${amt(rs[4].price)}。`,
      `测试价单件利润${amt(f.profit)}，利润率${pct(f.margin)}，单件ROI${pct(percentRoi(f))}。`,
      `统一预测月销${u}件；年化贡献利润${amt(year)}；全年投入预算${inv>0?'¥'+inv:'尚未录入'}；年度投入回报率${inv>0&&sumNum(s.fx)>0?pct(year*sumNum(s.fx)/inv*100):'未计算'}。`,
      `资金：${lo}–${hi}件采购＋头程预付参考${amt((skuPurchaseUSD(s)+sumNum(s.freight))*lo)}–${amt((skuPurchaseUSD(s)+sumNum(s.freight))*hi)}，不包含其他预付款和滞销损失。`,
      `风险：高价亚克力有效竞品不足、父子体销量有重复风险；季节波动与广告/退货费用会影响实际利润。`,
      `口径：市场数据为第三方估算；年度利润是稳定月销并持续补货的假设，不是实际年度业绩。`
    ].join('\n');
  }
  function reportView(p){
    const s=active(p);if(!s)return heading('市场调研结论','请先添加SKU。');
    const core=compValid(p).filter(c=>riskTier(c)==='core');
    const mid=core.length?median(core.map(c=>Number(c.price)).filter(Number.isFinite)):NaN;
    const tprice=trialPrice(p,s),fig=profit(s,tprice);
    const pieces=evidence(p,s),[lo,hi]=trialLots(s),status=decision(p,s);
    return `${heading('新品市场评估｜管理层简报','需求依据、差异化、盈利与资金放在一页；所有利润和ROI按当前SKU计算。')}
    <div class="ix-tools"><button class="btn" data-action="ix-copy">复制简报</button><button class="btn primary" data-action="ix-print">打印 / 另存PDF</button></div>
    <div class="ix-report-head"><span>AMAZON US · ${safe(p.name)}</span><h2>${safe(status)}</h2>
      <p>高价材质消费存在旁证，彩色透明设计形成差异化；建议比较 ${lo}–${hi} 件试销资金与实际订单表现后决定是否扩大备货。</p></div>
    <div class="ix-evidence">${pieces.map(([h,body,label])=>`<article><small>${label}</small><h3>${h}</h3><p>${body}</p></article>`).join('')}</div>
    <div class="ix-kpis">
      <div><span>项目核心候选</span><strong>${core.length}条</strong><small>项目筛选样本</small></div>
      <div><span>核心候选售价中位数</span><strong>${amt(mid)}</strong><small>卖家精灵估算样本</small></div>
      <div><span>方案测试价</span><strong>${amt(tprice)}</strong><small>可在下方修改</small></div>
      <div><span>测试价单件利润 / 利润率</span><strong>${amt(fig.profit)} / ${pct(fig.margin)}</strong><small>当前费用假设</small></div>
    </div>
    <h3 class="ix-section-title">不同售价的利润、月销量与年度投资回报</h3><div class="card">${priceComparison(p,s)}</div>
    <h3 class="ix-section-title">首批 ${lo}–${hi} 件试销：投入资金与售罄情景</h3><div class="card">${oneTimeTrial(p,s)}</div>
    <p class="ix-source">数据口径：核心候选来自项目中的卖家精灵导出表；提供的市场分析报告使用另一个94 ASIN类目样本，其高价消费与季节性信息仅作为背景，不与项目273条数据相加。售价、利润与ROI均由当前成本表推算；实际 FBA 费请按包装规格复核。</p>
    <details class="dm-source ix-original"><summary>查看或修改已保存的调研原文</summary><div class="card">
      <label class="btn" for="mrsFile">上传TXT / MD / DOCX</label><input type="file" id="mrsFile" accept=".txt,.md,.docx" hidden>
      <textarea id="mrsText">${safe(p.report||'')}</textarea>
      <button class="btn primary" data-action="mrs-create-board">保存原文并更新判断</button>
    </div></details>`;
  }
  const style=`.ix-controls{display:flex;flex-wrap:wrap;align-items:end;gap:13px;margin:0 0 18px}.ix-controls label,.ix-trial-ctrl label{display:flex;flex-direction:column;gap:6px;color:#61738e;font-size:12px;font-weight:680}.ix-controls input,.ix-trial-ctrl input{max-width:210px;min-width:100px;border:1px solid #d9e3f2;border-radius:8px;padding:9px;color:#243757;background:#fff}.ix-controls span,.ix-trial-ctrl span{font-size:11px;color:#8a98af;max-width:275px;line-height:1.6}.ix-scroll{overflow:auto;max-width:100%}.ix-table{width:100%;min-width:1290px;border-collapse:collapse;white-space:nowrap;font-size:12px}.ix-table th{background:#f4f6fa;padding:13px 12px;color:#526780;font-weight:750;border-bottom:1px solid #e1e8f3}.ix-table td{padding:13px 12px;border-bottom:1px solid #e4eaf2;color:#30445f}.ix-table th.num,.ix-table td.num{text-align:right;font-variant-numeric:tabular-nums}.ix-table tr.ix-test{background:#eef5ff}.ix-table tr.ix-current{background:#f8f9fd}.ix-table th:first-child,.ix-table td:first-child{position:sticky;left:0;background:inherit;z-index:1}.ix-table th:first-child{background:#f4f6fa}.ix-table tr.ix-test td:first-child{background:#eef5ff}.ix-table tr.ix-current td:first-child{background:#f8f9fd}.ix-status{display:inline-block;border-radius:8px;padding:5px 7px;background:#f0f3f8;font-size:11px}.ix-status.bad{background:#fce8e8;color:#a23d4a}.ix-status.warn{background:#fff2d8;color:#966c22}.ix-status.ok{background:#e7f3ea;color:#29774f}.ix-trial-ctrl{display:flex;align-items:end;flex-wrap:wrap;gap:14px;margin:0 0 18px}.ix-note,.ix-source{font-size:11px;color:#8190a7;line-height:1.8;margin:13px 0 0}.ix-tools{display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px}.ix-report-head{background:#eef4fe;border:1px solid #dce7fa;padding:22px 25px;border-radius:15px;margin-bottom:17px}.ix-report-head>span{font-size:10px;color:#6981a3;letter-spacing:1px;font-weight:750}.ix-report-head h2{font-size:24px;margin:8px 0;color:#223d66}.ix-report-head p{font-size:13px;color:#566c8b;line-height:1.7;margin:0}.ix-evidence{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.ix-evidence article{border:1px solid #e2e9f4;border-radius:13px;padding:17px;background:#fff}.ix-evidence small{color:#8191a8;font-size:10px}.ix-evidence h3{font-size:14px;color:#264364;margin:9px 0}.ix-evidence p{font-size:12px;color:#59708d;line-height:1.75;margin:0}.ix-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:17px 0}.ix-kpis>div{background:#fff;padding:16px;border:1px solid #e4eaf4;border-radius:11px;display:flex;flex-direction:column;gap:8px}.ix-kpis span{font-size:11px;color:#7186a3}.ix-kpis strong{font-size:19px;color:#26395e}.ix-kpis small{font-size:10px;color:#94a0b2}.ix-section-title{font-size:16px;font-weight:800;margin:25px 0 13px}.ix-original{margin-top:24px}.ix-original textarea{width:100%;min-height:160px;margin:10px 0;padding:12px;border:1px solid #dbe4f2;border-radius:9px}.ix-source{margin-top:14px}@media(max-width:980px){.ix-evidence,.ix-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.ix-evidence,.ix-kpis{grid-template-columns:1fr}}@media print{.ix-tools,.ix-original,.ix-controls input,.ix-trial-ctrl input{display:none!important}.ix-table{font-size:9px;min-width:0}.ix-table th,.ix-table td{padding:5px 4px}}`;
  const st=document.createElement('style');st.textContent=style;document.head.appendChild(st);
  window.renderProfit=function(p){
    const s=active(p),html=beforeProfit(p);if(!s)return html;
    const i=html.indexOf('最低保本价 →');
    if(i===-1)return html;
    const start=html.lastIndexOf('<section class="section">',i);
    const next=html.indexOf('<section class="section">',i);
    if(start<0||next<0)return html;
    const updated=`<section class="section"><h3 class="section-title">不同售价的利润、月销量与年度投资回报</h3><div class="card">${priceComparison(p,s)}</div></section>`;
    return html.slice(0,start)+updated+html.slice(next);
  };
  window.renderReport=reportView;
  document.addEventListener('change',e=>{
    const field=e.target?.dataset?.skuField;
    if(page==='report'&&['pilotMin','pilotMax','comparisonMonthlyUnits','scenarioTestPrice','annualInvestmentCny'].includes(field))render();
  });
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const p=project(),s=p&&active(p);if(!s)return;
    if(btn.dataset.action==='ix-copy'){try{await navigator.clipboard.writeText(copyBrief(p,s));toast('管理层简报已复制');}catch(_){toast('无法自动复制，可使用打印功能')} }
    if(btn.dataset.action==='ix-print'){window.print();}
  });
})();
