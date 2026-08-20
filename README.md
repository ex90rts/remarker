[简体中文](README.md) | [English](README_EN.md)

# ReMarker — AI 阅读助手与生词积累工具

ReMarker 是一个 Chrome 浏览器扩展，面向网页深度阅读和外语学习的用户。在浏览文章时，可以随时选中文本后进行复制、搜索、发音、查词、翻译、记笔记或划线等操作，可以在管理页面统一管理由此产生的划线、笔记、生词、翻译和页面足迹数据，同时提供基于遗忘曲线的生词间隔复习功能。

<div align="center">安装到浏览器 <a href="https://chromewebstore.google.com/detail/remarker/hdmpdmamklhjagiogicgcfcdpfiilecn" target="_blank">Chrome Web Store</a></div>

<br />

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-01.webp" alt="ReMarker 网页阅读工具" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

<br />

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-04.webp" alt="ReMarker 管理页面" width="80%" style="border: 1px solid #ddd; padding: 4px; display: inline-block; border-radius: 4px;">
</div>

## 功能

- 阅读工具栏：支持复制或使用 Google 搜索选中内容；对词语发音、查词；对长文本翻译或使用五种颜色划线。
- 上下文 AI：通过 OpenAI-compatible 模型，结合页面上下文解释词语或翻译文本；结果会以流式方式实时显示。
- 划线与笔记：复访页面时恢复划线，可修改颜色、添加笔记，并在管理页集中查看和维护。
- 生词与翻译：查词结果自动进入生词本，翻译记录单独管理；复访页面时恢复生词下划线，并支持再次发音。
- 间隔复习：使用翻转卡片复习到期生词，并按“生疏 / 犹豫 / 熟练”自评，自动安排下次复习；扩展角标和 Popup 会显示待复习数量。
- 学习活动：查看最近六个月的划线、生词和翻译活动，以及今日复习进度。
- 页面足迹：集中管理划线过、查词过或手动加入的页面，支持筛选、星标、归档和重新打开。
- 导出与备份：划线、生词和翻译可导出为 Obsidian 或 Notion Markdown；支持导入完整 JSON 备份，以及全量和增量 JSON 导出。默认排除敏感配置。
- 阅读控制：支持全局或按站点启用 ReMarker、控制复制后是否关闭查词面板；网页工具栏和面板会跟随系统深色模式。
- 多语言界面：支持英语、简体中文、繁体中文和西班牙语；界面语言也会作为 AI 结果的目标语言。

## 设置功能

设置页面提供：

- 使用偏好设置：界面语言、默认划线颜色、列表分页数量等。
- 基于 BYOK 模式的大模型配置（BYOK=Bring Your Own Key，即插件本身不提供大模型服务，你需要自己配置 API key 和模型配置）。
  - DeepSeek、OpenRouter、Gemini、智谱 AI / GLM、阿里百炼和字节火山引擎预设，以及自定义 OpenAI-compatible 接口。
  - 每个服务商独立的 API key 和模型配置、请求温度与超时时间，以及连接测试。
  - 查词和翻译两套独立的 Prompt 模板。
- 支持导出和导入 JSON 进行备份或数据迁移。

## 数据与隐私

ReMarker 将长期阅读数据和设置保存在本地 IndexedDB 中，并使用 Chrome 本地存储保存轻量的启动和站点状态；目前不包含在线同步。

API key 仅由扩展的 service worker 使用，不会写入页面 DOM，也不会被发送到任何第三方服务器。发起 AI 查词或翻译时，选中文本和周边上下文会发送到你配置的服务商。JSON 导出只有在你明确选择包含敏感配置时才会导出 API key。

## 技术栈

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI 管理页面
- Plain TypeScript + Shadow DOM 网页脚本
- IndexedDB 与 Chrome 本地存储
- Vitest

## 二次开发

如果现有功能有任何问题或你有任何建议，欢迎提交 Issue 或 Pull Request。也欢迎 Fork 后进行二次开发，一般 Vibe Coding 基于项目的 AGENTS.md 可以只关心具体功能即可。一些可供手动执行的命令如下：

```sh
# 按照依赖，需要本地有 Node.js 18+ 环境
npm install

# 代码格式检查
npm run typecheck

# 构建
npm run build
```

构建产物输出到 `dist/`。打开 Chrome 扩展管理页并启用开发者模式，选择“加载已解压的扩展程序”，然后选择该目录即可重载扩展程序。

## 开发计划

- 在不同设备间同步划线、生词和设置。
