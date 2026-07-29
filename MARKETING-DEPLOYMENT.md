# 内容营销智能体部署说明

工作台入口：`/marketing`

## 上线步骤

1. 在 Supabase SQL Editor 中执行 `supabase-upgrade-marketing.sql`。
2. 在 Vercel 项目环境变量中增加：

   - `SUPABASE_MARKETING_BUCKET` = `marketing-materials`

3. 重新部署项目。
4. 使用现有 Growth Handbook 管理员账号登录内容工作台。

## 当前版本

- 上传照片、短视频或文字素材。
- 未确认儿童宣传授权时禁止生成发布稿。
- 自动生成朋友圈、小红书和抖音三个平台版本。
- 人工审核后安排负责人、手机号和发布时间。
- 生成站内提醒任务，并为企业微信或短信提醒预留通道。

企业微信或短信的真实手机送达需要接入相应服务商凭证。未接入前，系统会明确显示“手机提醒待接通”，不会将任务虚假标记为已发送。
