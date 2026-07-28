# 阿墨逗儿童成长手册 · 网页版

一个在线儿童成长手册系统，支持管理员录入孩子信息、照片、评语等，家长通过分享链接查看精美的成长档案，并可下载为 PPT 文件。

## 功能特点

- **管理后台**：员工登录后管理孩子信息、上传照片、填写评语
- **分享页面**：家长通过链接查看孩子的成长手册，支持 4 种风格主题
- **PPT 下载**：一键将成长档案导出为 PowerPoint 文件
- **响应式设计**：手机、平板、电脑均可完美显示

## 部署步骤

### 第一步：创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com) 注册账号（免费）
2. 点击 "New Project" 创建新项目
3. 设置项目名称（如：growth-handbook）、数据库密码
4. 等待项目初始化完成（约 1-2 分钟）

### 第二步：初始化数据库

1. 在 Supabase Dashboard 左侧菜单点击 "SQL Editor"
2. 点击 "New Query"
3. 将 `supabase-schema.sql` 文件的全部内容粘贴进去
4. 点击 "Run" 执行
5. 确认所有表创建成功（左侧 Tables 应显示 9 个表）

### 第三步：创建管理员账号

1. 在 Supabase Dashboard 左侧点击 "Authentication"
2. 点击 "Users" 标签页
3. 点击 "Add user" → "Create new user"
4. 输入邮箱和密码（这是管理员登录凭据，请妥善保存）

### 第四步：获取 API 配置

1. 在 Supabase Dashboard 左侧点击 "Settings" → "API"
2. 复制以下两个值：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon public key**（在 Project API keys 区域）

### 第五步：配置前端

打开 `admin.html` 和 `child.html`，找到文件顶部的配置区域：

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

将这两个值替换为你在第四步中复制的 Project URL 和 anon public key。

### 第六步：部署到 Vercel（免费）

**方式一：拖拽部署（最简单）**

1. 访问 [vercel.com](https://vercel.com) 注册账号（免费）
2. 点击 "Add New" → "Project"
3. 选择 "Import Third-Party Git Repository" 或直接拖拽文件夹
4. 将 `growth-handbook-web` 文件夹拖拽到上传区域
5. Framework Preset 选择 "Other"
6. 点击 "Deploy"
7. 等待部署完成，获得一个 `.vercel.app` 域名

**方式二：命令行部署**

```bash
npm i -g vercel
cd growth-handbook-web
vercel
```

### 第七步：自定义域名（可选）

在 Vercel Dashboard → Project Settings → Domains 中可以绑定自己的域名。

## 使用说明

### 管理员操作

1. 访问 `https://你的域名/admin.html`
2. 使用第三步创建的管理员邮箱和密码登录
3. 点击 "+ 添加孩子" 创建档案
4. 在各个标签页中填写孩子的信息：
   - **基本信息**：姓名、性别、生日、班级、头像、手册风格
   - **成长时间线**：记录重要成长事件
   - **课程记录**：每节课的表现和评语
   - **老师评语**：学期评语
   - **照片库**：上传课堂和活动照片
   - **活动记录**：参加的活动和担任的角色
   - **获奖成就**：获得的奖项
   - **家长留言**：家长的寄语

### 分享给家长

1. 在孩子卡片上点击 "复制" 按钮获取分享链接
2. 将链接通过微信发送给家长
3. 家长打开链接即可查看精美的成长手册
4. 家长可以点击 "下载PPT" 按钮保存为 PPT 文件

### 手册风格

每个孩子可以选择不同的手册风格：
- 🚀 **星空探索**：适合男孩，深空蓝+星光金
- 🌿 **森林探险**：适合男孩，森林绿+木棕金
- 🌸 **梦幻花园**：适合女孩，玫瑰粉+蜜桃金
- 🌈 **阳光彩虹**：适合女孩，暖珊瑚+阳光黄

## 技术栈

- **前端**：纯 HTML/CSS/JavaScript，无框架依赖
- **数据库**：Supabase (PostgreSQL)
- **文件存储**：Supabase Storage
- **PPT 生成**：pptxgenjs (客户端)
- **托管**：Vercel (静态站点)

## 费用说明

- Supabase 免费版：500MB 数据库 + 1GB 文件存储 + 无限 API 请求
- Vercel 免费版：无限静态站点托管 + 100GB 带宽
- 对于 300 个学员的规模，免费版完全够用

## 文件结构

```
growth-handbook-web/
├── index.html           # 入口（跳转到管理后台）
├── admin.html           # 管理后台
├── child.html           # 家长查看页面 + PPT下载
├── supabase-schema.sql  # 数据库初始化脚本
└── README.md            # 本文件
```

## 注意事项

1. 请妥善保管管理员账号密码
2. 分享链接包含随机令牌，他人无法猜测其他孩子的链接
3. 照片建议压缩后再上传（每张 < 2MB），以节省存储空间
4. 如需备份数据，可在 Supabase Dashboard 中导出数据库
