# Supabase 团队同步配置（Market Research Studio V0.5）

网站继续使用 GitHub Pages 发布代码。Supabase 用于存储共享项目与版本。未完成本页配置前，网站的数据仍然只保存在本浏览器。

## 1. 创建项目、执行 SQL
打开 https://supabase.com/dashboard ，在自己的组织创建 PostgreSQL 项目。
进入 Supabase → SQL Editor，执行仓库的 supabase/schema.sql。两张表为 mrs_projects 和 mrs_project_invites，启用了 RLS：所有者能写、收到邮箱邀请的同事只能读，匿名访问不能读。
务必先用授权与未授权两个测试邮箱验收，才共享真实采购成本和利润。不要关闭 RLS。

## 2. 设置邮箱登录
Supabase → Authentication → URL Configuration：
- Site URL： https://claire-13-huang.github.io/market-research-studio/
- Redirect URLs： https://claire-13-huang.github.io/market-research-studio/**
Authentication → Providers：启用 Email Magic Link / OTP。

## 3. 配置公开项目地址与 publishable key
在 Supabase 项目设置中复制 Project URL 和 publishable key（或者旧版 anon 公钥）。
编辑仓库根目录 cloud-config.js，填入 url 与 publishableKey。两个字段可用于浏览器前端，但必须严格启用 RLS。绝不可填写 sb_secret、service_role 或数据库管理员密码。
提交到 main，GitHub Pages 会自动重新发布。

## 4. 将你已经做好的产品同步到同事
1. 打开已部署网站，用「导出项目 → JSON」先备份现有浏览器数据。
2. 点击右上角「☁ 团队同步」，输入邮箱并通过邮件登录。
3. 打开现有调研项目，点击「将当前项目发布到云端」，确认出现「已发布 / 云端已保存」。
4. 输入同事的登录邮箱，点击「授权邮箱」，再点击「复制项目链接」。
5. 同事打开链接，使用被授权的邮箱登录，便能查看相同 Dashboard、SKU、利润和结论。
6. 修改成本、售价等字段后，待「云端已保存」提示出现，同事刷新即可查看新值。

## 5. 更新、权限和限制
- 网页修改后通常在约 0.9 秒启动云端写入；同事刷新立即读取，网页保持打开时每 15 秒尝试拉取新版本。
- 修改 GitHub 源码推送到 main 会触发 Pages 发布。刷新或点击新版本提醒即可更新界面。
- 同事默认只读，不支持并发共同编辑；云端同步采用 revision 防止静默覆盖。
- 云端同步项目、SKU、精简竞品、利润、结论和历史版本；原始 Excel 的 IndexedDB 附件仍只在最初导入的浏览器中，不会自动共享。
- 共享的字段可能包含采购价、利润和供应商线索，请只授权可信邮箱。
- 收回授权并不能删除同事曾经下载或截取的副本。
- Supabase 邮件登录有发送频率限制，大规模使用时需要 SMTP 配置。
- 未配置时，页面明确显示「未连接数据库」，不代表云端已开通。

## 6. 验收标准
A 所有者发布一个项目；B 授权邮箱可以用不同浏览器登录并读取；A 修改利润参数后 B 刷新看到更新；C 未授权邮箱无法访问项目；GitHub 页面更新后 B 刷新加载新版脚本。

常见故障：找不到 mrs_projects 表 = SQL 未执行；Invalid API key = cloud-config.js 的公开密钥错误；登录后回跳地址错误 = 检查 URL Configuration。