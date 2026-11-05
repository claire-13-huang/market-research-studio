# Market Research Studio V0.6 — 团队权限升级（未启用）

**这套权限必须在 Supabase 数据库里执行。GitHub Pages 只负责界面，不能替代 RLS。**

## 现状和上线顺序

1. 先备份现有市场调研 JSON：网站右上角「导出项目」。原来的 `mrs_projects` 和 `mrs_project_invites` 数据会保留。
2. 打开新项目的 Supabase SQL Editor，完整运行 [team-access-v06.sql](./supabase/team-access-v06.sql)，看到 `Success. No rows returned`。
3. **必须在 SQL Editor 手动指定唯一主账号**。以已登录网站的邮箱为准，在 SQL Editor 运行：
   ```sql
   insert into public.mrs_team_admins (user_id)
   select id from auth.users where lower(email) = lower('clintionclaire@gmail.com')
   on conflict (user_id) do nothing;

   update public.mrs_team_members
   set status='active',can_create=true,can_share=true,updated_at=now()
   where user_id in (select user_id from public.mrs_team_admins);
   ```
   运行后执行 `select count(*) from public.mrs_team_admins;`，预期为 `1`。若 `0`，请先用该邮箱在网站完成登录，再运行主账号 SQL。**主账号只从 Supabase 服务端写入，网页不能自行注册或提升管理员。**
4. 确保 SQL Editor 成功、主账号初始化后，再启用前端团队界面 `team-access.js`（本仓库暂不引入 `index.html`，避免未初始化数据库时锁住网站）。可让 ChatGPT 按完成情况安全启用。
5. 用三个独立邮箱验收：管理员、被批准成员、被暂停成员。验证成员只有自己项目、管理员能看到所有项目；普通成员分享被拒、申请批准后才能共享；未登录不能进入团队工作台。

## 权限模型

- 管理员：用户审核/暂停、创建权限开关、分享权限开关、查看所有团队项目、登录和权限申请记录。管理员项目访问范围仅限本工作空间业务数据，成员登录前应获得说明。
- 普通成员：首次邮箱注册为 `pending`，管理员批准后状态 `active` 且默认可以创建并维护自己的项目，但分享权限默认关闭。成员可申请分享权限，管理员批准后 `can_share=true`。
- 已暂停成员：`suspended`，无权访问云端工作项目。RLS 会在数据库层检查权限，不能通过修改网页按钮绕过。
- 共享对象：目前仅支持已验证邮箱的项目只读邀请；**原始 Excel 附件仍在上传者浏览器 IndexedDB**，不会自动共享或下载，未来需单独设置私有 Supabase Storage。
- 通知：当前采用**站内登录事件与待审批清单**，需要管理员打开网站才能查看；要发送真实提醒邮件，需要配置第三方邮件服务与服务端函数，不能直接把 SMTP 密码放在网页里。
- 网站更新：GitHub `main` 代码部署与数据库同步是不同机制。页面可以自动刷新检查版本，但项目数据只有在云端保存成功后才能让其他人读取。

## 安全要点

- 不能在 GitHub 或网页放 Supabase `service_role`、`sb_secret_` 或数据库密码。
- 管理员身份依据 SQL Editor 初始化的 `mrs_team_admins.user_id`，不依据浏览器变量、成员自填姓名或可修改的 `user_metadata`。
- 需要登录才能访问正式团队功能。用户对同事项目的可见范围必须在加入团队时明确说明。
- 不建议直接邀请同事进入 **Supabase Dashboard 的组织/项目成员**，那是数据库管理权限；同事只需要 Market Research Studio 网站里的普通账号。
- 本迁移在 SQL 层增加权限表、登录事件与审批表，并覆盖旧 RLS 策略，不清空已存档的调研项目。

## 后续验收

- RLS：未登录不能读；待审批不能读项目；普通成员只能读取自己或被邀请的项目；管理员可读取全团队项目；普通成员不可修改任何人的权限。
- 审核：请求共享权限 → 管理员批准 → 只有该成员能共享；管理员暂停后旧链接失效（已下载的副本无法撤回）。
- 同步：管理员看见成员创建的项目，成员看不到其他人未共享的项目；数据发布后另一端刷新可读取。
