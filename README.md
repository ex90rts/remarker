# Remarker

Remarker 是一个面向外文学习和深度阅读的浏览器插件。它把划线记录、AI 查词、自动生词沉淀和页面复访恢复放在同一个阅读流程里：读到精彩内容时可以直接高亮保存，遇到生词时可以调用 AI 大模型结合上下文解释并自动加入生词表。再次打开同一页面时，之前的划线和生词标记会自动恢复，让阅读、理解、积累和复习自然连在一起。

## 核心功能

- 页面划线：在网页中高亮保存重要段落，并在管理页统一查看、筛选、删除和导出。
- AI 查词：选中单词后调用 OpenAI-compatible 大模型，根据上下文解释含义。
- 自动生词表：查词结果自动保存为生词记录，不需要再手动加入。
- 页面恢复：再次访问页面时自动恢复之前的划线和生词下划线，并可查看生词解释。
- 发音：支持 Merriam-Webster、Free Dictionary 和浏览器语音合成兜底。
- 数据管理：支持关键数据的 JSON 导入导出，以及划线、生词表 Markdown 导出。
- 多语言界面：界面语言同时作为大模型翻译的目标语言，目前支持：中文简体/中文繁体/英语/西班牙语。

## 技术栈

- Vite + TypeScript
- Chrome Manifest V3
- React + Material UI options page
- Plain TypeScript content script with Shadow DOM
- IndexedDB local storage
- Vitest

## 本地开发

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

构建产物输出到 `dist/`。在 Chrome 扩展管理页中启用开发者模式后，可以加载该目录进行本地调试。

## 配置

在管理页的 Settings 中配置：

- OpenAI-compatible `baseUrl`
- API key
- 模型名称
- temperature
- 请求超时时间
- Prompt 模板
- Merriam-Webster API key
- 默认划线颜色
- 划线和生词表每页数量
- 站点启停和导入导出偏好

Prompt 模板必须包含以下变量：

```txt
{{task}}
{{selection}}
{{context}}
```

## 数据与隐私

Remarker 默认把数据保存在浏览器本地 IndexedDB 中。LLM API key 只由扩展后台 service worker 读取和使用，不会写入页面 DOM。JSON 导出默认不包含敏感配置，只有用户显式勾选后才会导出。

## 开发计划

- 后续计划加入基于遗忘曲线的生词复习计划，让生词表从“查词记录”进一步变成可持续复习的学习工具。
- 在线同步：支持在不同设备上同步划线和生词表。
