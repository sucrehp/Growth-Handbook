# EDU 智能体第一批核心模块部署

本批次包括统一运营总览、招生线索、合同档案、课时账户、待办任务，以及校区、员工、权限和操作留痕基础。

排课、签到与自动消课将在最后阶段接入。

## 第一步：升级 Supabase

1. 登录 Supabase，进入当前项目。
2. 点击左侧 `SQL Editor`。
3. 点击顶部 `+` 新建查询。
4. 打开项目文件 `supabase-upgrade-edu-core.sql`，复制全部内容。
5. 粘贴到查询框，点击右上角 `Run`。
6. 结果区应显示 13 行新核心表名。

该脚本可以重复执行，不会重复创建已有表。

## 第二步：更新 Vercel

数据库脚本执行成功后，将本项目代码推送到 GitHub 的 `main` 分支，Vercel 会自动创建新的生产部署。

部署完成后的入口：

- EDU 运营入口：`https://growth-handbook-phi.vercel.app/edu`
- 成长手册管理：`https://growth-handbook-phi.vercel.app/admin`
- 教师档案智能体：`https://growth-handbook-phi.vercel.app/teacher-agent`
- 内容营销智能体：`https://growth-handbook-phi.vercel.app/marketing`

## 第一轮验收

1. 使用现有 Supabase 管理员账号登录 EDU 运营入口。
2. 新建一条招生线索。
3. 新建一份合同草稿。
4. 合同变为已签署后，系统应自动建立对应课时账户。
5. 新建一条跟进任务并更新状态。
