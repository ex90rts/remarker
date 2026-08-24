# Remarker PRD - 第一版需求

## 1. 背景

用户在阅读英文技术文档、博客、论文 HTML 页面时，同时有两个学习目标：

- 理解原文描述的技术内容。
- 收集英文学习语料，包括单词、短语、句子和上下文。

当前流程需要频繁切换到笔记工具或词典，导致阅读过程被中断。Remarker 第一版要把“选中、复制、高亮、解释、发音、保存、足迹、管理”放到浏览器当前页面、Popup 和本地管理页里完成。

## 2. 第一版目标

做一个本地安装的 Chrome Manifest V3 插件，用于普通 HTML 文档页面上的文本选中、复制、高亮、单词/短语解释、发音、足迹沉淀和学习数据管理。

第一版不以 Chrome Web Store 上架为目标。

## 3. 非目标

第一版不做：

- PDF 支持。
- Google Docs、Notion、在线编辑器、复杂 iframe、虚拟滚动页面支持。
- 云同步。
- Markdown 导入。
- 插件快捷键。
- Chrome Web Store 上架材料。
- API key 自定义加密。
- 侧边栏。

## 4. 技术栈

- Vite + TypeScript。
- 管理页：React + Material UI。
- Popup：原生 HTML/CSS/TypeScript。
- Content script：原生 DOM + Shadow DOM + CSS。
- Service worker：TypeScript。
- IndexedDB 为主存储。
- `chrome.storage.local` 只做启动缓存。

## 5. 分包要求

管理页和页面注入逻辑必须物理分包。

- 普通页面只加载 content script 资源。
- 管理页打开时才加载 React、Material UI、Emotion。
- content script 和 popup 禁止 import `@mui/*`、`react`、`react-dom`、`@emotion/*`。

验收标准：

- 打开普通网页时，content script bundle 不包含 MUI、React、ReactDOM、Emotion。
- 只有打开管理页时才加载 MUI 相关资源。

## 6. 页面交互

用户在页面上选中文字后显示浮动工具栏。

单词 selection：

- 复制。
- 发音。
- 解释。
- 解释成功后自动保存为生词记录。

非单词 selection：

- 复制。
- 解释短语/句子。
- 选择颜色高亮。

单词识别规则：

```txt
^[A-Za-z]+(?:[-'][A-Za-z]+)?$
```

解释请求必须由用户点击触发，不自动调用模型。

解释结果显示在页面浮层，不跳转管理页，不做侧边栏。

Popup 快捷配置：

- 启用全局页面划线和查词。
- 启用当前站点划线和查词；全局关闭时该项禁用。
- 将当前页面加入足迹。
- 打开管理页面。

全局/站点启停切换后，当前页面应直接生效，不要求用户刷新页面。

## 7. LLM 接入

第一版使用 OpenAI-compatible 配置：

- `baseUrl`
- `apiKey`
- `model`
- `temperature`
- `timeoutMs`

content script 只发送消息；service worker 读取配置并发请求。API key 不进入 content script，不写入页面 DOM。

查词结果持久化：

- 单词查词记录和结果统一保存到 `vocabulary`。
- `vocabulary.cacheKey` 用于同一来源页内的查词结果复用，key 由 `selectionKind + selectedText + contextHash + urlKey + model + promptTemplate + targetLanguage` 生成。
- `vocabulary.urlKey` 使用源页面 URL 去除 hash 后的规范化结果，用于页面恢复和足迹统计。
- 命中 `vocabulary.cacheKey` 时直接展示已有查词结果。
- 支持重新生成。
- 不再维护独立的 `explanations` 表。

短语/句子翻译结果不绑定高亮记录，也不做持久化保存。

单词查词记录用于恢复页面上的生词下划线。恢复时先使用保存的 anchor 匹配；anchor 失效或出现多个候选时，使用保存的上下文句子做二次定位和消歧。

## 8. 发音

发音服务优先级：

1. Merriam-Webster API，用户在设置页填免费 API key。
2. Free Dictionary API，无 key 备用。
3. 浏览器 `speechSynthesis` 兜底。

生词保存不依赖 LLM 成功。翻译可以为空，后续在管理页补充。

## 9. 高亮

只支持普通 HTML 文档页面。

支持：

- 同一 block 内高亮。
- 跨 block selection 复制。
- 跨 block selection 分段高亮。
- 刷新后恢复。
- 删除高亮。
- 修改颜色。
- 管理页打开来源。
- 精准滚动到某条高亮只做尽力实现，不作为核心验收标准。

高亮记录保存：

- 原文。
- URL key。
- 页面标题。
- 前后上下文。
- anchor 信息。
- 颜色。
- 创建时间。
- 恢复状态。

恢复状态：

- `active`：已恢复。
- `not_found`：当前页面没找到匹配文本。
- `ambiguous`：找到多个候选，未自动插入。

恢复原则：宁可不插入，也不插到错误位置。

## 10. URL key

保存高亮时使用规范化后的 URL：

- 去掉 hash。
- 保留 query。
- host 小写。
- 去掉末尾无意义 `/`。
- `http` 和 `https` 视为不同来源。
- 第一版不自动清理 `utm_*`。

足迹以规范化后的 URL key 作为唯一键。同一源页面 URL 不重复记录。

## 11. 足迹

足迹用于集中展示已经发生阅读行为或用户手动加入的页面。

进入足迹的方式：

- 用户在页面上保存划线。
- 用户在页面上查词并生成单词解释。
- 用户在 Popup 中手动点击“加入足迹”。

足迹字段：

- URL key。
- 页面标题。
- 站点名称。
- 创建时间。
- 星标状态。
- 归档时间。

管理页展示字段：

- 页面标题。
- 站点名称。
- 创建时间。
- 划线数量。
- 生词数量。
- 操作。

操作：

- 星标：类似 Gmail 星标，用于强调记录。
- 归档：软删除标记，归档后不在当前足迹列表展示，需要二次确认。

足迹列表按创建时间倒序排列，最后加入的页面显示在最前面。

## 12. 存储

IndexedDB 保存：

- 设置。
- OpenAI-compatible 配置。
- Merriam-Webster API key。
- 足迹记录。
- 高亮记录。
- 生词记录。
- 高亮恢复状态。
- 站点设置。
- UI 偏好。
- 导入导出元信息。

`chrome.storage.local` 保存：

- `globalEnabled`
- `disabledSites`
- `schemaVersion`

以 IndexedDB 为准。缓存不一致时重建 `chrome.storage.local`。

## 13. 管理页

管理页使用 5 个 Tab：

- `Footprints`
- `Highlights`
- `Vocabulary`
- `Settings`
- `About`

`Settings` 包含：

- LLM 配置。
- Merriam-Webster API key。
- 默认高亮颜色。
- 站点启停列表。
- JSON 导入/导出。
- Markdown 导出。

全局启用状态属于 Popup 快捷配置，不在 Settings 的偏好区重复展示。

JSON 导出支持完整备份，支持导入。默认不包含 API key，除非用户显式勾选敏感配置。

Markdown 只用于阅读和复习导出，不支持导入。

## 14. 权限

第一版开发阶段使用较宽页面匹配权限，通过插件内部开关控制实际运行。

插件需要：

- 在普通 HTML 页面监听 selection。
- 注入浮动工具栏。
- 恢复高亮。
- 调用用户配置的 LLM 服务。
- 调用 Merriam-Webster 和 Free Dictionary 发音服务。
- 打开管理页。

## 15. 安全与隐私

第一版不做自定义加密。

- API key 本地明文存在扩展 IndexedDB。
- API key 不进入 content script。
- API key 不进入页面 DOM。
- API 请求由 service worker 发起。
- 设置页输入框默认 password 类型。
- JSON 导出默认排除 API key。
- 用户显式勾选后才导出敏感配置。

## 16. 测试策略

单元测试：

- URL key 规范化。
- 单词识别。
- selection 类型判断。
- 高亮 anchor 生成和匹配。
- IndexedDB repository CRUD。
- LLM cache key。
- JSON 导入导出 schema 校验。

手工验收：

- 普通 HTML 页面选词显示单词工具栏。
- 选句显示高亮工具栏。
- 复制成功。
- 高亮刷新后恢复。
- 删除/改颜色生效。
- 发音 fallback 可用。
- LLM 设置后可解释。
- popup 全局/站点开关生效。
- popup 加入足迹后管理页可见，再打开同页面按钮显示已加入。
- 足迹星标、归档、按创建时间倒序排序生效。
- 管理页查看、筛选、导入、导出可用。
