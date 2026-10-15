# Emoji 清单

本目录保存 Unicode 官方清单和 CLDR 简体中文注释，供离线重建使用。运行时只需 `src/main/webapp/js/emoji-data.json`，浏览器不访问 Unicode 或 GitHub。

- `emoji-test.txt`：https://www.unicode.org/Public/emoji/latest/emoji-test.txt ，文件声明版本 18.0，日期 2026-04-30。
- `cldr-zh.xml`：https://raw.githubusercontent.com/unicode-org/cldr/7cdeb9e7fac52c59f22fc7248b05f989ee5689c2/common/annotations/zh.xml
- `cldr-zh-derived.xml`：https://raw.githubusercontent.com/unicode-org/cldr/7cdeb9e7fac52c59f22fc7248b05f989ee5689c2/common/annotationsDerived/zh.xml
- `LICENSE.txt`：Unicode License V3，来自 https://www.unicode.org/license.txt 。重建时一并复制到发布目录的 `emoji-data.LICENSE.txt`。

只保留 `fully-qualified`（3,963 个标准序列）和 `component`（9 个组件），不重复列出同一 emoji 的 `minimally-qualified` / `unqualified` 表现形式。肤色、发型、性别、家庭和旗帜等组合保持完整 Unicode 序列。名称和关键词来自简体中文 CLDR 与官方英文名称，同时保留原有 30 个表情的中文别名。

在项目根目录运行（仅使用 Node 内置模块）：

```powershell
node tools/emoji/build-catalog.cjs
node --test src/test/js/emoji-catalogue.test.cjs
```

更新清单时，一并更新来源版本、CLDR 提交号、页面中 JSON 的缓存版本和相应文档。选择器通过 `emoji-support.js` 的 Canvas 字形探测，比较缺字符号、空白、组合宽度及拆分后的渲染结果，隐藏当前设备不支持的项；检测分批进行，不一次阻塞整份清单，完整清单始终保留。浏览器未提供标准的 emoji 支持查询接口，因此这是基于本机渲染的检测，字体替换或严格的 Canvas 隐私保护可能影响检测结果。本项目不会将组合序列拆成单个字符插入，也不为缺失的系统字形下载外部图片。
