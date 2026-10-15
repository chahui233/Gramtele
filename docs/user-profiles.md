# 头像、个性签名、资料卡和登录 IP

部署新代码前，在 `yytf_support` 数据库执行 `db/user-profiles.sql`。项目实际表名是 `users`。脚本只补充缺失的列，可重复执行，保留原有数据：

```sh
mysql -h127.0.0.1 -u yytf_support -p yytf_support < db/user-profiles.sql
```

需要执行账号具备该表的 ALTER 权限；也可以在数据库管理工具中选中 `yytf_support` 执行脚本。

新增列：

| 列 | 类型 | 用途 |
| --- | --- | --- |
| signature | VARCHAR(200) NOT NULL DEFAULT '' | 选填个性签名，留空保存即可清除 |
| ipaddress | VARCHAR(45) NULL DEFAULT NULL | 最近一次成功登录的 IPv4 或 IPv6 地址 |

已有用户的 IP 初始为 NULL，下一次登录成功后记录。登录失败、账号被禁用均不会更新 IP。后台读取 `request.getRemoteAddr()`，不会直接相信客户端提交的 `X-Forwarded-For`。若前方有 Nginx、负载均衡或 CDN，需由管理员正确配置 Tomcat 的可信代理（例如 RemoteIpValve），否则此列记录的是代理地址。不要删除或覆盖现有 `server.xml`；本次代码未修改服务器配置。

留言板显示发布人的头像和昵称；聊天好友栏的头像随状态更新。未设置或加载失败的头像使用默认图片。点击留言板、群聊、私聊和好友栏的他人头像可打开资料卡，显示名称、头像及签名。资料卡只返回公开字段，不返回 IP、密码或账户管理信息。好友申请仍须对方同意；已是好友、已发申请和待处理申请分别显示对应状态。

个性签名在个人中心修改，最多 200 个 UTF-16 单元（与浏览器 maxlength 一致），按纯文本显示并保留换行。资料卡 API 需登录访问，发送好友申请仍使用每次登录生成的 CSRF token。好友请求依赖之前的 `db/friend-requests.sql` 迁移。

聊天输入区用圆形图片图标替代原生文件选择控件。选择后显示文件名并支持移除；发送成功后清空，发送失败保留，支持只发图片。原有图片格式和大小限制保持不变。

本次只修改源码并测试，不生成 WAR；数据库脚本需在服务器另行执行。
