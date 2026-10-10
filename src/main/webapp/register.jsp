<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<head>
    <title>注册账号</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="container">
    <h2>注册</h2>
    <%-- 显示提示信息 --%>
    <p class="msg">
        <% String msg = (String) request.getAttribute("msg");
            if (msg != null) { %>
        <%= msg %>
        <% } %>
    </p>

    <form method="post" action="register">
        <input type="text" name="username" placeholder="请输入用户名" required>
        <input type="password" name="password" placeholder="请输入密码" required>
        <input type="submit" value="注册">
    </form>
    <a href="login.jsp">已有账号？去登录</a>
</div>

</body>
</html>
