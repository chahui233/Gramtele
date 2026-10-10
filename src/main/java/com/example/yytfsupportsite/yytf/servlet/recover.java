package com.example.yytfsupportsite.yytf.servlet;

import com.example.yytfsupportsite.yytf.util.DBUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;

@WebServlet("/recover")
public class recover extends HttpServlet {
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String msgIdStr = request.getParameter("messageId");

        if (msgIdStr == null) {
            response.sendRedirect("admin.jsp");
            return;
        }

        try (Connection conn = DBUtil.getConnection()) {
            int msgId = Integer.parseInt(msgIdStr);
            // 设置消息为恢复状态，删除标记为 false
            PreparedStatement ps = conn.prepareStatement("UPDATE chat_messages SET deleted = 0 WHERE id = ?");
            ps.setInt(1, msgId);
            ps.executeUpdate();
            ps.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 恢复聊天记录后重定向回 chatadmin.jsp
        response.sendRedirect("chatadmin.jsp");
    }
}
