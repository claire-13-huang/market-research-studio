# Market Research Studio V0.2

Amazon 美国站产品市场调研与选品决策工具（静态原型）。

## 在线部署（仅首次设置）

1. 打开 [Settings → Pages](https://github.com/claire-13-huang/market-research-studio/settings/pages)。
2. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
3. Branch 设置为 **main**，Folder 设置为 **/(root)**，点击 **Save**。
4. 在 Pages 设置中等待 GitHub 显示实际访问地址。通常为 https://claire-13-huang.github.io/market-research-studio/ 。

以后更新 `main` 分支中的前端文件，GitHub Pages 会自动重新发布。

## 已实现

- 独立项目库和多 SKU / 变体编辑
- Excel 竞品导入、字段匹配和竞品表
- 市场 Dashboard：价格带、月销量和年化销量 / 销售额
- 利润实验室：保本价、10% 和自定义目标利润率售价；单件/月度/年度成本与利润
- 浏览器本地项目草稿、历史版本和导出
- 基于规则的分析草稿（**尚非在线大模型 AI**）

## 数据安全和功能边界

这是**浏览器本地原型**，不是正式云端 SaaS。

- 当前项目数据存储在当前浏览器的 localStorage；换浏览器或设备**不会同步**，清理网站数据可能导致记录丢失，请定期导出备份。
- GitHub Pages 仅托管公开前端文件；不能安全存储用户密钥、私有项目数据，也不提供真正的账户登录、协作、数据库及 AI 服务。
- 仓库**不包含**原始调研 Excel、采购报价和实际竞品明细。请勿把含敏感报价的表格直接提交到公开仓库。
- Excel 导入使用 SheetJS CDN，相关解析器加载依赖网络。
- 月销量数据如是单月截面，年销量/销售额仅为**年化推算**，不是历史年度实绩。
- 建议后续增加独立云数据库和服务端 AI 接口，然后再实现跨设备存档、多人共享。

## 目录

- `index.html`：网页入口
- `app.js`：前端功能和计算逻辑
- `styles.css`：页面样式
- `assets/seed-data.js`：空白演示项目
- `.nojekyll`：静态文件直出

## 后续更新

在这个对话中说明需要修改的功能及问题，我可以在已连接的 GitHub 仓库上更新源代码，并在 Pages 已启用的情况下由 GitHub 自动发布。
