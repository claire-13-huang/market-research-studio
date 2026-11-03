# Market Research Studio V0.2 · GitHub Pages 发布包

本目录是可直接提交到单独 GitHub 仓库 `market-research-studio` 的静态网站文件。**不含参考 Excel、采购报价、竞品实数据或个人资料**。仓库公开时，源代码和附带数据会被公开。

## 发布

1. 在 GitHub 账户 `claire-13-huang` 下新建名为 `market-research-studio` 的 public 仓库（建议创建时不要选择 README、License 或 `.gitignore`，避免首次上传冲突）。
2. 将本目录 `index.html`、`app.js`、`styles.css`、`assets/seed-data.js`、`.nojekyll` 和 `README.md` 提交到该仓库 `main` 分支根目录。
3. 在仓库 **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**。
4. 网站一般会在 `https://claire-13-huang.github.io/market-research-studio/` 可访问；实际地址以 Pages 页面显示为准。**当前未替用户创建仓库或启用 Pages，故上述链接仅为预计地址，不代表已经上线。**

## 现有功能

- 多项目、多 SKU；Excel 导入/字段映射；竞品数据库；市场 Dashboard；AI 结论替代为规则初稿。
- 利润实验室：0%、10%、自定义利润率对应的售价，单件总成本、利润率和利润；按月销量、年销量或年销售额择一输入，联动单件/月度/年度收入、全部成本与利润。
- 数据保存在浏览器 localStorage，原始上传文件另保存在当前浏览器 IndexedDB。版本存档也是**同浏览器本地存档，不是云端数据**；换设备不会同步。请定期导出 JSON 备份。

## 必须了解

GitHub Pages 是静态网站托管，不提供数据库、账号登录、真正 AI 后端或私密数据共享。不能把密钥写入 JS。未来应通过独立后端/云数据库实现身份认证和跨设备同步。初次使用 Excel 导入需要联网从 SheetJS CDN 载入解析器。