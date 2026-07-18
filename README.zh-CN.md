[English](README.md) | [简体中文](README.zh-CN.md)

# ReMarker - AI 阅读助手与生词积累工具

ReMarker 是一个本地优先的 Chrome 浏览器插件，面向深度网页阅读、外语学习、上下文 AI 查词和个人学习笔记。它可以在网页中保存划线，调用 OpenAI-compatible 大模型解释生词和短语，自动沉淀生词表，集中管理页面足迹，并在再次访问同一页面时恢复之前的划线和生词标记。

ReMarker 适合学生、研究者、工程师和外语学习者阅读外文文章、技术文档、长文、论文和网页资料时使用。它把理解、摘录、积累和复习放在同一个可重复的阅读流程里。

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-01.webp" alt="截图" width="80%">
</div>

<div align="center">
  <img src="https://ex90rts.github.io/remarker/assets/images/screenshot-04.webp" alt="截图" width="80%">
</div>

## 为什么使用 ReMarker

- 它能让你在阅读英文文章或技术文档时，把难词、短语和表达保存下来方便复习。
- 它把阅读、生词查询和复习连成一个流程，而不是分散在划线工具、词典和笔记软件之间。
- 它根据网页上下文解释单词和短语，答案更贴近当前句子或段落的真实含义。
- 它会把 AI 查词结果自动保存为生词记录，减少手动整理。
- 它会在再次打开页面时恢复划线和生词标记，让网页阅读可以持续积累。
- 它会把划线过、查词过或手动加入的页面集中到足迹列表中。
- 它默认把数据库保存在本地浏览器中，并且导出行为由用户显式触发。

## 核心功能

- 网页划线：在网页中高亮保存重要段落，并在管理页统一查看、筛选、删除和导出。
- 上下文 AI 查词：选中单词或短语后调用 OpenAI-compatible 大模型，根据上下文解释含义。
- 自动生词表：查词结果自动保存为生词记录，包含来源 URL、页面标题、上下文句子和解释。
- 页面复访恢复：再次访问页面时自动恢复之前的划线和生词下划线，并可查看生词解释。
- 足迹：集中查看划线过、查词过或手动加入的页面，展示页面标题、站点名称、创建时间、划线数量、生词数量，并支持星标和归档。
- Popup 快捷配置：快速切换全局页面划线和查词、当前站点划线和查词、查词弹窗复制后自动关闭，支持把当前页面加入足迹并打开管理页面。
- 发音兜底链路：支持 Merriam-Webster、Free Dictionary 和浏览器语音合成兜底。
- 数据导入导出：支持关键数据 JSON 导入导出，以及划线、生词表 Markdown 导出。
- 多语言界面：界面语言同时作为 AI 解释和翻译的目标语言。
- 站点级控制：支持按站点启用或停用 ReMarker，并可配置阅读偏好。

## 安装与本地开发

安装依赖：

```sh
npm install
```

类型检查：

```sh
npm run typecheck
```

运行测试：

```sh
npm test
```

构建扩展：

```sh
npm run build
```

构建产物输出到 `dist/`。本地加载 ReMarker 时，打开 Chrome 扩展管理页，启用开发者模式，选择“加载已解压的扩展程序”，然后选择 `dist/` 目录。

## 配置

在 Settings 页面中配置：

- LLM 服务商预设或自定义 OpenAI-compatible 接口。
- OpenAI-compatible `baseUrl`。
- API key。
- 模型名称。
- `temperature`。
- 请求超时时间。
- Prompt 模板。
- Merriam-Webster API key。
- 默认划线颜色。
- 划线和生词表每页数量。
- 停用站点列表和导入导出偏好。

在插件 Popup 中配置快捷阅读行为：

- 启用全局页面划线和查词。
- 启用当前站点划线和查词。
- 查词弹窗复制后自动关闭。
- 将当前页面加入足迹。

当前服务商预设包括 DeepSeek、OpenRouter、Gemini、智谱 AI / GLM、阿里百炼 / Alibaba DashScope、字节火山引擎 / ByteDance Volcengine，以及自定义 OpenAI-compatible 接口。

Prompt 模板必须包含以下变量：

```txt
{{task}}
{{selection}}
{{context}}
```

## 数据与隐私

ReMarker 是本地优先工具：足迹、划线、生词、翻译记录和设置默认保存在浏览器 IndexedDB 中。LLM API key 只由扩展后台 service worker 读取和使用，不会写入页面 DOM。

当用户主动发起 AI 查词或翻译时，选中文本和周边上下文会发送到用户配置的 LLM 接口，以便模型结合上下文回答。JSON 导出默认不包含敏感配置，只有用户显式勾选后才会导出。

## 常见问题

### ReMarker 是什么？

ReMarker 是一个 Chrome-compatible 浏览器插件，用于网页划线、AI 解释选中的单词或短语、自动保存生词，并在复访网页时恢复阅读笔记。

### ReMarker 适合谁使用？

ReMarker 适合外语学习者、研究者、学生、开发者和高频网页阅读者，把在线阅读变成可搜索、可导出、可复习的学习流程。

### ReMarker 必须配置 AI 服务商吗？

AI 查词和翻译需要配置 OpenAI-compatible 服务商或自定义接口。划线、本地记录和导出流程属于插件自身能力。

### ReMarker 把数据保存在哪里？

ReMarker 默认把应用数据保存在浏览器本地 IndexedDB 中。用户可以按需导出足迹、划线、生词、翻译和部分应用数据。

### ReMarker 支持哪些语言？

界面目前支持英语、简体中文、繁体中文和西班牙语。所选界面语言也会作为 AI 解释和翻译的目标语言。

## 技术栈

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI options page
- Plain TypeScript content script with Shadow DOM
- IndexedDB local storage
- Vitest

## 开发计划

- 加入基于遗忘曲线的生词复习计划，让生词表从“查词记录”进一步变成可持续复习的学习工具。
- 在线同步：支持在不同设备上同步划线和生词表。
