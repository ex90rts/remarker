[English](README.md) | [简体中文](README.zh-CN.md)

# ReMarker — AI 阅读助手与生词积累工具

ReMarker 是一个本地优先的 Chrome 浏览器扩展，面向网页深度阅读和外语学习。选中文本后可以复制、搜索、发音、查词、翻译或划线，并统一管理由此产生的划线、笔记、生词、翻译和页面足迹。

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

## 本地开发

```sh
npm install
npm run typecheck
npm test
npm run build
```

构建产物输出到 `dist/`。打开 Chrome 扩展管理页并启用开发者模式，选择“加载已解压的扩展程序”，然后选择该目录。

## 配置

Settings 页面提供：

- DeepSeek、OpenRouter、Gemini、智谱 AI / GLM、阿里百炼和字节火山引擎预设，以及自定义 OpenAI-compatible 接口。
- 每个服务商独立的 API key 和模型配置、请求温度与超时时间，以及连接测试。
- 查词和翻译两套独立的 Prompt 模板。
- 可选的 Merriam-Webster API key、默认划线颜色、界面语言和列表分页数量。

每套 Prompt 模板都必须包含：

```txt
{{selection}}
{{context}}
```

发音会依次尝试 Merriam-Webster、Free Dictionary 和浏览器语音合成；可用的发音数据会缓存在本地。

## 数据与隐私

ReMarker 将长期阅读数据和设置保存在本地 IndexedDB 中，并使用 Chrome 本地存储保存轻量的启动和站点状态；目前不包含在线同步。

API key 仅由扩展的 service worker 使用，不会写入页面 DOM。发起 AI 查词或翻译时，选中文本和周边上下文会发送到你配置的服务商。JSON 导出只有在你明确选择包含敏感配置时才会导出 API key。

## 技术栈

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI 管理页面
- Plain TypeScript + Shadow DOM 网页脚本
- IndexedDB 与 Chrome 本地存储
- Vitest

## 开发计划

- 在不同设备间同步划线、生词和设置。
