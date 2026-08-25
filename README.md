# VOZOL Tampa Shop Tracker

## 本地启动
1. 安装 Node.js 18+
2. 在项目目录运行 `npm install`
3. 复制 `.env.example` 为 `.env`
4. 填写：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. 运行 `npm run dev`

## V1 已实现
- Supabase 邮箱/密码登录
- Sales / Manager 角色识别（权限最终由 Supabase RLS 保证）
- 云端门店读取、新建、修改
- Manager 可查看团队门店和分配负责人
- 独立 visits 表写入拜访记录
- 门店详情默认最近 3 次，可展开最近 10 次
- Excel 导出入口预留

## 注意
不要把 Supabase Secret key / service_role key 写入 `.env` 或任何前端文件。前端只使用 Publishable key。
