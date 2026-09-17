# Growth Portfolio 家长端受控试点

适用阶段：GP-L6 — Parent Access Controlled Pilot

范围：邮件邀请、家长登录、监护人绑定、多孩子入口、已授权家庭素材补充。
Production 数据库变更：只允许 Human 在 Supabase SQL Editor 手动执行。

## 1. 权限矩阵

| 身份 | 可查看 | 可写入 | 明确禁止 |
| --- | --- | --- | --- |
| 未登录分享访客 | 有效分享 Token 对应的公开 Portfolio 投影 | 无 | 直接查询儿童业务表、提交家庭素材、后台操作 |
| 已绑定家长 | 自己账号下处于 active 的孩子卡片；通过该孩子的有效分享 Token 查看 Portfolio | 仅在 `can_upload_growth=true` 时提交待审核家庭素材 | 修改姓名/生日/班级；读取其他孩子；直接管理业务表；审核或发布 |
| active 员工 | 机构后台及现有业务表 | 现有机构录入、审核和管理操作 | 家长身份自授权、绕过后台直接授予权限 |
| 服务端 Secret | 受信 API 所需的邀请、绑定及白名单读取 | 服务端受控写入 | Secret 进入浏览器、日志、源码或响应 |

家长素材仍需机构审核后才进入正式 Growth Record。分享 Token 阅读链继续保留，但不再作为家长投稿的唯一授权凭据。

## 2. Production 启用顺序

1. 确认 Supabase Dashboard 的公众 Email Signups / User Signups 已关闭。
2. 在 Authentication → URL Configuration 中加入：
   `https://growth-handbook-phi.vercel.app/parent`
3. 在现有 Vercel Project 增加环境变量：
   `PARENT_APP_URL=https://growth-handbook-phi.vercel.app/parent`
4. 确认正式 `main` 已包含 GP-L6 代码。迁移前代码会自动保持旧管理员边界，不会因为新表尚未建立而锁死后台。
5. 使用 Supabase SQL Editor 手动执行：
   `supabase-parent-access-pilot.sql`
6. 立即使用正式管理员账号登录 `/edu`。当 `staff_profiles` 为空时，该动作只会把首位受信账号初始化为 owner；公众注册必须在此之前保持关闭。
7. 使用 SQL Editor 执行只读验收：
   `supabase-parent-access-verification.sql`
8. 只有 `OVERALL = PASS` 后，才从 `/admin` → 孩子 → `监护人权限` 邀请第一位测试家长。

## 3. 第一批试点建议

- 先选择 1 个内部测试家庭，不直接向 300+ 家庭开放。
- 同一个家长先绑定 1 个孩子，验证后再测试多孩子绑定。
- 新邀请使用最新邮件；过期或已使用的邀请链接不重复测试。
- 手机分别测试微信内置浏览器与系统浏览器。

## 4. 必测场景

1. 管理员可登录，直接录入与审核操作正常。
2. 家长收到官方邀请邮件并在 `/parent` 设置至少 8 位密码。
3. 家长邮箱密码可再次登录。
4. 家长只看见 active 绑定的孩子；多孩子账号可见多张孩子卡片。
5. 未绑定孩子不可枚举、不可打开家长入口数据。
6. 停用绑定后，家长账号立即不再返回该孩子。
7. 分享链接仍可匿名查看，但匿名访客不能提交家庭素材。
8. `can_upload_growth=false` 时，家长不能提交文字或图片素材。
9. 家长投稿保持 pending，只有 active 员工可审核发布。
10. PPT、PDF、主题切换和互动成长册保持正常。

## 5. 失败处理

- 邀请跳错页面：检查 Supabase Redirect URLs 与 Vercel `PARENT_APP_URL`，不要把 Token 发到聊天。
- 家长显示“尚未绑定”：检查 `parent_accounts.status` 与对应 child 绑定，不要开放全表策略。
- 管理员无权限：先确认其 Auth 账号已经在 `staff_profiles` 且 `status=active`。
- Verification 出现 FAIL：停止邀请新家长；不要用 `using(true)` 临时绕过。
- 需要紧急停止试点：在后台把测试家长绑定改为 inactive；保留表和历史数据，不执行 destructive rollback。

## 6. 当前边界

- 试点使用 Supabase 官方邮件邀请，不购买短信服务。
- 没有公众注册入口。
- 没有家长修改儿童机构档案能力。
- 没有家长审核、发布或跨孩子检索能力。
- 邮件送达量扩大前，需要单独评估自定义 SMTP 与正式通知策略。
