# Launch kit / 推广方案

Status: copy and rollout plan prepared; no posts, outreach, or paid campaigns have been sent. Repository: https://github.com/ZJUZhiyuCai/quiet-translate

## 定位

一句话：**一个安静的、自带 API 的开源双语阅读插件，原文在上，译文在下。**

English: **An open-source bilingual reading extension that stays out of the way. Bring your own API.**

首批适合的人：经常读英文技术文档和长文、已有 API 账户、愿意安装开发版的开发者、研究者和语言学习者。当前 Firefox 临时安装和浏览器开发者模式有门槛，先服务愿意反馈的种子用户；有正式商店安装入口后，再面向更广泛人群。

## 他山之石，具体怎么用

[Immersive Translate](https://immersivetranslate.com/en/) 展示了双语上下文、划线和悬停入口的价值；[TWP](https://github.com/FilipePS/Traduzir-paginas-web) 提供了成熟网页翻译工作流的参考。借鉴的是让原文可核对、减少切换、按需出现这些交互原则。轻译本轮重点是清晰的 API 自主配置、可审查代码和可复现的页面保护测试，不用未经验证的“全面超越”来宣传。

## 推广顺序

| 阶段 | 具体动作 | 完成标准 |
|---|---|---|
| 0 · GitHub 首发 | README 首屏展示双语阅读、划线图；Release 提供两包与校验值；连接配置和限制写清楚 | 陌生人能跟说明装好，并知道费用和数据流向 |
| 1 · 小范围验证 | 由维护者邀请愿意测试的人，在两周内自愿反馈一次安装与一次真实阅读体验 | 目标是 10 份可复现反馈，先修安装/排版/响应问题；不以 Star 数代替可用性 |
| 2 · 中文技术社区 | 选择一个合适渠道发完整体验帖，如 V2EX 的适当节点或掘金技术文章；先确认当时的自荐规则 | 一篇带演示、安装路径、限制和测试方法的文章；认真回应每一个具体 bug |
| 3 · 英文技术社区 | 提交 Show HN，准备技术实现、隐私边界、真实速度和失败案例的说明 | 提交可尝试的项目，按 [Show HN 规则](https://news.ycombinator.com/showhn.html)交流，不拉票、不重复刷屏 |
| 4 · 扩大触达 | 商店审核通过后，再制作普通用户的一分钟安装演示，考虑 Product Hunt、教程作者和相关开源列表 | 安装无需开发者模式，跨平台支持有对应证据；按各渠道当时规则发布 |

以上是工作计划和目标，不是已经获得的用户、评价或曝光。没有自动发帖、群发私信、买量或邀星安排。商店发布需维护者的正式开发者账户及审核。

## 30 秒演示脚本

使用仓库自己的 `tests/fixtures/article.html`，不展示个人标签页、密码管理器或 API 设置中的真实密钥。

| 时间 | 画面 | 字幕 |
|---|---|---|
| 0–5 秒 | 英文文章原貌，启用双语阅读 | 原文留在眼前，译文恰好在下面 |
| 5–12 秒 | 段落下出现译文，原链接可点击 | 保留页面，跟着阅读翻译 |
| 12–20 秒 | 拖选一段 → 小按钮 → 流式卡片 | 需要时才出现 |
| 20–26 秒 | 展开到长文工作台，左右保留原译文 | 长段也能顺着读 |
| 26–30 秒 | 恢复原文，再展示项目地址 | 开源 · 自带 API · 无遥测 |

演示不要快放冒充实时响应。缓存命中与首次联网分别标注；如果压缩等待时间，字幕写明“等待已缩短”。仓库截图来自自编文章及模型实际译文，不能当作外部用户背书。

## 中文发布文案

**标题：做了一个安静的开源翻译插件：原文保留，译文在下面，API 自己填**

读英文资料时，我希望翻译能贴着原文出现，查完就继续读。轻译把交互收敛成三件事：网页双语、划线小浮层、长文工作台。

它支持自己填写 OpenAI 兼容 API，也能连接本地模型；没有常驻悬浮球，没有项目中转服务或遥测。译文按需加载，长段自动拆分，显示顺序保持稳定，原文和链接保留。

本轮在 Chrome、Edge、Comet、Firefox 做了实际回归，涵盖 60,000 字符长文、千段网页、取消、错误处理和原 DOM 保留。另有 MDN、Wikipedia、Paul Graham 的真实服务样本，逐项数据放在仓库，模型和网络会影响速度。

这是第一个公开版本。当前通过解压加载安装，Firefox 包还未签名，重启后需要重新临时加载；Safari 和移动端还没验证。API 费用由自己的服务账户承担。

项目与安装包：https://github.com/ZJUZhiyuCai/quiet-translate

欢迎带上浏览器版本和公开复现页面反馈排版或交互问题。比“功能越多越好”，我更想先把每天阅读时的细节做好。

## English launch copy

**Title:** Show HN: Quiet Translate – bilingual reading with your own API

Quiet Translate keeps the original passage on the page and places its translation just below. Select text for a small streaming card, hold Alt over a paragraph, or use a workspace for up to 60,000 characters.

It uses your OpenAI-compatible API or localhost model. There is no project account, translation proxy, telemetry, or runtime dependency. Requests are scheduled with capacity reserved for selections; long-text chunks display in order and can be cancelled. The code includes fixture tests for original DOM preservation, long text, streaming errors, and credential boundaries.

I have run this release in Chrome, Edge, Comet, and Firefox on Windows. It is an early public release: Chromium installs unpacked, Firefox is currently an unsigned temporary add-on, and Safari/mobile are not validated. API usage is billed by your own provider.

Code, packages, privacy details, and measurements: https://github.com/ZJUZhiyuCai/quiet-translate

I would particularly appreciate reproducible examples where the bilingual layout breaks or the selection interaction gets in the way.

## 成效怎么判断

优先看自愿反馈里的安装成功率、首次连接卡在哪里、同一个页面能否稳定恢复、用户是否愿意继续用。记录 GitHub 发布包下载、有效问题和社区贡献作为辅助信号。不要安装隐形分析 SDK 来追踪用户；不要虚构下载量、用户评价或“比某产品快几倍”。

下一次发帖应有一个可验证的新进展，例如 Firefox 正式签名、修复某类站点、或完成 macOS 验证。公开讲清复现过程，比反复发布同一段广告更有价值。
