# 实时消息修复（2026-10-10）

此前 chat.jsp 的 WebSocket URL 使用 JavaScript 模板字符串，`${...}` 被 JSP EL 提前解析，导致协议、主机和用户 ID 丢失。现在通过 HTML data 属性传递登录用户和上下文路径，由独立的 js/chat.js 拼接地址，支持 ROOT 和子路径部署，以及 HTTP / HTTPS。

同一账号的每个 WebSocket 连接独立登记；刷新或关闭一个窗口不会移除其他窗口的连接。连接断开后自动重试并补取历史，历史和推送都携带数据库消息 ID，用于排序和去重。WebSocket 不可用时重试过程中也通过 HTTP 同步消息。群聊只显示群消息，私聊只显示当前双方消息。

验证命令：

```powershell
.\mvnw.cmd clean package
node --test src/test/js/chat.test.cjs
```

Java 测试包括本地嵌入式 Tomcat 的真实 HTTP 登录会话、WebSocket 握手、双窗口接收和关闭连接验证；JS 测试使用模拟浏览器环境验证页面消息逻辑。没有连接阿里云数据库或验证服务器反向代理配置。

部署时停止 Tomcat，将修复版 WAR 替换当前使用的 ROOT.war，再启动 Tomcat，重新打开聊天页。本次不需要修改数据库、server.xml 或数据库环境变量。
