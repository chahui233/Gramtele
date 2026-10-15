# 聊天滚动、分页和无刷新发送修复（2026-10-12）

本次仅修改代码和运行测试，不生成 WAR，不修改数据库或 Tomcat 配置。

## 行为和原因

- 图片之前没有固定高度，下载完成会改变消息高度；旧的 `load` 回调只在下载完成后拉回底部，还可能打断用户向上阅读。现在消息图片在下载前就预留 200×200 的预览区域，完整显示在框内；取消加载后的强制滚动，进入聊天时直接定位到底部。前插旧记录以当前可见消息为锚点保留阅读位置。
- 原先每次增量同步都会用返回条数覆盖 `hasMoreOlder`，空结果会禁止后续加载历史。现在初始页、向前翻页和增量同步各自维护状态；接口多查一条记录，通过 `X-Has-More` 返回是否还有下一页。每页 30 条，已读完不会反复查询空页；无滚动条时也可以点击顶部按钮加载更多。
- 去掉所有常规历史同步/加载提示，错误信息单独显示且不挤占聊天区高度。脚本 URL 带版本号，页面更新后会请求新脚本，避免浏览器沿用旧版缓存。连接状态与真实错误仍显示。
- 前端拦截表单提交，使用 `FormData` 上传文字/图片；`ChatServlet` 对请求头 `Accept: application/json` 返回 201 和已保存消息，不再重定向。HTTP 确认和 WebSocket 推送用同一条消息 ID 去重，即使 WebSocket 不通也能显示自己的消息。发送过程中禁止重复提交，失败保留草稿，不自动重发 POST；超时会提示消息可能已送达。

## 测试

```powershell
.\mvnw.cmd -B test
node --test src/test/js/*.test.cjs
```

Java 测试包含 H2 MySQL 兼容模式的真实 SQL 执行（并非生产 MySQL）、Jasper 编译页面，以及群聊/私聊发送 JSON 响应。JS 单元测试包含分页状态、超时重试、浏览器返回、发送去重和草稿保留。

浏览器测试需要可供 Node `require('playwright')` 使用的 Playwright 包和 Chromium 浏览器。先运行 Java 测试，生成 `target/browser-chat.html` 与 `target/browser-private-chat.html`；这两个文件是 Jasper 实际渲染的页面，浏览器测试直接使用它们及当前源码 JS/CSS：

```powershell
# 使用已安装的 Edge；也可省略该变量，使用 Playwright 安装的 Chromium。
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node --test src/test/browser/chat.browser.test.cjs
```

若使用外部安装的 Playwright，可将 `NODE_PATH` 设为该安装的 `node_modules` 目录。本机验证使用 Codex 配套的 Playwright 和无界面 Edge。

三项浏览器测试验证：延迟下载图片前后滚动位置与高度不变；空增量同步后滚动到顶部连续加载两页旧记录、旧图片延迟加载保持阅读位置、普通通知始终隐藏；同一私聊页面发送文字/图片不导航、推送与确认不重复、发送失败保留草稿。浏览器测试模拟 HTTP/WebSocket 数据，不访问阿里云服务器。
