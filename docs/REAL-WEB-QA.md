# 轻译 1.0.1：真实网站复测

时间：2026-10-11 晚至 2026-10-12 凌晨（Asia/Shanghai）。实际运行本机 Comet 139.1.7258.19069，在独立浏览器配置中加载1.0.1 扩展文件，连接 Tokendance 的 `glm-5.3-flash`。本报告中的真实速度均来自线上模型，不使用模拟响应。

## 测试页面

| 页面 | 重点 |
| --- | --- |
| [MDN / Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) | 技术正文、代码名称、列表、三栏布局、导航、深浅色切换 |
| [Wikipedia / Reading](https://en.wikipedia.org/wiki/Reading) | 原文链接、引用编号、浮动侧栏表格、目录与页面宽度 |
| [Paul Graham / The Need to Read](https://paulgraham.com/read.html) | 旧式表格与 font 标签、连续 br 分段、全文划线、注释 |

## 响应速度

划线计时从点击「译」开始，到浮层首次写入非空译文；完成时间到加载状态结束。7 次短段测试关闭缓存，全文划线首次联网、第二次读本地缓存。测量代码运行在页面中，避开自动化工具轮询延迟。

| 来源 | 原文字符 | 首字 | 完成 |
| --- | ---: | ---: | ---: |
| MDN 第 1 段 | 184 | 2.256 秒 | 2.386 秒 |
| MDN 第 2 段 | 410 | 0.980 秒 | 1.450 秒 |
| MDN 带代码段 | 363 | 0.721 秒 | 1.672 秒 |
| Wikipedia 第 1 段 | 189 | 1.987 秒 | 2.435 秒 |
| Wikipedia 第 2 段 | 243 | 0.845 秒 | 1.933 秒 |
| Wikipedia 第 3 段 | 278 | 0.803 秒 | 1.717 秒 |
| Paul Graham 短段 | 504 | 1.370 秒 | 2.936 秒 |
| Paul Graham 全文划线 | 2,435 | 2.156 秒 | 5.755 秒 |
| 同一全文再打开，缓存命中 | 2,435 | 5.5 毫秒 | 5.8 毫秒 |
| MDN 长文工作台 | 7,167 | 0.853 秒 | 9.709 秒 |

7 次短段首字中位数为 **0.980 秒**，完成中位数 **1.933 秒**。这些是当时的网络样本，不能保证每次耗时相同。

长文使用 MDN 的 18 个真实段落，加 Q01–Q18 标识核对完整性，共 6 个请求分块。18 个标识按顺序全部保留；原文输入逐字符不变；没有横向溢出。全文划线输出包含文末两条注释，430 × 700 视口下浮层仍完整留在屏幕内。

## 发现并修好的问题

1. **技术名称被漏掉。** 原规则跳过所有 code 标签，MDN 的行内 `Element.getBoundingClientRect()` 因此没进入请求。现在段落内保留行内代码文本，独立 pre/code 区域仍不自动翻译，显式 `translate=no` 继续生效。真实模型复测保留了该 API 名称。
2. **导航拥挤。** MDN 的面包屑写在全局 header 里，原规则在它的横排列表中插入了 3 段译文。现在排除全局页头和导航控件，保留 main/article 内的文章标题。MDN 面包屑译文数从 3 降至 0。
3. **旧文章不能逐段对照。** Paul Graham 使用 font 和连续 br，而非 p，原先整篇译文落在文章末尾。现在识别连续换行分段，把译文插在相应原段下方；不分割、替换或重新挂载原有文本与链接节点。视口之外仍按需加载。
4. **长文输出跳动。** 原并发实现会提前显示后面的分块，然后不断在前面插入新内容。7,167 字符样本观测到 124 次非末尾增长。现在保留并发请求，只显示连续完成的前缀与当前段，后续结果暂存；同一材料复测为 **0 次**非末尾增长。
5. **切换深色后译文太暗。** 已存在的译文原来固定为创建时的颜色。现在通过继承页面文字颜色和 CSS 混色实时适配，切换无需重译、无需额外 DOM 监听。已在 MDN 的实际主题按钮上双向验证。

## 页面保护与回归

- 三站原有文本节点与链接对象均保留，链接 href 不变；检测的正文、代码块、表格、图片横向位置及宽度没有变化，页面未新增横向滚动。
- 「恢复原文」后，三站译文块与旧式段落定位节点数量均为 0；原有节点仍在，横向几何保持一致。
- 双语段落会正常增加页面高度。并未把这种预期变化认定为排版故障。
- 三站这轮双语首屏观测没有记录到超过 50ms 的主线程 long task；这不是全站性能保证。
- 23 项 Node 核心测试通过；24 项模拟服务浏览器压力/异常测试再次通过；新增 12 项结构回归通过。
- 结构回归覆盖全局导航排除、文章标题保留、行内代码与 opt-out、旧式分段原节点保护、单换行、动态改文、主题跟随及清理。
- 1,000 段压力页仍只处理视口附近内容：1.2 秒观测窗新增 API 请求为 0，13 个译文节点，无超过 100ms 的 long task；60,000 字符经 40 块完成，最大并发不超过 4。这部分使用模拟服务，不作为 GLM 速度指标。

## 复现与截图

使用 `npx --yes --package @playwright/cli playwright-cli`，选择独立测试配置的对应真实页面，再运行 `run-code --filename tests/<脚本名>`。真实站点脚本需要允许访问公网和已配置的 Tokendance 连接；压力与结构脚本使用本机 `scripts/test_server.mjs` 及虚拟密钥。

- `tests/browser-websites.js`：逐段划线计时。
- `tests/browser-layout.js`：双语模式的节点、链接、宽度、长任务及恢复检查；三站按 MDN、Wikipedia、Paul Graham 顺序位于同一测试窗口。
- `tests/browser-live-long.js`：18 个 MDN 段落与流式稳定性。
- `tests/browser-long-selection.js`：全文划线、缓存、窄视口。
- `tests/browser-compatibility.js`：新结构规则的 12 项模拟回归。
- `output/playwright/real-mdn-light-final.png`、`real-mdn-dark-fixed.png`
- `output/playwright/real-en-bilingual.png`、`real-paulgraham-bilingual.png`
- `output/playwright/real-mdn-long.png`、`real-paul-long-selection-narrow.png`

测试覆盖上述三页及独立回归材料，不代表所有英文网站都已验证。
