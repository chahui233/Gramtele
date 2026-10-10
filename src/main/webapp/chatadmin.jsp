<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="java.sql.*, com.example.yytfsupportsite.yytf.util.DBUtil" %>
<%
    Connection conn = DBUtil.getConnection();
%>

<html>
<head>
    <title>聊天管理员</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f8f9fa;
            padding: 30px;
        }
        h1 {
            text-align: center;
            color: #d40000;
            margin-bottom: 30px;
        }
        table {
            border-collapse: collapse;
            width: 90%;
            margin: 20px auto;
            background: white;
            box-shadow: 0 0 8px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: center;
        }
        th {
            background-color: #ff6b6b;
            color: white;
        }
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        .ban { background: #ff5c5c; color: white; }
        .unban { background: #4caf50; color: white; }
        .restore { background: #007bff; color: white; }
        .delete { background: #444; color: white; }
    </style>
</head>
<body>
<h1>聊天管理员</h1>

<!-- 用户管理 -->
<h2 style="text-align:center;">用户管理</h2>
<table>
    <tr><th>用户名</th><th>昵称</th><th>状态</th><th>操作</th></tr>
    <%
        PreparedStatement ps = conn.prepareStatement("SELECT id, username, display_name, is_banned FROM users");
        ResultSet rs = ps.executeQuery();
        while (rs.next()) {
    %>
    <tr>
        <td><%= rs.getString("username") %></td>
        <td><%= rs.getString("display_name") %></td>
        <td><%= rs.getBoolean("is_banned") ? "禁言中" : "正常" %></td>
        <td>
            <form method="post" action="vadminServlet" style="display:inline;">
                <input type="hidden" name="userId" value="<%= rs.getInt("id") %>">
                <input type="hidden" name="action" value="<%= rs.getBoolean("is_banned") ? "unban" : "ban" %>">
                <button class="<%= rs.getBoolean("is_banned") ? "unban" : "ban" %>">
                    <%= rs.getBoolean("is_banned") ? "解除禁言" : "禁言" %>
                </button>
            </form>
        </td>
    </tr>
    <% } rs.close(); ps.close(); %>
</table>

<!-- 聊天记录管理 -->
<h2 style="text-align:center;">聊天记录管理</h2>
<table>
    <tr><th>发送者ID</th><th>内容</th><th>图片</th><th>时间</th><th>操作</th></tr>
    <%
        ps = conn.prepareStatement("SELECT id, user_id, content, image_url, timestamp FROM chat_messages WHERE deleted = 1 ORDER BY timestamp DESC");

        rs = ps.executeQuery();
        while (rs.next()) {
    %>
    <tr>
        <td><%= rs.getInt("user_id") %></td>
        <td><%= rs.getString("content") == null ? "" : rs.getString("content") %></td>
        <td><% if (rs.getString("image_url") != null) { %>
            <img src="<%= rs.getString("image_url") %>" style="width:60px;">
            <% } else { out.print("无"); } %></td>
        <td><%= rs.getTimestamp("timestamp") %></td>
        <td>
            <form method="post" action="recover">
                <input type="hidden" name="messageId" value="<%= rs.getInt("id") %>">
                <button class="restore">恢复</button>
            </form>
        </td>
    </tr>
    <% } rs.close(); ps.close(); conn.close(); %>
</table>

</body>
</html>
