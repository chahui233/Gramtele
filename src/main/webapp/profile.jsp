<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil" %>
<%!
    private String escapeHtml(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
%>
<%
    if (session.getAttribute("userId") == null) {
        response.sendRedirect("login.jsp");
        return;
    }

    int userId = (int) session.getAttribute("userId");
    String username = (String) session.getAttribute("username");

    String avatarPath = null;
    String displayName = "";
    String signature = "";

    try (Connection conn = DBUtil.getConnection()) {
        PreparedStatement ps = conn.prepareStatement("SELECT display_name, avatar, signature FROM users WHERE id = ?");
        ps.setInt(1, userId);
        ResultSet rs = ps.executeQuery();
        if (rs.next()) {
            displayName = rs.getString("display_name");
            avatarPath = rs.getString("avatar");
            signature = rs.getString("signature");
        }
        rs.close();
        ps.close();
    } catch (SQLException e) {
        e.printStackTrace();
    }

    // 防止空路径出错
    if (avatarPath == null || avatarPath.trim().isEmpty()) {
        avatarPath = "images/taffy1.jpg"; // 默认头像
    }
    if (displayName == null) {
        displayName = "";
    }
%>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>个人中心</title>
    <style>
        body {
            font-family: Arial;
            background: #f4f4f4;
            padding: 50px;
        }
        .profile {
            background: white;
            padding: 30px;
            border-radius: 8px;
            max-width: 400px;
            margin: auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .profile h2 {
            margin-bottom: 20px;
        }
        .profile input[type="text"], .profile input[type="file"], .profile textarea {
            box-sizing: border-box;
            width: 100%;
            padding: 8px;
            margin-bottom: 15px;
        }
        .profile input[type="submit"] {
            background-color: #0088cc;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
        }
        .avatar {
            text-align: center;
            margin-bottom: 20px;
        }
        .avatar img {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
        }
        .profile textarea { font:inherit; resize:vertical; min-height:80px; border:1px solid #ccc; border-radius:8px; }
        .profile .field-note { margin:0 0 15px; font-size:12px; color:#666; }
        @media(max-width:600px) { body { padding:50px 12px 20px; margin:0; } .profile { padding:20px; } }
    </style>
</head>
<body>
<div style="position: fixed; top: 10px; left: 10px; z-index: 999;">
    <button onclick="location.href='<%= request.getContextPath() %>/home.jsp'" style="padding: 6px 12px; font-size: 14px; border-radius: 5px; border: none; background-color: #4CAF50; color: white; cursor: pointer;">
        ← 返回
    </button>
</div>
<div class="profile">
    <h2>个人资料</h2>
    <%@ include file="WEB-INF/jspf/message-alerts.jspf" %>
    <div class="avatar">
        <img src="<%= escapeHtml(avatarPath) %>" alt="头像">
    </div>
    <form action="UpdateProfileServlet" method="post" enctype="multipart/form-data">
        <label>登录用户名：</label><br>
        <input type="text" value="<%= escapeHtml(username) %>" disabled><br>

        <label>昵称：</label><br>
        <input type="text" name="displayName" value="<%= escapeHtml(displayName) %>" required maxlength="50"><br>

        <label for="profileSignature">个性签名（选填）：</label><br>
        <textarea id="profileSignature" name="signature" rows="3" maxlength="200" placeholder="介绍一下自己吧"><%= escapeHtml(signature) %></textarea>
        <p class="field-note">最多200字，留空即可清除签名。</p>

        <label>更换头像：</label><br>
        <input type="file" name="avatar" accept="image/*"><br>

        <input type="submit" value="保存修改">
    </form>
</div>

</body>
</html>
