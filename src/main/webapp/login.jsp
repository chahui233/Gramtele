<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<head>

    <title>用户登录</title>
    <link rel="stylesheet" href="css/style.css">
</head>

<body>



<div class="container">
    <h2>🎤 登录聊天室</h2>
    <%-- 显示错误提示 --%>
    <p class="msg">
        <% String msg = (String) request.getAttribute("msg");
            if (msg != null) { %>
        <%= msg %>
        <% } %>
    </p>
    <%
        String loginMessage = (String) request.getAttribute("loginMessage");
        if (loginMessage != null) {
    %>
    <div class="error-msg"><%= loginMessage %></div>
    <%
        }
    %>

    <form method="post" action="login">
        <input type="text" name="username" placeholder="请输入用户名" required>
        <input type="password" name="password" placeholder="请输入密码" required>
        <input type="submit" value="登录">
    </form>
    <a href="register.jsp">还没有账号？立即注册</a>
</div>

</body>
</html>
