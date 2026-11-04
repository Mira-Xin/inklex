# 译笺 · 独立上线版

这套程序使用 GitHub Pages 托管网页，使用你自己的 Supabase 项目提供邮箱登录和云端数据库。网站日常使用不依赖 ChatGPT，也不要求安装 ChatGPT 的 GitHub 或 Supabase 插件。

保留单词、词组、句子、汉语表达、ECDICT 音标与释义、主题与类别、搜索筛选、复习、Excel 与 JSON 导入导出、回收站，以及详情页“上一条 / 下一条”。

## 1. 准备 Supabase 项目

1. 登录 [Supabase](https://supabase.com/dashboard)，创建一个自己的项目，或使用已有的专用项目。数据库密码自己保存，不用发给任何人。
2. 打开项目的 **SQL Editor**，新建查询，把本部署包中的 **supabase/setup.sql** 全文粘贴进去并执行。
3. 执行成功后，项目会有 `inklex_notebooks` 和 `inklex_entries` 两张表，以及对应的访问规则和保存函数。脚本可重复执行，不会清空已有语料。
4. 在项目的 **Connect** 窗口或 **Project Settings** 中找到 **Project URL** 和 **Publishable key**。旧项目的 `anon` key 也可以。后面只需要这两个公开配置值。

管理密钥 `sb_secret_…`、`service_role` 和数据库密码不能填进网页或 GitHub 仓库。本项目会拒绝使用管理密钥构建。

## 2. 创建你自己的网页登录账号

Supabase 平台的管理账号和译笺网站里的用户账号是分别创建的。

1. 在项目中打开 **Authentication → Users → Add user / Create new user**。
2. 输入你用于登录译笺的邮箱，自己设置密码。个人项目可以在创建时选择自动确认邮箱。
3. 在 Authentication 的登录方式设置中保留 Email 登录。创建完个人用户后，可关闭 **Allow new users to sign up**，只允许已有用户登录。
4. 程序提供邮箱密码登录、退出登录和密码找回。密码找回依赖 Supabase 邮件发送配置。若邮件未送达，先检查邮件服务和发送限制；个人项目初期也可在 Supabase 控制台管理用户。

## 3. 把部署包放进 GitHub 仓库

建议新建一个名为 `inklex` 的独立仓库。使用 GitHub Free 的 Pages 时，仓库设为 Public。仓库里只有程序与公开词库，私人语料不放进仓库。

解压本文件，把解压后的**内容**放到仓库根目录，结构应为：

```text
.github/workflows/deploy.yml
index.html
package.json
package-lock.json
src/
public/ecdict/
scripts/check-config.mjs
supabase/setup.sql
tests/
README.md
```

不要再套一层文件夹，不上传 `node_modules`、`dist`、`.env.local` 或任何语料备份。

完整词库有512个分片，建议通过 GitHub Desktop 一次提交整个目录。纯网页上传可能因文件数量限制需要分批。

如果用 GitHub Desktop：先克隆新建仓库，再把本包内容复制进克隆目录，点击 Commit，然后 Push。默认分支使用 `main`。注意 `.github` 是需要一并提交的目录，Windows 下不要漏掉。

## 4. 填两个仓库配置项

打开仓库 **Settings → Secrets and variables → Actions → Variables → New repository variable**，分别新增：

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | 你的 Project URL，例如 `https://项目编号.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 你的 Publishable key，或旧项目的 anon key |

这两个值是前端公开配置，使用 Variables 即可。私人数据由数据库访问规则和登录账号保护。

## 5. 开启 GitHub Pages

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions → Deploy Inklex**，选择 **Run workflow**，分支选 `main`。
4. 如果首次推送时配置还没填全，第一次自动运行可能失败。完成配置后重新运行即可。
5. 成功后，在 Pages 设置页或部署任务中打开网站地址。

工作流自动安装依赖、检查公开配置、执行数据库测试、构建和发布。以后修改程序并推送 `main`，就会自动更新网站。

不需要购买域名。项目默认可以使用 GitHub 提供的网址。程序使用相对路径，支持带仓库名称的子目录。

## 6. 设置密码找回的跳转地址

把实际发布后的网站完整地址（包括仓库路径和末尾的 `/`）填入 Supabase 的 **Authentication → URL Configuration → Site URL**，并加入 **Redirect URLs**。

例如你的 Pages 地址是 `https://你的用户名.github.io/inklex/`，两处都填这个实际地址。自定义域名要填写它实际使用的 HTTPS 地址。

## 7. 迁移旧语料并检查互通

1. 在旧网站打开“导入 / 导出”，选择“导出完整备份”，得到 JSON 文件。
2. 在新网址用第2步创建的邮箱密码登录。
3. 打开“导入 / 导出”，选择刚导出的 JSON，确认导入。首次迁移只需要做一次。
4. 用手机打开**同一个新网址**，登录**同一个邮箱账号**，确认语料可见。
5. 电脑新增或修改一条，再在手机点击“刷新云端内容”，确认更新可见。返回网页和每30秒也会检查更新。
6. 两台设备同时编辑时，后保存的旧版本会被拦截，编辑内容保留在当前窗口。先复制草稿，关闭编辑，刷新云端内容，再核对保存。

旧网站与新网站使用不同数据库，迁移后统一在新网站编辑。它们不会彼此自动同步。

## 保存、离线与备份

- 必须看到“已同步”，才表示云端确认保存成功。失败时编辑窗口不会自动关闭。
- 第一版以联网使用为主。断网后不会假装保存成功，也没有离线编辑自动合并功能。
- 语料按条目存储，编辑时只上传发生变化的条目；ECDICT 静态词库不占用 Supabase 数据库容量。
- 回收站可查看并恢复30天内删除的条目。普通删除不直接清空数据库。
- JSON 导入会替换当前账号的语料库。导入前先导出当前完整备份，替换时不再保留旧库里未出现在备份中的条目。
- 定期导出完整 JSON 备份。免费云服务的可用性与额度以官方当前政策为准。

## 本地开发（可选）

安装 Node.js 22.13 或更高版本，在本目录执行：

```bash
npm ci
```

复制 `.env.example` 为 `.env.local`，填入自己的两个公开配置值，再执行：

```bash
npm run dev
```

构建与测试：

```bash
npm test
npm run build
```

构建产物在 `dist`，也可以上传到其他支持 HTTPS 的静态网站托管平台。需要更换托管平台时，Supabase 数据可以继续保留，只需更新 Auth 的网址配置。

## 已完成的验证与待完成的验证

已在本地 PostgreSQL 兼容环境验证账号隔离、匿名访问拒绝、保存、旧版本冲突、原子替换、回收站恢复、脚本重复执行，以及前端增量保存逻辑；生产构建已通过。

尚未接入你的真实 Supabase 项目和 GitHub 仓库。真实邮箱登录、邮件发送和跨设备同步需在你配置后按第7步完成最终检查。

## 词库来源

ECDICT：<https://github.com/skywind3000/ECDICT>，MIT License。使用版本见 `public/ecdict/ab22ad36302c/metadata.json`，许可证位于相同目录的 `LICENSE.txt`。

官方部署资料：

- <https://vite.dev/guide/static-deploy#github-pages>
- <https://supabase.com/docs/guides/auth/passwords>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
