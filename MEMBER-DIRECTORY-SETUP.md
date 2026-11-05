# Market Research Studio V0.7 — 成员姓名与多选共享

本版本不再手工给任意邮箱授权。每个同事用自己的邮箱登录网站，首次设置显示姓名；管理员审核通过后，该同事出现在可选择的团队通讯录中。分享关系绑定到已验证的 `user_id`。

## 先做一次数据库升级（必须）

在你当前的 Supabase 项目（与网站 `cloud-config.js` 对应的项目）→ SQL Editor → New query：

复制并执行 [supabase/member-directory-v07.sql](./supabase/member-directory-v07.sql)。

**执行前确认**：V0.5 `supabase/schema.sql` 和 V0.6 `supabase/team-access-v06.sql` 都执行成功，并已将管理员邮箱加入 `mrs_team_admins`（`admin_count = 1`）。

**执行后检查**：

```sql
select
  to_regclass('public.mrs_member_profiles') as profiles,
  to_regclass('public.mrs_project_shares') as shares;
```

两列均应显示表名。如果出现报错，请不要反复执行其他脚本，先核实错误。

本升级不删除旧项目、SKU、调研结论、利润、历史版本。旧的邮箱邀请记录仍可用于读取先前分享项目，但新分享只走成员选择器，禁止新写旧邮箱邀请表。旧分享若需清理可另行管理。

## 在网站里使用

1. 你和同事分别登录 https://claire-13-huang.github.io/market-research-studio/ ，首次进入会要求设置 **显示姓名**（例如“王小明”）。已验证邮箱由 Supabase Auth 提供，不可在个人资料里改写。
2. 管理员点击「管理员中心」，可以看到 **姓名 / 邮箱 / 审批状态**。新用户先审批为 `active`。
3. 打开已上传云端的调研项目，点击「团队同步」→「选择共享成员（可多选）」。
4. 勾选一人、多人或全选，点击「保存共享名单」。同事登录并刷新网站即可读取该项目，默认只能查看。
5. 若取消勾选并保存，将撤回该成员通过 **新名单共享机制** 获得的访问权限。旧版邮件分享可单独排查。
6. 成员可随时点击顶部「我的姓名：…」调整显示姓名。姓名不是权限依据，权限基于认证用户 ID、团队批准状态与 RLS。

## 限制与安全

- **只有已注册且已获批准的成员会出现在分享列表。**
- 普通成员必须获得管理员授予的 `can_share` 权限才能共享自己的项目；管理员可管理团队项目。
- 分享仅限云端项目数据（产品、SKU、Dashboard、利润、结论、版本等）。原始 Excel 附件仍可能只在上传者浏览器内存储，未实现私有文件云端同步。
- 管理员可以看到所有团队云端项目；成员在首次使用时有说明。管理员无法查看用户个人邮件内容或电脑文件。
- GitHub Pages 托管公开代码，但 Supabase 数据库数据受登录和 RLS 限制。不能将 `service_role` 或数据库密码提交到网站。
- 当前新建 Supabase 项目还未接入 ChatGPT 的 Supabase 管理连接，因此需在 Supabase 网站运行上述 SQL。代码已经提交 GitHub。

## 验收建议

分别用管理员和成员 A、B 登录。批准成员后，他们的姓名与邮箱都应出现在管理列表；管理员勾选 A、B 两人共享一个测试项目，A 与 B 刷新都能读取；取消勾选 B 后，B 刷新不再能读取该项目（前提是 B 没有通过旧版邀请获得额外授权）。未批准用户不能读取任何团队项目。
